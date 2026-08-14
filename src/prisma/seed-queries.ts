import 'dotenv/config';
import { PrismaClient, ContactQueryStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

const SAMPLE_QUERIES = [
  {
    name: 'Abib Dipto',
    email: 'abibdipto@gmail.com',
    subject: 'Enterprise Plan & Multi-Branch Team Licensing',
    message:
      'Hello Dwellr Team,\n\nWe are looking to roll out the inspection platform across 3 regional offices with approximately 45 field inspectors. Could you please provide information on volume licensing, onboarding support, and API access for our internal dashboard?\n\nBest regards,\nAbib Dipto',
    status: ContactQueryStatus.PENDING,
  },
  {
    name: 'Abib Dipto',
    email: 'abibdipto@gmail.com',
    subject: 'Custom PDF Report Branding & Headers',
    message:
      'Hi support team,\n\nIs it possible to customize the inspection report cover page with our corporate logo and custom company disclaimer text before generating the final customer PDF?\n\nThanks!',
    status: ContactQueryStatus.RESOLVED,
    replyMessage:
      'Hello Abib,\n\nYes, absolutely! You can upload your company logo, custom disclaimers, and contact details from the Settings > Report Branding section. All newly exported PDF inspection certificates will automatically reflect your branding.\n\nLet us know if you need any assistance setting it up!\n\nBest regards,\nSuper Admin @ Dwellr Team',
    repliedByName: 'Super Admin',
    repliedByEmail: 'superadmin@dwellr.tech',
    repliedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
  },
  {
    name: 'Abib (Web Dev)',
    email: 'abib.web.dev@gmail.com',
    subject: 'Webhook Subscriptions & REST API Integration',
    message:
      'Hey folks,\n\nWe are building a custom CRM integration and want to receive real-time webhook events whenever an inspector finishes a property inspection report. Could you share the webhook payload schema and authentication guidelines?\n\nThanks,\nAbib',
    status: ContactQueryStatus.IN_PROGRESS,
  },
  {
    name: 'Abib (Web Dev)',
    email: 'abib.web.dev@gmail.com',
    subject: 'Mobile App Offline Sync Behavior',
    message:
      'Hi team,\n\nHow does the mobile app handle photo uploads and question answer caching in rural areas with spotty cell coverage? Does it queue everything locally and sync automatically upon reconnection?\n\nCheers!',
    status: ContactQueryStatus.PENDING,
  },
  {
    name: 'Data Wizard Warrior',
    email: 'data.wizard.warrior@gmail.com',
    subject: 'Bulk Data Export & Quarterly Analytics',
    message:
      'Greetings,\n\nOur data science and compliance team is interested in exporting aggregate room defect metrics and category breakdown statistics in CSV or parquet format for quarterly reporting.\n\nIs this available on the current platform?\n\nBest,\nData Wizard Warrior',
    status: ContactQueryStatus.RESOLVED,
    replyMessage:
      'Greetings Data Wizard,\n\nWe currently support one-click raw CSV and JSON exports directly from the Analytics snapshot tab. Furthermore, our enterprise tier provides direct read replica access or automated daily GCS bucket dumps for BI warehousing.\n\nFeel free to reach out if you would like us to configure an automated export schedule for your organization.\n\nWarm regards,\nCustomer Support Lead @ Dwellr',
    repliedByName: 'Customer Support Lead',
    repliedByEmail: 'support@dwellr.tech',
    repliedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
  },
  {
    name: 'Data Wizard Warrior',
    email: 'data.wizard.warrior@gmail.com',
    subject: 'Question Tree Multilingual Localization',
    message:
      'Hello Support,\n\nAre there any upcoming plans to support multilingual question prompts (e.g., Spanish and French) for onsite inspectors in diverse regions?\n\nThank you!',
    status: ContactQueryStatus.PENDING,
  },
];

async function seedQueries() {
  console.log('🌱 Seeding contact queries...');

  for (const q of SAMPLE_QUERIES) {
    const existingUser = await prisma.user.findUnique({
      where: { email: q.email },
      select: { id: true },
    });

    const isRegisteredUser = Boolean(existingUser);
    const userId = existingUser ? existingUser.id : null;

    const created = await prisma.contactQuery.create({
      data: {
        name: q.name,
        email: q.email,
        subject: q.subject,
        message: q.message,
        status: q.status,
        isRegisteredUser,
        userId,
        replyMessage: q.replyMessage || null,
        repliedByName: q.repliedByName || null,
        repliedByEmail: q.repliedByEmail || null,
        repliedAt: q.repliedAt || null,
      },
    });

    console.log(
      `  ✓ Added query "${q.subject}" from ${q.email} [${q.status}] (Registered: ${isRegisteredUser})`,
    );
  }

  console.log('✅ Contact queries seeding completed successfully!');
}

seedQueries()
  .catch((e) => {
    console.error('❌ Error seeding queries:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
