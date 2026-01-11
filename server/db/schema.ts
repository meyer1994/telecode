import { relations, sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const TMessages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  message: text('message').notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`)
    .default(sql`CURRENT_TIMESTAMP`),
});

export const RMessages = relations(TMessages, () => ({}));
