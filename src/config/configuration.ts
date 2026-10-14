import { NodeEnv, validateEnv } from './env.validation';

/**
 * Typed, nested view over the validated environment. Defaults and coercion live only in
 * `EnvironmentVariables`, so this factory can never disagree with validation.
 * Inject with `ConfigService<AppConfig, true>` and read via `config.get('database.url', { infer: true })`.
 */
export const configuration = () => {
  const env = validateEnv(process.env);

  return {
    app: {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
    },
    database: {
      url: env.DATABASE_URL,
      slowQueryMs: env.SLOW_QUERY_MS,
    },
    catalog: {
      path: env.EXERCISE_CATALOG_PATH,
    },
    log: {
      level: env.LOG_LEVEL,
      pretty: env.NODE_ENV === NodeEnv.Development,
    },
  };
};

export type AppConfig = ReturnType<typeof configuration>;
