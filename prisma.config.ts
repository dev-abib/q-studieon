import 'dotenv/config';
import { defineConfig } from 'prisma/config';
export default defineConfig({
  schema: 'src/prisma/schema',
  migrations: {
    path: 'src/prisma/migrations',
    seed: 'npx ts-node --compiler-options {"module":"CommonJS"} src/prisma/seed.ts',
  },
  datasource: {
    url: process.env.DIRECT_URL!,
  },
});
