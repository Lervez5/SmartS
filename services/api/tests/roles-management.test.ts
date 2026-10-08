/**
 * Roles and permissions management tests.
 */

import request from 'supertest';
import { appInstance, API_BASE, loginAs, makeAuthAgent, type TestAgent } from './helpers';
import { ROLES, ROLE_APP } from '@schoolos/auth/roles';
import { PERMISSIONS, ROLE_PERMISSIONS } from '@schoolos/auth/permissions';

describe('Roles & Permissions Management', () => {
  let adminAgent: TestAgent;

  beforeAll(async () => {
    adminAgent = makeAuthAgent();
    await loginAs(adminAgent, 'admin@school.example', 'supersecret');
  });

  describe('Permission catalogue', () => {
    it('lists all domains', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/permissions`);
      expect(res.status).toBe(200);
      expect(res.body.domains).toBeDefined();
      expect(Array.isArray(res.body.domains)).toBe(true);
    });
  });

  describe('Role listing', () => {
    it('lists all 6 roles', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles`);
      expect(res.status).toBe(200);
      expect(res.body.roles).toBeDefined();
      expect(res.body.roles.length).toBe(6);

      const roleNames = res.body.roles.map((r: any) => r.name);
      expect(roleNames.sort()).toEqual([...ROLES].sort());
    });

    it('SUPER_ADMIN has ALL permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/SUPER_ADMIN`);
      expect(res.status).toBe(200);
      const allPermissions = res.body.permissions;
      expect(allPermissions.length).toBe(
        ROLES.length === 6 ? PERMISSIONS.length : Object.keys(PERMISSIONS).length
      );
    });

    it('roles map to correct portals', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles`);
      const roles = res.body.roles;

      for (const role of roles) {
        expect(ROLE_APP[role.name as keyof typeof ROLE_APP]).toBeDefined();
      }
    });
  });

  describe('Role-based access to role management', () => {
    it('DEAN cannot manage roles', async () => {
      const deanAgent = makeAuthAgent();
      await loginAs(deanAgent, 'dean@school.example', 'supersecret');

      const res = await deanAgent.get(`${API_BASE}/roles`);
      expect(res.status).toBe(403);
    });

    it('ACCOUNTANT cannot manage roles', async () => {
      const accountantAgent = makeAuthAgent();
      await loginAs(accountantAgent, 'accountant@school.example', 'supersecret');

      const res = await accountantAgent.get(`${API_BASE}/roles`);
      expect(res.status).toBe(403);
    });
  });

  describe('SUPER_ADMIN immutability', () => {
    it('SUPER_ADMIN role cannot be modified', async () => {
      const res = await adminAgent.put(`${API_BASE}/roles/SUPER_ADMIN/permissions`).send({
        permissions: ['users.view'],
      });
      expect(res.status).toBe(500);
    });
  });

  describe('Role permission grants', () => {
    it('ACCOUNTANT has finance permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/ACCOUNTANT`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).toContain('finance.view');
      expect(granted).toContain('finance.manage');
      expect(granted).toContain('finance.payments');
      expect(granted).toContain('finance.refunds');
      expect(granted).toContain('finance.reconcile');
    });

    it('ACCOUNTANT does NOT have academics permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/ACCOUNTANT`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).not.toContain('academics.manage');
      expect(granted).not.toContain('courses.manage');
      expect(granted).not.toContain('examinations.manage');
    });

    it('DEAN has academic permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/DEAN`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).toContain('academics.view');
      expect(granted).toContain('academics.manage');
      expect(granted).toContain('courses.view');
      expect(granted).toContain('attendance.view');
      expect(granted).toContain('examinations.view');
    });

    it('DEAN does NOT have finance permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/DEAN`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).not.toContain('finance.manage');
      expect(granted).not.toContain('finance.payments');
    });

    it('TEACHER has teacher-appropriate permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/TEACHER`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).toContain('attendance.view');
      expect(granted).toContain('attendance.mark');
      expect(granted).toContain('courses.view');
      expect(granted).toContain('examinations.view');
      expect(granted).toContain('grading.view');
    });

    it('TEACHER does NOT have user management', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/TEACHER`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).not.toContain('users.manage');
      expect(granted).not.toContain('roles.manage');
    });

    it('PARENT has child-scoped permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/PARENT`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).toContain('students.view');
      expect(granted).toContain('finance.view');
      expect(granted).toContain('grades.view');
      expect(granted).not.toContain('users.manage');
      expect(granted).not.toContain('roles.manage');
    });

    it('STUDENT has own-scoped permissions', async () => {
      const res = await adminAgent.get(`${API_BASE}/roles/STUDENT`);
      expect(res.status).toBe(200);
      const granted = res.body.permissions as string[];

      expect(granted).toContain('academics.view');
      expect(granted).toContain('attendance.view');
      expect(granted).toContain('grades.view');
    });
  });
});
