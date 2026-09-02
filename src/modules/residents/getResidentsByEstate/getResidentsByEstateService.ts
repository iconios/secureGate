// Get Residents By Estate Service
/*
#Plan:
1. Get and validate user id and estate id
2. Verify user id is associated with estate id
3. Get the ids and names of all other estates associated with the user id
4. Get resident overview data for the requested estate only:
    - total residents
    - total principal residents
    - total assistants
    - total members
5. Get paginated resident records for the requested estate only:
   - resident code
   - household code
   - unit number
   - block or street
   - role
   - household principal resident full name
   - resident:
    - full name
    - email
    - phone
    - photoUrl
    - date of birth
    - gender
    - gate entry
    - guest pre-authorization
    - vehicle registration
    - emergency alert access
    - access method
        - mobile app
        - RFID key card
        - biometric (finger-print)
        - vehicle tag
        - numeric access code
    - access schedule
        - always active
        - custom hours
        - public holidays
6. Return a consistent response:
   - estateId
   - estateName
   - all estates ids and names associated with the user id
   - summary
   - residents
   - pagination
*/

import { and, eq, or, ilike, count, asc, inArray } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { estates } from '../../../db/schema/estates.js';
import { households } from '../../../db/schema/households.js';
import { persons } from '../../../db/schema/persons.js';
import { residents } from '../../../db/schema/residents.js';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { AppError } from '../../../common/errors/appError.js';
import { getResidentsByEstateSchema, getResidentsByEstateType } from '../residents.types.js';
import { userAccessMethods } from '../../../db/schema/userAccessMethods.js';
import { accessMethods } from '../../../db/schema/accessMethods.js';
import { accessSchedules } from '../../../db/schema/accessSchedules.js';
import { accessTimeSlots } from '../../../db/schema/accessTimeSlots.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';

