import { pgTable, uuid, timestamp, text } from 'drizzle-orm/pg-core';

export const activityLogs = pgTable('activity_logs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  timestamp: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
  managerId: uuid('manager_id'),
  estateId: uuid('estate_id'),
  action: text(),
  deviceInfo: text('device_info'),
  previousValue: text('previous_value'),
  newValue: text('new_value'),
  ipAddress: text('ip_address'),
  entityType: text('entity_type'),
  residentId: uuid('resident_id'),
  guardId: uuid('guard_id'),
}).enableRLS();
