import { randomUUID } from 'node:crypto';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import type { RequestWithId } from '../../common/middleware/request-id.middleware';
import type { AppConfig } from '../../config/configuration';

/**
 * Structured JSON logs (pino). Every request log line carries the request id assigned by
 * `requestIdMiddleware`, so logs can be correlated with the `requestId` in error responses.
 */
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => ({
        pinoHttp: {
          level: config.get('log.level', { infer: true }),
          transport: config.get('log.pretty', { infer: true })
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
          genReqId: (req) => (req as RequestWithId).id ?? randomUUID(),
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          },
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
  ],
})
export class LoggerModule {}
