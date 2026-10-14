import { execSync } from 'node:child_process';

/**
 * Runs once before the e2e suite: loads `.env.test` and applies migrations to the test database.
 * Requires the test DB to be running: `docker compose --profile test up -d db-test`.
 */
export default function globalSetup(): void {
  process.env.NODE_ENV = 'test';
  process.loadEnvFile('.env.test');

  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });
}
