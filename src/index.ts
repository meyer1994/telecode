import { webhookCallback } from "grammy";
import { useDrizzle } from "./utils/drizzle";
import { TelegramBot } from "./utils/telegram";


export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ping') return Response.json({ message: 'pong' });

    const db = useDrizzle(env);
    const bot = new TelegramBot(db, env);
    
    if (url.pathname.match(/^\/tlg\/?/)) {
      return webhookCallback(bot.bot, 'cloudflare-mod')(request);
    }

    return new Response('Not Found', { status: 404 });
  },
};
