import { check, index, pgTable, time, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { accessSchedules } from './accessSchedules.js';
import { sql } from 'drizzle-orm';
import { dayOfWeekEnum } from './accessScheduleEnums.js';

export const accessTimeSlots = pgTable(
  'access_time_slots',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),

    accessScheduleId: uuid('access_schedule_id')
      .notNull()
      .references(() => accessSchedules.id, {
        onDelete: 'cascade',
        onUpdate: 'cascade',
      }),

    dayOfWeek: dayOfWeekEnum('day_of_week').notNull(),

    startTime: time('start_time').notNull(),

    endTime: time('end_time').notNull(),

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
  (table) => [
    uniqueIndex('access_time_slots_unique_slot_uidx').on(
      table.accessScheduleId,
      table.dayOfWeek,
      table.startTime,
      table.endTime,
    ),
    index('access_time_slots_schedule_day_idx').on(table.accessScheduleId, table.dayOfWeek),
    check('access_time_slots_time_order_check', sql`${table.endTime} > ${table.startTime}`),
  ],
).enableRLS();
