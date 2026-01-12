import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  strict: true,
  verbose: true,
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
