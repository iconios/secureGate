// Fetch Households By Estate Service
/*
#Plan:
1. Get and validate user id and estate id
2. Verify user id is associated with estate id
3. Fetch the ids and names of all other estates associated with the user id
4. Fetch household overview data for the requested estate only:
    - total households
    - total members
    - total assistants
5. Fetch paginated household records for the requested estate only:
   - household code
   - unit number
   - principal resident summary
   - member count
   - assistant count
6. Return a consistent response:
   - estateId
   - estateName
   - all estates ids and names associated with the user id
   - summary
   - households
   - pagination
*/

import { and, asc, count, eq, ilike, inArray, or } from 'drizzle-orm';
import db from '../../../db/index.js';
import { estateManagers } from '../../../db/schema/estateManagers.js';
import { errorResponseHelper } from '../../../utils/errorResponseHelper.js';
import { households } from '../../../db/schema/households.js';
import { residents } from '../../../db/schema/residents.js';
import { persons } from '../../../db/schema/persons.js';
import { successResponseHelper } from '../../../utils/successResponseHelper.js';
import { FetchHouseholdsByEstateSchema, FetchHouseholdsByEstateType } from '../households.types.js';
import { ZodError } from 'zod';
import logger from '../../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { estates } from '../../../db/schema/estates.js';

