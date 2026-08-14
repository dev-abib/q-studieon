require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function check() {
  const user = await prisma.user.findFirst({
    where: { email: 'abib.web.dev@gmail.com' },
    include: {
      sessions: true,
      auditLogs: true,
      createdFlags: true,
    },
  });

  console.log('User record:', JSON.stringify(user, null, 2));

  const allSessions = await prisma.userSession.findMany({
    take: 10,
    orderBy: { loginAt: 'desc' },
  });
  console.log('Recent sessions in DB:', JSON.stringify(allSessions, null, 2));
}

check().finally(async () => {
  await prisma.$disconnect();
  await pool.end();
});
