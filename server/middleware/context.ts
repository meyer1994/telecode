
import { eventHandler } from 'h3';
import { useDrizzle } from '../utils/drizzle';
import { useTelegram } from '../utils/telegram';

export default eventHandler(async (event) => {
  event.context.db = useDrizzle(event);
  event.context.bot = useTelegram(event);
});


declare module 'h3' {
  interface H3EventContext {
    db: ReturnType<typeof useDrizzle>;
    bot: ReturnType<typeof useTelegram>;

    cloudflare: {
      request: Request,
      env: Env,
      context: ExecutionContext;
    };
  }
}