import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import type { AppConfig } from '../../config/configuration';

type LogEvents = 'query' | 'warn' | 'error';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, LogEvents>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly slowQueryMs: number;

  constructor(config: ConfigService<AppConfig, true>) {
    super({
      datasourceUrl: config.get('database.url', { infer: true }),
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    });
    this.slowQueryMs = config.get('database.slowQueryMs', { infer: true });
  }

  async onModuleInit(): Promise<void> {
    this.$on('query', (event) => {
      if (event.duration >= this.slowQueryMs) {
        this.logger.warn({ durationMs: event.duration, query: event.query }, 'Slow query');
      }
    });
    this.$on('warn', (event) => this.logger.warn(event.message));
    this.$on('error', (event) => this.logger.error(event.message));

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Lightweight connectivity check for the health endpoint. */
  async ping(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'Database ping failed');
      return false;
    }
  }
}
