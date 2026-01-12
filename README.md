# Infinite Buttons Telegram Bot

A discovery game Telegram bot built with Nitro and Cloudflare Workers. Users
explore a tree of "buttons" (items) where new branches are generated on-the-fly
using Cloudflare AI.

## Tech Stack

- **Framework**: [Nitro](https://nitro.build/) (Cloudflare Module preset)
- **Bot Framework**: [grammY](https://grammy.dev/)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) with
  [Drizzle ORM](https://orm.drizzle.team/)
- **AI**: [Cloudflare AI](https://developers.cloudflare.com/ai/) (using Llama
  3.3)
- **Deployment**: [Cloudflare Workers](https://workers.cloudflare.com/)

## Configuration

The bot requires the following environment variables. In production, these
should be set as Cloudflare secrets.

- `NITRO_BOT_TOKEN`: Your Telegram Bot API token from
  [@BotFather](https://t.me/BotFather).
- `NITRO_BOT_INFO`: A JSON string representing the bot's info (output of
  `bot.api.getMe()`).

## Commands

### Development

```bash
# Install dependencies
pnpm install

# Start Nitro in development mode
pnpm dev

# Local preview with Wrangler (Cloudflare environment)
pnpm preview
```

### Database

```bash
# Generate Drizzle migrations
pnpm cf:db:generate

# Apply migrations to the Cloudflare D1 database (remote)
pnpm cf:db:migrate
```

### Deployment

```bash
# Typecheck, build, and deploy to Cloudflare
pnpm cf:deploy
```

### Linting

```bash
# Run ESLint
pnpm lint

# Fix linting issues
pnpm lint:fix
```

## Project Structure

- `server/routes/tlg.ts`: Webhook handler for Telegram updates.
- `server/utils/telegram.ts`: Core bot logic, menus, and interaction handlers.
- `server/utils/ai.ts`: Item generation logic using Cloudflare AI.
- `server/db/schema.ts`: Drizzle database schema definitions.
- `wrangler.jsonc`: Cloudflare Workers configuration (D1 and AI bindings).
