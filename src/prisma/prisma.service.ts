import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;

  constructor() {
    // DATABASE_URL goes through Supabase's transaction pooler (port 6543).
    // Configure pg.Pool with keepAlive and short idleTimeoutMillis so stale
    // sockets are purged before Supabase drops them, avoiding connection timeouts.
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 5_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });

    pool.on('error', (err) => {
      this.logger.warn(`Handled idle client pool error: ${err.message}`);
    });

    const adapter = new PrismaPg(pool);

    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
