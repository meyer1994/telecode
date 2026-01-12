import { Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../db/schema';

export const useDrizzle = (env: Env) => {
  const logger: Logger = {
    logQuery: (query, params) => {
      console.debug('[drizzle] query', query, params);
    },
  };

  return drizzle(env.DB, { logger, schema });
};
