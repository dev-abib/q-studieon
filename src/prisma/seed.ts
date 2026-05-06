import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@admin.com';
  const password = '##Demo12@@';

  const existing = await prisma.user.findFirst({
    where: { role: 'super_admin' },
  });

  if (existing) {
    console.log(`Super admin already exist - skipping default admin creation`);
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      password: hashedPassword,
      role: 'super_admin',
      isOtpVerified: true,
      authProvider: 'local',
      termsAndConditions: true,
      isPaid: false,
      isGuest: false,
    },
  });
  console.log(`✅ Super admin created: ${email}`);
}

main()
  .catch((e) => {
    console.log(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
