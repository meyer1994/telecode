import { Menu } from '@grammyjs/menu';
import { eq } from 'drizzle-orm';
import { Bot, Context, session, SessionFlavor } from 'grammy';
import type { UserFromGetMe } from 'grammy/types';
import type { StorageAdapter } from 'grammy/web';
import { H3Event } from 'h3';
import { TMessages } from '../db/schema';
import type { useDrizzle } from './drizzle';

interface SessionData {
  machines: { id: string; name: string }[];
}

type MyContext = Context & SessionFlavor<SessionData>;

class DrizzleAdapter<T> implements StorageAdapter<T> {
  constructor(private db: ReturnType<typeof useDrizzle>) {}

  async read(key: string): Promise<T | undefined> {
    const message = await this.db
      .select()
      .from(TMessages)
      .where(eq(TMessages.id, key))
      .get();
    if (!message?.message) return undefined;
    return JSON.parse(message.message) as T;
  }

  async write(key: string, value: T): Promise<void> {
    await this.db
      .insert(TMessages)
      .values({ id: key, message: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: [TMessages.id],
        set: { message: JSON.stringify(value) },
      });
  }

  async delete(key: string): Promise<void> {
    await this.db
      .delete(TMessages)
      .where(eq(TMessages.id, key));
  }
}

export const useTelegram = (event: H3Event) => {
  if (!process.env.NITRO_BOT_TOKEN) throw new Error('BOT_TOKEN is not set');
  if (!process.env.NITRO_BOT_INFO) throw new Error('BOT_INFO is not set');

  const bot = new Bot<MyContext>(process.env.NITRO_BOT_TOKEN, {
    botInfo: JSON.parse(process.env.NITRO_BOT_INFO) as UserFromGetMe,
  });

  // session
  bot.use(session({
    storage: new DrizzleAdapter(event.context.db),
    initial: (): SessionData => ({
      machines: [
        { id: 'm1', name: 'Production Server' },
        { id: 'm2', name: 'Staging Server' },
      ],
    }),
  }));

  // menu machines
  const menuMachinesList = new Menu<MyContext>('machines-list')
    .dynamic(async (ctx, range) => {
      for (const machine of ctx.session.machines) {
        range.text(machine.name, async ctx => await ctx.reply(machine.name));
        range.row();
      }
    })
    .back('Back');

  // menu start
  const menuStart = new Menu<MyContext>('start')
    .submenu('List Machines', 'machines-list')
    .row()
    .text('Close', async ctx => await ctx.menu.close());

  // register menus
  menuStart.register(menuMachinesList);
  bot.use(menuStart);

  // Command handlers
  bot.command('start', async (ctx) => {
    await ctx.reply('Machine menu', { reply_markup: menuStart });
  });

  // echo text
  bot.on(':text', async ctx => await ctx.reply(`echo: ${ctx.message?.text}`));

  return bot;
};
