import { plainToInstance } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsString, Max, Min, MinLength, validateSync } from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @MinLength(1)
  DATABASE_URL: string;

  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = 'info';

  /** Prisma queries slower than this are logged as warnings. */
  @IsInt()
  @Min(0)
  SLOW_QUERY_MS: number = 200;

  /** Exercise → muscle group mapping, relative to the working directory. */
  @IsString()
  @MinLength(1)
  EXERCISE_CATALOG_PATH: string = 'config/exercise-catalog.json';
}

/**
 * Validates process.env at boot so a misconfigured deployment fails fast
 * with a readable message instead of failing later on first use.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, { enableImplicitConversion: true });
  const errors = validateSync(env, { whitelist: false });

  if (errors.length > 0) {
    const issues = errors.map(
      (error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
    );
    throw new Error(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`);
  }

  return env;
}
