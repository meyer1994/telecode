import { Bot } from "grammy";

const main = async () => {  
  const bot = new Bot(process.env.NITRO_BOT_TOKEN as string);
  console.log('Setting my commands...');
  const commands = await bot.api.setMyCommands([
    { command: "exec", description: "execute a command on the machine" },
    { command: "create", description: "create a new machine" },
    { command: "destroy", description: "destroy the machine" },
    { command: "test", description: "test the machine (dev)" },
    { command: "help", description: "show help message" },
    { command: "file", description: "read a file from the machine" },
    { command: "env", description: "set an env var on the machine" },
  ]);
  console.log('Commands set', commands);
};

main();