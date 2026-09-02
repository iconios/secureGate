import { boolean, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { residents } from './residents.js';
import { scheduleTypeEnum } from './accessScheduleEnums.js';

export const accessSchedules = pgTable(
  'access_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    residentId: uuid('resident_id')
      .notNull()
      .references(() => residents.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    scheduleType: scheduleTypeEnum('schedule_type').default('always_active').notNull(),

    allowPublicHolidays: boolean('allow_public_holidays').default(false).notNull(),

    createdAt: timestamp('created_at', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp('updated_at', {
      withTimezone: true,
      mode: 'string',
    })
      .defaultNow()
      .$onUpdate(() => new Date().toISOString())
      .notNull(),
  },
  (table) => [uniqueIndex('access_schedules_resident_id_uidx').on(table.residentId)],
).enableRLS();
