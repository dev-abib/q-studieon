const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.admin.findMany({
    select: { email: true, role: true, name: true },
    take: 10,
  });
  console.log(JSON.stringify(admins, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
