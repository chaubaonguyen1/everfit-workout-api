import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './app.setup';
import type { AppConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  configureApp(app);
  setupSwagger(app);

  const config = app.get<ConfigService<AppConfig, true>>(ConfigService);
  await app.listen(config.get('app.port', { infer: true }));
}

void bootstrap();
