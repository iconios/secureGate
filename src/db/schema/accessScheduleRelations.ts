import { relations } from 'drizzle-orm';
import { accessSchedules } from './accessSchedules.js';
import { residents } from './residents.js';
import { accessTimeSlots } from './accessTimeSlots.js';

export const accessSchedulesRelations = relations(accessSchedules, ({ one, many }) => ({
  resident: one(residents, {
    fields: [accessSchedules.residentId],
    references: [residents.id],
  }),

  timeSlots: many(accessTimeSlots),
}));

export const accessTimeSlotsRelations = relations(accessTimeSlots, ({ one }) => ({
  accessSchedules: one(accessSchedules, {
    fields: [accessTimeSlots.accessScheduleId],
    references: [accessSchedules.id],
  }),
}));
