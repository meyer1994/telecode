import { getSandbox, Sandbox } from '@cloudflare/sandbox';
import {
  conversations,
  type ConversationFlavor
} from '@grammyjs/conversations';
import { eq } from 'drizzle-orm';
import { Bot, Context, InputFile, session, SessionFlavor } from 'grammy';
import { ignoreOld } from 'grammy-middlewares';
import type { UserFromGetMe } from 'grammy/types';
import type { StorageAdapter } from 'grammy/web';
import { TMessages } from '../db/schema';
import { useDrizzle } from './drizzle';


const HELP_MESSAGE = [
  'Available commands:',
  '.<cmd> - short for /exec <cmd>',
  '/exec <cmd> - execute a command on the machine',
  '/create - create a new machine',
  '/destroy - destroy the machine',
  '/file <file> - read a file from the machine',
  '/env <key>=<value> - set an env var on the machine',
  '/test - test the machine (dev)',
  '/help - show help message',
].join('\n');

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
  private sandbox: DurableObjectNamespace<Sandbox>;

  constructor(db: ReturnType<typeof useDrizzle>, env: Env) {
    console.info('TelegramBot: Initializing bot...');
    this.db = db;
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
    this.bot.use(ignoreOld(60)); // 1 minute

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

  private getSandbox(ctx: MyContext) {
    const sandboxId = ctx.session.sandboxId
      ? ctx.session.sandboxId
      : `container-${ctx.chat?.id.toString()}`;
    return getSandbox(this.sandbox, sandboxId);
  }

  private setupHandlers() {
    console.info('TelegramBot: Setting up handlers...');

    // Start command - starts the bot
    this.bot.command('start', async ctx => await this.cmdStart(ctx));
    // Create command - creates a machine if one doesn't exist
    this.bot.command('create', async ctx => await this.cmdCreate(ctx));
    // Exec command - executes a command on the machine
    this.bot.command('exec', async ctx => await this.cmdExec(ctx));
    // Destroy command - destroys the machine
    this.bot.command('destroy', async ctx => await this.cmdDestroy(ctx));
    // File command - reads a file from the machine
    this.bot.command('file', async ctx => await this.cmdFile(ctx));
    // Env command - sets an env var on the machine
    this.bot.command('env', async ctx => await this.cmdEnv(ctx));
    // Help command - shows the help message
    this.bot.command('help', async ctx => await ctx.reply(HELP_MESSAGE));
    // Test command - tests the machine
    this.bot.command('test', async ctx => await this.cmdTest(ctx));
    // File received - uploads a file to the machine
    this.bot.on('message:file', async (ctx) => this.rcvFile(ctx));

    this.bot.on('message:text', async (ctx) => {
      if (!ctx.message?.text?.startsWith('.')) return
      await this.cmdExec(ctx);
    });

    this.bot.on('message:text', async (ctx) => {
      if (ctx.message?.text?.startsWith('.')) return
      await ctx.reply('echo: ' + ctx.message?.text);
    });

    this.bot.on('callback_query:data', async (ctx) => {
      await ctx.answerCallbackQuery();
    });
  }

  private async cmdStart(ctx: MyContext) {
    console.info(`TelegramBot: /start command received from user ${ctx.from?.id}`);

    try {
      // feedback
      await Promise.all([
        await ctx.react('🤔'),
        await ctx.reply(HELP_MESSAGE),
        await ctx.replyWithChatAction('typing'),
      ])

      // create sandbox
      const sandbox = this.getSandbox(ctx);
      await sandbox.exec('echo "Hello, world!"');
      await ctx.reply('your sandbox should be ready in a minute');
      await ctx.reply("try `.date` to see the time when it's ready", { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`TelegramBot: Error starting bot: ${error}`);
      await Promise.all([
        await ctx.react('🤷'),
        await ctx.reply(`failed to start bot: ${error instanceof Error ? error.message : String(error)}`)
      ]);
    }
  }

  private async cmdCreate(ctx: MyContext) {
    console.info(`TelegramBot: /create command received from user ${ctx.from?.id}`);

    try {
      await ctx.replyWithChatAction('typing');
      const sandbox = this.getSandbox(ctx);
      await sandbox.exec('echo "Hello, world!"');
      await ctx.reply('machine created successfully');
    } catch (error) {
      console.error(`TelegramBot: Error creating machine: ${error}`);
      await ctx.reply(`machine creation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cmdDestroy(ctx: MyContext) {
    console.info(`TelegramBot: /destroy command received from user ${ctx.from?.id}`);

    try {
      const sandbox = this.getSandbox(ctx);
      await sandbox.destroy();
      await ctx.reply('machine destroyed successfully');
    } catch (error) {
      console.error(`TelegramBot: Error destroying machine: ${error}`);
      await ctx.reply(`machine destruction failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cmdExec(ctx: MyContext) {
    console.info(`TelegramBot: /exec command received from user ${ctx.from?.id}`);

    let command: string | undefined = undefined;
    if (ctx.match) {
      command = ctx.match as string;
    }

    if (ctx.message?.text?.startsWith('.')) {
      command = ctx.message?.text?.slice(1);
    }

    if (!command) {
      await ctx.reply('provide a command');
      return;
    }

    try {
      await ctx.replyWithChatAction('typing');
      const sandbox = this.getSandbox(ctx);
      const result = await sandbox.exec(command);
      const output = result.stdout || result.stderr
      await ctx.reply(`output:\n\`\`\`\n${output.slice(0, 4000)}\n\`\`\``, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`TelegramBot: Error executing command: ${error}`);
      await ctx.reply(`command failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cmdFile(ctx: MyContext) {
    console.info(`TelegramBot: /files command received from user ${ctx.from?.id}`);

    const file = ctx.match as string;
    if (!file) {
      await ctx.reply('provide a file');
      return;
    }

    try {
      const sandbox = this.getSandbox(ctx);
      const result = await sandbox.readFileStream(file);
      await ctx.replyWithDocument(new InputFile(result, file));
    } catch (error) {
      console.error(`TelegramBot: Error reading file: ${error}`);
      await ctx.reply(`file reading failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cmdEnv(ctx: MyContext) {
    console.info(`TelegramBot: /env command received from user ${ctx.from?.id}`);

    const [key, value] = (ctx.match as string)?.split('=', 2) ?? [];

    if (!key?.trim()) {
      await ctx.reply('provide a key');
      return;
    }

    if (!value?.trim()) {
      await ctx.reply('provide a value');
      return;
    }

    try {
      const sandbox = this.getSandbox(ctx);
      await sandbox.setEnvVars({ [key.trim()]: value.trim() });
      await ctx.reply(`env var set successfully`);
    } catch (error) {
      console.error(`TelegramBot: Error setting env var: ${error}`);
      await ctx.reply(`env var setting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async cmdTest(ctx: MyContext) {
    console.info(`TelegramBot: /test command received from user ${ctx.from?.id}`);
    await ctx.reply('match: ' + ctx.match);
  }

  private async rcvFile(ctx: MyContext) {
    console.info(`TelegramBot: File received from user ${ctx.from?.id}`);

    try {
      const file = await ctx.getFile();
      const sandbox = this.getSandbox(ctx);
      const response = await fetch(`https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`);
      const body = await response.text()
      if (!body) throw new Error('Failed to read file');
      await sandbox.writeFile('telegramfile', body);
      await ctx.reply(`file uploaded successfully`);
    } catch (error) {
      console.error(`TelegramBot: Error uploading file: ${error}`);
      await ctx.reply(`file uploading failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
