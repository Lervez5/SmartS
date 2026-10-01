import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database';
import { PERMISSIONS, PERMISSION_DOMAINS, ROLE_PERMISSIONS } from '@schoolos/auth/permissions';
import { ROLES, normalizeRole } from '@schoolos/auth/roles';
import { recordAuditLog } from '../audit-logs/service';
import type { UpdateRolePermissionsDto, MutateRolePermissionDto } from './schema';

const roleInclude = {
  rolePermissions: {
    include: { permission: true },
  },
  _count: { select: { roleMemberships: true } },
} satisfies Prisma.RoleInclude;

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/** Accepts either a role id or a role name (including legacy spellings). */
function roleLookup(idOrName: string): Prisma.RoleWhereInput {
  const name = normalizeRole(idOrName) ?? idOrName;
  return OBJECT_ID.test(idOrName) ? { OR: [{ id: idOrName }, { name }] } : { name };
}

function present(role: Prisma.RoleGetPayload<{ include: typeof roleInclude }>) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    members: role._count.roleMemberships,
    permissions: role.rolePermissions.map((rp) => rp.permission.key).sort(),
    createdAt: role.createdAt,
    updatedAt: role.updatedAt,
  };
}

/** The full permission catalogue, grouped by domain for an admin UI. */
export function permissionCatalogue() {
  return PERMISSION_DOMAINS.map((domain) => ({
    domain,
    permissions: PERMISSIONS.filter((p) => p.startsWith(`${domain}.`)).map((key) => {
      const action = key.slice(domain.length + 1);
      return {
        key,
        action,
        name: action.charAt(0).toUpperCase() + action.slice(1),
        description: `${action} ${domain}`,
      };
    }),
  })).filter((d) => d.permissions.length > 0);
}

export async function listRoles() {
  const roles = await prisma.role.findMany({
    include: roleInclude,
    orderBy: { name: 'asc' },
  });
  return roles.map(present);
}

export async function getRole(idOrName: string) {
  const role = await prisma.role.findFirst({
    where: roleLookup(idOrName),
    include: roleInclude,
  });
  if (!role) throw new Error('Role not found.');
  return present(role);
}

/**
 * Maps catalogue keys to persisted permission ids.
 *
 * A key that exists in the code catalogue but not in MongoDB means the seed
 * has not run since the catalogue changed, so it is reported rather than
 * silently skipped.
 */
async function resolvePermissionIds(keys: string[]): Promise<string[]> {
  const known = new Set<string>(PERMISSIONS);
  const unknown = keys.filter((k) => !known.has(k));
  if (unknown.length) {
    throw new Error(`Unknown permission(s): ${unknown.join(', ')}`);
  }

  const rows = await prisma.permission.findMany({
    where: { key: { in: keys } },
    select: { id: true, key: true },
  });
  const persisted = new Set(rows.map((r) => r.key));

  const missing = keys.filter((k) => !persisted.has(k));
  if (missing.length) {
    throw new Error(
      `Permission(s) missing from the database catalogue: ${missing.join(', ')}. Run "pnpm run seed".`
    );
  }

  return rows.map((r) => r.id);
}

/**
 * Replaces (or extends) a role's permission set.
 *
 * SUPER_ADMIN is intentionally immutable: it is the platform owner and must
 * always hold the full catalogue, otherwise a mis-click could lock every
 * administrator out of role management with no way back.
 */
