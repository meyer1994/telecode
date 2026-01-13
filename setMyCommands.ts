import { Bot } from "grammy";

const main = async () => {  
  const bot = new Bot(process.env.NITRO_BOT_TOKEN as string);
  console.log('Setting my commands...');
  const commands = await bot.api.setMyCommands([
    { command: "exec", description: "Execute a command" },
    { command: "create", description: "Create new machine" },
    { command: "destroy", description: "Destroy the machine" },
  ]);
  console.log('Commands set', commands);
};

main();