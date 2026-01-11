import { Logger } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { H3Event } from 'h3';
import * as schema from '../db/schema';

export const useDrizzle = (event: H3Event) => {
  const logger: Logger = {
    logQuery: (query, params) => {
      if (process.env.NODE_ENV === 'production') return;
      console.log('[drizzle] query', query, params);
    },
  };

  return drizzle(event.context.cloudflare.env.DB, { logger, schema });
};
