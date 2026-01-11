import { Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { H3Event } from 'h3';
import * as schema from '~~/server/db/schema';

export const useDrizzle = (event: H3Event) => {
  const logger: Logger = {
    logQuery: (query, params) => {
      if (process.env.NODE_ENV === 'production') return;
      console.debug('[drizzle] query', query, params);
    },
  };

  const env = event.context.cloudflare.env as unknown as Cloudflare.Env;
  return drizzle(env.DB, { logger, schema });
};
