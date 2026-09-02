import { pgEnum } from 'drizzle-orm/pg-core';

export const scheduleTypeEnum = pgEnum('schedule_type', ['always_active', 'custom_hours']);

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);
