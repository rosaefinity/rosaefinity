require("dotenv").config();

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
    const users = await prisma.users.findMany({
        select: {
            email: true,
            username: true,
            role: true,
            status: true
        }
    });

    console.table(users);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
