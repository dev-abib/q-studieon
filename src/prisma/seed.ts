import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const SEED_STAFF_MEMBERS = [
  {
    email: 'superadmin@dwellr.tech',
    name: 'Super Admin',
    role: 'super_admin' as const,
  },
  {
    email: 'admin@dwellr.tech',
    name: 'Administrator',
    role: 'admin' as const,
  },
  {
    email: 'admin@admin.com',
    name: 'Admin',
    role: 'admin' as const,
  },
  {
    email: 'support@dwellr.tech',
    name: 'Customer Support Lead',
    role: 'customer_support' as const,
  },

  {
    email: 'content@dwellr.tech',
    name: 'Content Manager',
    role: 'content_manager' as const,
  },
  {
    email: 'finance@dwellr.tech',
    name: 'Finance Manager',
    role: 'finance' as const,
  },
];

async function main() {
  const defaultPassword = '##Demo12@@';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  for (const staff of SEED_STAFF_MEMBERS) {
    const isOwner = staff.email === 'superadmin@dwellr.tech';
    const existing = await prisma.user.findUnique({
      where: { email: staff.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { email: staff.email },
        data: {
          role: staff.role,
          name: staff.name,
          isOwner,
        },
      });
      console.log(`⚡ Updated existing staff user: ${staff.email} (${staff.role})`);
    } else {
      await prisma.user.create({
        data: {
          email: staff.email,
          name: staff.name,
          password: hashedPassword,
          role: staff.role,
          isOwner,
          isOtpVerified: true,
          authProvider: 'local',
          termsAndConditions: true,
          isPaid: false,
          isGuest: false,
        },
      });
      console.log(`✅ Created staff user: ${staff.email} (${staff.role})`);
    }
  }

  console.log('\n🎉 Seeding complete! All staff roles created with password: ##Demo12@@');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
