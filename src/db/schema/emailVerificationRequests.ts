import { pgTable, uuid, timestamp, text, smallint } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const emailVerificationRequests = pgTable('email_verification_requests', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  email: text().notNull(),
  purpose: text(),
  codeHash: text('code_hash'),
  status: text(),
  sentCount: smallint('sent_count').default(sql`'0'`),
  lastSentAt: timestamp('last_Sent_at', { withTimezone: true, mode: 'string' }),
  nextAllowedAt: timestamp('next_allowed_at', { withTimezone: true, mode: 'string' }),
  windowStartedAt: timestamp('window_started_at', { withTimezone: true, mode: 'string' }),
  windowExpiresAt: timestamp('window_expires_at', { withTimezone: true, mode: 'string' }),
  codeExpiresAt: timestamp('code_expires_at', { withTimezone: true, mode: 'string' }),
  usedAt: timestamp('used_at', { withTimezone: true, mode: 'string' }),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }),
});
