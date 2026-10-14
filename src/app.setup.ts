import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { bodyParserErrorMiddleware } from './common/middleware/body-parser-error.middleware';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { createValidationPipe } from './common/pipes/app-validation.pipe';

export const API_PREFIX = 'api/v1';

/**
 * Global HTTP wiring shared by `main.ts` and the e2e test app,
 * so tests exercise exactly the same pipes, filters and prefixes as production.
 */
export function configureApp(app: NestExpressApplication): void {
  app.useLogger(app.get(Logger));
  // Order matters: request id first, then the body parser and its error translator.
  app.use(requestIdMiddleware);
  app.useBodyParser('json', { limit: '1mb' });
  app.use(bodyParserErrorMiddleware);
  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Everfit Workout Logging API')
    .setDescription('Log workouts, query history and compute personal records.')
    .setVersion('1.0')
    .build();

  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