export async function updateRolePermissions(
  actorId: string,
  roleId: string,
  dto: UpdateRolePermissionsDto
) {
  const role = await prisma.role.findFirst({ where: roleLookup(roleId) });
  if (!role) throw new Error('Role not found.');

  if (role.name === 'SUPER_ADMIN') {
    throw new Error(
      'SUPER_ADMIN always holds the full permission catalogue and cannot be modified.'
    );
  }

  const ids = await resolvePermissionIds(dto.permissions);

  if (!dto.additive) {
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
  }

  if (ids.length) {
    const unique = Array.from(new Set(ids));
    const existing = await prisma.rolePermission.findMany({
      where: { roleId: role.id, permissionId: { in: unique } },
      select: { permissionId: true },
    });
    const already = new Set(existing.map((e) => e.permissionId));
    const toCreate = unique
      .filter((id) => !already.has(id))
      .map((permissionId) => ({ roleId: role.id, permissionId }));

    if (toCreate.length) {
      await prisma.rolePermission.createMany({ data: toCreate });
    }
  }

  await recordAuditLog(
    actorId,
    dto.additive ? 'GRANT_ROLE_PERMISSIONS' : 'SET_ROLE_PERMISSIONS',
    `${dto.additive ? 'Granted' : 'Set'} ${dto.permissions.length} permission(s) on role ${role.name}`
  );

  return getRole(role.id);
}

/** Grants or revokes one permission on a role. */
export async function mutateRolePermission(
  actorId: string,
  roleId: string,
  dto: MutateRolePermissionDto
) {
  const role = await prisma.role.findFirst({ where: roleLookup(roleId) });
  if (!role) throw new Error('Role not found.');

  if (role.name === 'SUPER_ADMIN') {
    throw new Error(
      'SUPER_ADMIN always holds the full permission catalogue and cannot be modified.'
    );
  }

  const [permissionId] = await resolvePermissionIds([dto.permission]);

  if (dto.granted) {
    const existing = await prisma.rolePermission.findFirst({
      where: { roleId: role.id, permissionId },
      select: { id: true },
    });
    if (!existing) {
      await prisma.rolePermission.create({
        data: { roleId: role.id, permissionId },
      });
    }
  } else {
    await prisma.rolePermission.deleteMany({
      where: { roleId: role.id, permissionId },
    });
  }

  await recordAuditLog(
    actorId,
    dto.granted ? 'GRANT_PERMISSION' : 'REVOKE_PERMISSION',
    `${dto.granted ? 'Granted' : 'Revoked'} ${dto.permission} on role ${role.name}`
  );

  return getRole(role.id);
}

/** Restores a role to the grants defined in the canonical catalogue. */
export async function resetRoleToCatalogue(actorId: string, roleId: string) {
  const role = await prisma.role.findFirst({ where: roleLookup(roleId) });
  if (!role) throw new Error('Role not found.');
  if (!ROLES.includes(role.name as (typeof ROLES)[number])) {
    throw new Error(`${role.name} is not a platform role and has no catalogue default.`);
  }

  // Delegating keeps a single definition of the defaults.
  return updateRolePermissions(actorId, role.id, {
    permissions: catalogueGrantsFor(role.name),
    additive: false,
  });
}

function catalogueGrantsFor(roleName: string): string[] {
  const grants = ROLE_PERMISSIONS[roleName as keyof typeof ROLE_PERMISSIONS];
  return grants ? [...grants] : [];
}

/** Assigns a canonical role to a user, replacing any existing membership. */
export async function assignUserRole(actorId: string, userId: string, roleName: string) {
  const canonical = normalizeRole(roleName);
  if (!canonical) {
    throw new Error(`Unknown role "${roleName}". Expected one of: ${ROLES.join(', ')}`);
  }

  const role = await prisma.role.findUnique({ where: { name: canonical } });
  if (!role) throw new Error(`Role ${canonical} is not provisioned. Run the seed first.`);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');

  await prisma.$transaction([
    prisma.userRoleMembership.deleteMany({ where: { userId } }),
    prisma.userRoleMembership.create({ data: { userId, roleId: role.id } }),
  ]);

  await recordAuditLog(actorId, 'ASSIGN_ROLE', `Assigned ${canonical} to ${user.email}`);

  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      status: true,
      roleMemberships: {
        select: { role: { select: { id: true, name: true } } },
      },
    },
  });
}
