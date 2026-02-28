import { PrismaClient, Role } from "@prisma/client";
import * as argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
    console.log("Starting superadmin seed...");

    const adminEmail = "admin@smartsprout.com";
    const existingAdmin = await prisma.user.findUnique({
        where: { email: adminEmail },
    });

    if (existingAdmin) {
        console.log(`Admin user ${adminEmail} already exists. Skipping.`);
        return;
    }

    const adminPassword = process.env.ADMIN_PASSWORD || "supersecret";
    const passwordHash = await argon2.hash(adminPassword);

    const admin = await prisma.user.create({
        data: {
            email: adminEmail,
            name: "Superadmin",
            passwordHash,
            role: "admin",
        },
    });

    console.log("Successfully created superadmin!");
    console.log(`Email: ${admin.email}`);
    console.log(`Password: ${process.env.ADMIN_PASSWORD ? "[CONFIGURED]" : "supersecret (default)"}`);
    console.log(`Role: ${admin.role}`);
}

main()
    .catch((e) => {
        console.error("Failed to seed admin:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
