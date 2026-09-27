import argon2 from "argon2";
import { config } from "../config";
import { logger } from "../shared/logger";
import { prisma } from "../infrastructure/database";

const ROLES = [
  { name: "super_admin", description: "Full system access" },
  { name: "school_admin", description: "School administration access" },
  { name: "teacher", description: "Teaching staff" },
  { name: "parent", description: "Parent or guardian" },
  { name: "student", description: "Enrolled student" },
] as const;

type RoleName = (typeof ROLES)[number]["name"];

/** Dev fixtures: one active user per role so each portal can be exercised. */
const FIXTURES: Array<{
  email: string;
  name: string;
  role: RoleName;
  profile?: "student" | "staff" | "parent";
}> = [
  {
    email: config.seed.adminEmail,
    name: "System Administrator",
    role: "super_admin",
  },
  {
    email: "schooladmin@school.example",
    name: "School Administrator",
    role: "school_admin",
  },
  {
    email: "teacher@school.example",
    name: "Grace Teacher",
    role: "teacher",
    profile: "staff",
  },
  {
    email: "parent@school.example",
    name: "Pat Parent",
    role: "parent",
    profile: "parent",
  },
  {
    email: "student@school.example",
    name: "Sam Student",
    role: "student",
    profile: "student",
  },
];

async function ensureRole(name: RoleName, description: string): Promise<void> {
  await prisma.role.upsert({
    where: { name },
    update: {},
    create: { name, description },
  });
}

async function seedUsers(): Promise<void> {
  logger.info("Starting seed...");

  for (const role of ROLES) {
    await ensureRole(role.name, role.description);
  }

  const passwordHash = await argon2.hash(config.seed.adminPassword);

  for (const fixture of FIXTURES) {
    const existing = await prisma.user.findUnique({
      where: { email: fixture.email },
    });

    if (existing) {
      logger.info("User already exists, skipping", { email: fixture.email });
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email: fixture.email,
        name: fixture.name,
        passwordHash,
        status: "active",
        roleMemberships: {
          create: { role: { connect: { name: fixture.role } } },
        },
        ...(fixture.profile === "student"
          ? { studentProfile: { create: { gradeLevel: "Grade 5" } } }
          : {}),
        ...(fixture.profile === "staff"
          ? { staffProfile: { create: { position: "Teacher" } } }
          : {}),
        ...(fixture.profile === "parent" ? { parentProfile: { create: {} } } : {}),
      },
    });

    logger.info("User created", {
      id: user.id,
      email: user.email,
      role: fixture.role,
    });
  }

  logger.info("Seed complete.", { password: config.seed.adminPassword });
}

seedUsers()
  .catch((err) => {
    logger.error("Seed failed", { error: err });
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
