const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const users = await prisma.user.findMany({
    where: { role: 'user' },
    select: {
      id: true,
      name: true,
      email: true,
      _count: {
        select: {
          reports: true,
          collections: true,
          payments: true,
          contactQueries: true,
        },
      },
    },
  });

  const totalReports = await prisma.report.count();
  const totalCollections = await prisma.collection.count();
  const totalQueries = await prisma.contactQuery.count();

  console.log('Total Reports in DB:', totalReports);
  console.log('Total Collections in DB:', totalCollections);
  console.log('Total Queries in DB:', totalQueries);
  console.log('Users activity sample:', JSON.stringify(users, null, 2));
}

check().finally(() => prisma.$disconnect());
