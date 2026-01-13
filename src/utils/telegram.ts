import { getSandbox, Sandbox } from '@cloudflare/sandbox';
import {
  conversations,
  type ConversationFlavor
} from '@grammyjs/conversations';
import { eq } from 'drizzle-orm';
import { Bot, Context, session, SessionFlavor } from 'grammy';
import { ignoreOld } from 'grammy-middlewares';
import type { UserFromGetMe } from 'grammy/types';
import type { StorageAdapter } from 'grammy/web';
import { TMessages } from '../db/schema';
import { useDrizzle } from './drizzle';

interface Session {
  sandboxId?: string | null;
}

type MyContext = Context & SessionFlavor<Session> & ConversationFlavor<Context> & {
  db: ReturnType<typeof useDrizzle>;
}

class DrizzleAdapter<T> implements StorageAdapter<T> {
  constructor(private db: ReturnType<typeof useDrizzle>) {}

  async read(key: string): Promise<T | undefined> {
    console.info(`DrizzleAdapter: Reading key="${key}"`);
    const message = await this.db
      .select()
      .from(TMessages)
      .where(eq(TMessages.id, key))
      .get();
    if (!message?.message) return undefined;
    return JSON.parse(message.message) as T;
  }

  async write(key: string, value: T): Promise<void> {
    console.info(`DrizzleAdapter: Writing key="${key}"`);
    await this.db
      .insert(TMessages)
      .values({ id: key, message: JSON.stringify(value) })
      .onConflictDoUpdate({
        target: [TMessages.id],
        set: { message: JSON.stringify(value) },
      });
  }

  async delete(key: string): Promise<void> {
    console.info(`DrizzleAdapter: Deleting key="${key}"`);
    await this.db
      .delete(TMessages)
      .where(eq(TMessages.id, key));
  }
}

export class TelegramBot {
  public bot: Bot<MyContext>;
  private db: ReturnType<typeof useDrizzle>;
  private env: Env;
  private sandbox: DurableObjectNamespace<Sandbox>;

  constructor(db: ReturnType<typeof useDrizzle>, env: Env) {
    console.info('TelegramBot: Initializing bot...');
    this.db = db;
    this.env = env;
    this.sandbox = env.Sandbox as unknown as DurableObjectNamespace<Sandbox>;

    const botInfo = JSON.parse(env.NITRO_BOT_INFO) as UserFromGetMe;
    this.bot = new Bot<MyContext>(env.NITRO_BOT_TOKEN, { botInfo });
    console.info('TelegramBot: Bot created successfully');

    this.setupMiddleware();
    this.setupHandlers();
    console.info('TelegramBot: Setup complete');
  }

  private setupMiddleware() {
    console.info('TelegramBot: Setting up middleware...');

    this.bot.use(async (ctx, next) => {
      console.info(`TelegramBot:`, { update: ctx.update.update_id });
      try {
        await next();
      } catch (error) {
        console.error(`TelegramBot: Error in middleware: ${error}`);
        throw error;
      }
    });

    // ignore old updates
    this.bot.use(ignoreOld(60 * 24)); // 24 hours

    // session management
    this.bot.use(session({ 
      prefix: 'session:',
      storage: new DrizzleAdapter(this.db),
      initial: (): Session => ({ 
        sandboxId: null,
      })
    }));

    // conversations support
    this.bot.use(conversations({ 
      storage: {
        type: 'key',
        prefix: 'conversation:',
        adapter: new DrizzleAdapter(this.db)
      }
    }));

    console.info('TelegramBot: Middleware setup complete');
  }

  private setupHandlers() {
    console.info('TelegramBot: Setting up handlers...');

    // Create command - creates a machine if one doesn't exist
    this.bot.command('create', async (ctx) => {
      console.info(`TelegramBot: /create command received from user ${ctx.from?.id}`);
      
      if (ctx.session.sandboxId) {
        await ctx.reply('A machine already exists for this chat. Use /destroy to remove it first.');
        return;
      }

      try {
        const chatId = ctx.chat?.id.toString() || '';
        const sandboxId = `chat-${chatId}`;
        const sandbox = getSandbox(this.sandbox, sandboxId);
        await sandbox.exec('echo "Hello, world!"');
        ctx.session.sandboxId = sandboxId;
        await ctx.reply('Machine created successfully!');
      } catch (error) {
        console.error(`TelegramBot: Error creating machine: ${error}`);
        await ctx.reply('Failed to create machine. Please try again later.');
      }
    });

    // Exec command - executes a command on the machine
    this.bot.command('exec', async (ctx) => {
      console.info(`TelegramBot: /exec command received from user ${ctx.from?.id}`);
      
      if (!ctx.session.sandboxId) {
        await ctx.reply('No machine exists for this chat. Use /create to create one first.');
        return;
      }

      const command = ctx.message?.text?.split(' ').slice(1).join(' ');
      if (!command) {
        await ctx.reply('Please provide a command to execute. Usage: /exec <command>');
        return;
      }

      try {
        const sandbox = getSandbox(this.sandbox, ctx.session.sandboxId);
        
        await ctx.replyWithChatAction('typing');
        const result = await sandbox.exec(command);
        
        const output = result.stdout || result.stderr || 'Command executed successfully (no output)';
        await ctx.reply(`Output:\n\`\`\`\n${output}\n\`\`\``, { parse_mode: 'Markdown' });
      } catch (error) {
        console.error(`TelegramBot: Error executing command: ${error}`);
        await ctx.reply(`Error executing command: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    // Destroy command - destroys the machine
    this.bot.command('destroy', async (ctx) => {
      console.info(`TelegramBot: /destroy command received from user ${ctx.from?.id}`);
      
      if (!ctx.session.sandboxId) {
        await ctx.reply('No machine exists for this chat.');
        return;
      }

      try {
        const sandbox = getSandbox(this.sandbox, ctx.session.sandboxId);
        await sandbox.destroy();
        ctx.session.sandboxId = null;
        await ctx.reply('Machine destroyed successfully.');
      } catch (error) {
        console.error(`TelegramBot: Error destroying machine: ${error}`);
        await ctx.reply(`Error destroying machine: ${error instanceof Error ? error.message : String(error)}`);
      }
    });

    this.bot.on('message:text', async (ctx) => {
      console.info(`TelegramBot: Message text received from user ${ctx.from?.id}: ${ctx.message?.text}`);
      await ctx.reply('echo: ' + ctx.message?.text);
    });
  }
}