export const getResidentsByEstateService = async (getResidentsInput: getResidentsByEstateType) => {
  const residentLogs = logger.child({
    service: 'getResidentsByEstateService',
    requestId: randomUUID(),
  });

  // 1. Get and validate user id and estate id
  const validatedInput = getResidentsByEstateSchema.parse(getResidentsInput);
  const { estateId, userId, page, pageSize, searchTerm } = validatedInput;

  const safePage = Math.max(page ?? 1, 1);
  const safePageSize = Math.min(Math.max(pageSize ?? 10, 1), 100);
  const offset = (safePage - 1) * safePageSize;

  const normalizedSearchTerm = searchTerm?.trim() ?? '';
  const searchPattern = `%${normalizedSearchTerm}%`;

  const residentSearchWhere = normalizedSearchTerm
    ? and(
        eq(residents.estateId, estateId),
        or(
          ilike(residents.code, searchPattern),
          ilike(households.code, searchPattern),
          ilike(households.unitNumber, searchPattern),
          ilike(households.blockOrStreet, searchPattern),
          ilike(persons.fullName, searchPattern),
          ilike(persons.email, searchPattern),
          ilike(persons.phone, searchPattern),
        ),
      )
    : eq(residents.estateId, estateId);

  const matchingResidents = db
    .selectDistinct({
      id: residents.id,
    })
    .from(residents)
    .leftJoin(persons, eq(residents.personId, persons.id))
    .leftJoin(households, eq(households.id, residents.householdId))
    .where(residentSearchWhere)
    .as('matching_residents');

  // 2. Verify user id is associated with estate id
  const [userEstateData] = await db
    .select({
      id: estateManagers.id,
      name: estates.name,
    })
    .from(estateManagers)
    .where(and(eq(estateManagers.managerId, userId), eq(estateManagers.estateId, estateId)))
    .innerJoin(estates, eq(estates.id, estateId))
    .limit(1);

  if (!userEstateData) {
    residentLogs.warn('User not associated with the estate', {
      estateId: estateId,
      managerId: userId,
    });

    throw new AppError(
      403,
      'ACCESS_DENIED',
      'User not associated with the estate',
      'User not associated with the estate',
    );
  }

  // 3. Fetch the ids and names of all other estates associated with the user id
  const allUserEstates = await db
    .select({
      id: estates.id,
      name: estates.name,
    })
    .from(estateManagers)
    .where(eq(estateManagers.managerId, userId))
    .innerJoin(estates, eq(estates.id, estateManagers.estateId));

  // 4. Get residents overview data for the requested estate only:
  // - total residents
  // - total principal residents
  // - total assistants
  // - total members
  const [totalResidentsRows, totalPrincipalsRows, totalAssistantsRows, totalMembersRows] =
    await Promise.all([
      db
        .select({
          count: count(),
        })
        .from(matchingResidents),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingResidents, eq(residents.id, matchingResidents.id))
        .where(eq(residents.role, 'principal')),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingResidents, eq(residents.id, matchingResidents.id))
        .where(eq(residents.role, 'assistant')),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingResidents, eq(residents.id, matchingResidents.id))
        .where(eq(residents.role, 'member')),
    ]);
  const totalResidents = Number(totalResidentsRows[0]?.count ?? 0);
  const totalPrincipals = Number(totalPrincipalsRows[0]?.count ?? 0);
  const totalAssistants = Number(totalAssistantsRows[0]?.count ?? 0);
  const totalMembers = Number(totalMembersRows[0]?.count ?? 0);

  // Count total household rows for pagination.
  const totalItems = totalResidents;

  const totalPages = Math.ceil(totalItems / safePageSize);

  // 5. Get paginated resident records for the requested estate only:
  const householdsPrincipalResidents = await db
    .select({
      householdId: households.id,
      residentId: residents.id,
      fullName: persons.fullName,
    })
    .from(residents)
    .innerJoin(persons, eq(persons.id, residents.personId))
    .innerJoin(households, eq(households.id, residents.householdId))
    .where(
      and(
        inArray(residents.id, matchingResidents.id),
        eq(residents.role, 'principal'),
        eq(residents.estateId, estateId),
      ),
    );

  const principalMapEntries = new Map();

  householdsPrincipalResidents.forEach((resident) => {
    const key = resident.householdId;
    const value = {
      ...resident,
    };

    if (!principalMapEntries.has(key)) {
      principalMapEntries.set(key, []);
    }

    principalMapEntries.get(key).push(value);
  });

  const residentsAccessMethods = await db
    .select({
      id: userAccessMethods.id,
      name: accessMethods.name,
      residentId: userAccessMethods.residentId,
    })
    .from(userAccessMethods)
    .innerJoin(
      residents,
      and(inArray(residents.id, matchingResidents.id), eq(residents.estateId, estateId)),
    )
    .leftJoin(accessMethods, eq(userAccessMethods.accessMethodId, accessMethods.id))
    .where(eq(userAccessMethods.residentId, residents.id));

  const residentMapEntries = new Map();

  residentsAccessMethods.forEach((resident) => {
    const key = resident.residentId;
    const value = resident.name;

    if (!residentMapEntries.has(key)) {
      residentMapEntries.set(key, []);
    }

    residentMapEntries.get(key).push(value);
  });

  const residentsAccessSchedules = await db
    .select({
      residentId: accessSchedules.residentId,
      scheduleId: accessSchedules.id,
      type: accessSchedules.scheduleType,
      allowPublicHolidays: accessSchedules.allowPublicHolidays,
      dayOfWeek: accessTimeSlots.dayOfWeek,
      startTime: accessTimeSlots.startTime,
      endTime: accessTimeSlots.endTime,
    })
    .from(accessSchedules)
    .leftJoin(accessTimeSlots, eq(accessTimeSlots.accessScheduleId, accessSchedules.id))
    .where(inArray(accessSchedules.residentId, matchingResidents.id));

  const residentScheduleEntries = new Map();

  residentsAccessSchedules.forEach((resident) => {
    const key = resident.residentId;
    const value = {
      ...resident,
      timeSlots: [
        {
          dayOfWeek: resident.dayOfWeek,
          startTime: resident.startTime,
          endTime: resident.endTime,
        },
      ],
    };

    if (!residentScheduleEntries.has(key)) {
      residentScheduleEntries.set(key, []);
    }

    residentScheduleEntries.get(key).push(value);
  });

  const residentsRows = await db
    .select({
      id: residents.id,
      householdId: households.id,
      householdCode: households.code,
      unitNumber: households.unitNumber,
      blockOrStreet: households.blockOrStreet,
      residentCode: residents.code,
      role: residents.role,
      fullName: persons.fullName,
      email: persons.email,
      phone: persons.phone,
      photoUrl: persons.photoUrl,
      dateOfBirth: persons.dateOfBirth,
      gender: persons.gender,
      gateEntry: residents.gateEntry,
      guestPreAuthorize: residents.guestPreAuthorize,
      vehicleRegistration: residents.vehicleRegistration,
      emergencyAlert: residents.emergencyAlert,
    })
    .from(residents)
    .leftJoin(households, eq(households.id, residents.householdId))
    .leftJoin(persons, eq(residents.personId, persons.id))
    .where(residentSearchWhere)
    .orderBy(asc(households.unitNumber), asc(households.id))
    .limit(safePageSize)
    .offset(offset);

  // If there are no residents, still return success.
  if (residentsRows.length === 0) {
    residentLogs.info('Residents data fetched successfully with zero residents', {
      estateId: estateId,
      managerId: userId,
      allEstatesCount: allUserEstates.length,
    });
    return successResponseHelper('Residents data fetched successfully with zero residents', {
      estateId,
      estateName: userEstateData.name,
      allEstates: allUserEstates,
      summary: {
        residentsTotal: totalResidents,
        principalsTotal: totalPrincipals,
        assistantsTotal: totalAssistants,
        membersTotal: totalMembers,
      },
      residents: [],
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
      },
      searchTerm,
    });
  }

  // 6. Return a consistent response:
  //    - estateId
  //    - estateName
  //    - all estates ids and names associated with the user id
  //    - summary
  //    - residents
  //    - pagination

  // Format resident rows
  const formattedResidents = residentsRows.map((resident) => ({
    ...resident,
    principalResident: principalMapEntries.get(resident.householdId) ?? [],
    accessMethods: residentMapEntries.get(resident.id) ?? [],
    accessSchedule: residentScheduleEntries.get(resident.id) ?? [],
  }));

  residentLogs.info('Residents data fetched successfully', {
    estateId: estateId,
    managerId: userId,
    allEstatesCount: allUserEstates.length,
  });
  return successResponseHelper('Residents data fetched successfully', {
    estateId: estateId,
    estateName: userEstateData.name,
    allEstates: allUserEstates,
    summary: {
      residentsTotal: totalResidents,
      principalsTotal: totalPrincipals,
      assistantsTotal: totalAssistants,
      membersTotal: totalMembers,
    },
    residents: formattedResidents,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages,
    },
    searchTerm,
  });
};