export const fetchHouseholdsByEstateService = async (
  fetchHouseholdsInput: FetchHouseholdsByEstateType,
) => {
  const householdLogs = logger.child({
    service: 'fetchHouseholdsByEstateService',
    requestId: randomUUID(),
  });

  try {
    // 1. Get and validate user id and estate id
    const validatedInput = FetchHouseholdsByEstateSchema.parse(fetchHouseholdsInput);
    const { estateId, userId, page, pageSize, searchTerm } = validatedInput;

    const safePage = Math.max(page ?? 1, 1);
    const safePageSize = Math.min(Math.max(pageSize ?? 10, 1), 100);
    const offset = (safePage - 1) * safePageSize;

    const normalizedSearchTerm = searchTerm?.trim() ?? '';
    const searchPattern = `%${normalizedSearchTerm}%`;

    const householdSearchWhere = normalizedSearchTerm
      ? and(
          eq(households.estateId, estateId),
          or(
            ilike(households.code, searchPattern),
            ilike(households.unitNumber, searchPattern),
            ilike(households.blockOrStreet, searchPattern),
            ilike(persons.fullName, searchPattern),
            ilike(persons.email, searchPattern),
            ilike(persons.phone, searchPattern),
          ),
        )
      : eq(households.estateId, estateId);

    const matchingHouseholds = db
      .selectDistinct({
        id: households.id,
      })
      .from(households)
      .leftJoin(
        residents,
        and(eq(residents.householdId, households.id), eq(residents.role, 'principal')),
      )
      .leftJoin(persons, eq(residents.personId, persons.id))
      .where(householdSearchWhere)
      .as('matching_households');

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
      householdLogs.warn('User not associated with the estate', {
        estateId: estateId,
        managerId: userId,
      });
      return errorResponseHelper(
        'User not associated with the estate',
        'ACCESS_DENIED',
        `${householdLogs.defaultMeta?.requestId}`,
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

    // 4. Fetch household overview data for the requested estate only:
    //    - total households
    //    - total members
    //    - total assistants
    const [totalHouseholdsRows, totalResidentsRow, totalAssistantsRows] = await Promise.all([
      db
        .select({
          count: count(),
        })
        .from(matchingHouseholds),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingHouseholds, eq(residents.householdId, matchingHouseholds.id)),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingHouseholds, eq(residents.householdId, matchingHouseholds.id))
        .where(eq(residents.role, 'assistant')),

      db
        .select({
          count: count(),
        })
        .from(residents)
        .innerJoin(matchingHouseholds, eq(residents.householdId, matchingHouseholds.id))
        .where(eq(residents.estateId, estateId)),
    ]);
    const totalHouseholds = Number(totalHouseholdsRows[0]?.count ?? 0);
    const totalResidents = Number(totalResidentsRow[0]?.count ?? 0);
    const totalAssistants = Number(totalAssistantsRows[0]?.count ?? 0);

    // Count total household rows for pagination.
    const totalItems = totalHouseholds;

    const totalPages = Math.ceil(totalItems / safePageSize);

    // 5. Fetch paginated household records for the requested estate only:
    //    - household code
    //    - unit number
    //    - principal resident summary
    //    - resident count
    //    - assistant count
    const householdRows = await db
      .select({
        id: households.id,
        code: households.code,
        unitNumber: households.unitNumber,
        blockOrStreet: households.blockOrStreet,

        principalResidentPersonId: persons.id,
        principalResidentResidentId: residents.id,
        principalResidentFullName: persons.fullName,
        principalResidentPhotoUrl: persons.photoUrl,
        principalResidentPhone: persons.phone,
        principalResidentEmail: persons.email,
        principalResidentGender: persons.gender,
        principalResidentDateOfBirth: persons.dateOfBirth,

        mobileAccess: households.mobileAccess,
        guestPreAuthorize: households.guestPreAuthorize,
        guestArrivalNotify: households.guestArrivalNotify,
        emergencyAlerts: households.emergencyAlerts,
      })
      .from(households)
      .leftJoin(
        residents,
        and(eq(residents.householdId, households.id), eq(residents.role, 'principal')),
      )
      .leftJoin(persons, eq(residents.personId, persons.id))
      .where(householdSearchWhere)
      .orderBy(asc(households.unitNumber), asc(households.id))
      .limit(safePageSize)
      .offset(offset);

    const householdIds = householdRows.map((household) => household.id);

    // If there are no households, still return success.
    if (householdRows.length === 0) {
      householdLogs.info('Households data fetched successfully with zero households', {
        estateId: estateId,
        managerId: userId,
        allEstatesCount: allUserEstates.length,
      });
      return successResponseHelper('Households data fetched successfully with zero households', {
        estateId,
        estateName: userEstateData.name,
        allEstates: allUserEstates,
        summary: {
          householdsTotal: totalHouseholds,
          residentsTotal: totalResidents,
          assistantsTotal: totalAssistants,
        },
        households: [],
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
    //    - summary
    //    - households
    //    - pagination

    // Fetch member counts for households on this page
    const memberCountRows = await db
      .select({
        householdId: residents.householdId,
        count: count(),
      })
      .from(residents)
      .where(and(inArray(residents.householdId, householdIds), eq(residents.role, 'member')))
      .groupBy(residents.householdId);

    // Fetch assistant counts for households on this page.
    const assistantCountRows = await db
      .select({
        householdId: residents.householdId,
        count: count(),
      })
      .from(residents)
      .where(and(inArray(residents.householdId, householdIds), eq(residents.role, 'assistant')))
      .groupBy(residents.householdId);

    // Fetch residents counts for households on this page.
    const residentsCountRows = await db
      .select({
        householdId: residents.householdId,
        count: count(),
      })
      .from(residents)
      .where(inArray(residents.householdId, householdIds))
      .groupBy(residents.householdId);

    // Convert rows into lookup maps.
    const memberCountMap = new Map(
      memberCountRows.map((row) => [row.householdId, Number(row.count)]),
    );

    const assistantCountMap = new Map(
      assistantCountRows.map((row) => [row.householdId, Number(row.count)]),
    );

    const residentsCountMap = new Map(
      residentsCountRows.map((row) => [row.householdId, Number(row.count)]),
    );

    // Format household rows
    const formattedHouseholds = householdRows.map((household) => ({
      id: household.id,
      code: household.code,
      unitNumber: household.unitNumber,
      blockOrStreet: household.blockOrStreet,
      principalResident: household.principalResidentPersonId
        ? {
            id: household.principalResidentPersonId,
            residentId: household.principalResidentResidentId,
            fullName: household.principalResidentFullName,
            photoUrl: household.principalResidentPhotoUrl ?? '',
            phone: household.principalResidentPhone ?? '',
            email: household.principalResidentEmail ?? '',
            gender: household.principalResidentGender,
            dateOfBirth: household.principalResidentDateOfBirth,
          }
        : null,
      mobileAccess: household.mobileAccess,
      guestPreAuthorize: household.guestPreAuthorize,
      guestArrivalNotify: household.guestArrivalNotify,
      emergencyAlerts: household.emergencyAlerts,
      memberCount: memberCountMap.get(household.id) ?? 0,
      assistantCount: assistantCountMap.get(household.id) ?? 0,
      residentsTotal: residentsCountMap.get(household.id) ?? 0,
    }));

    householdLogs.info('Households data fetched successfully', {
      estateId: estateId,
      managerId: userId,
      allEstatesCount: allUserEstates.length,
    });
    return successResponseHelper('Households data fetched successfully', {
      estateId: estateId,
      estateName: userEstateData.name,
      allEstates: allUserEstates,
      summary: {
        householdsTotal: totalHouseholds,
        residentsTotal: totalResidents,
        assistantsTotal: totalAssistants,
      },
      households: formattedHouseholds,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        totalItems,
        totalPages,
      },
      searchTerm,
    });
  } catch (error: unknown) {
    const errMessage =
      error instanceof Error ? error.message : 'Error fetching households data by estate';
    if (error instanceof ZodError) {
      householdLogs.error('Error validating households data', {
        error: error.issues,
      });

      return errorResponseHelper(
        'Error validating households data',
        'VALIDATION_ERROR',
        `${householdLogs.defaultMeta?.requestId}`,
        error,
      );
    }

    householdLogs.error('Unexpected error while processing households data', {
      message: errMessage,
      error,
    });

    return errorResponseHelper(
      'Unexpected error while processing households data',
      'UNEXPECTED_ERROR',
      `${householdLogs.defaultMeta?.requestId}`,
      error,
    );
  }
};
