// Create estate service
/* 
Plan:
1. Accept and validate estate registration data (estate manager ID, estate name, etc.)
2. Create a new estate record in the estates table with status 'inactive' and payment status to 'pending'
3. Send the estate details to the service caller
*/

import { ZodError } from 'zod';
import { EstateInsert, EstateInsertSchema } from './estate.types.js';
import { supabaseAdmin } from '../../common/supabase/supabase.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';

const CreateEstateService = async (newEstateData: EstateInsert) => {
  const isDev = process.env.NODE_ENV === 'development';

  const estateLogs = logger.child({
    service: 'CreateEstateService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate estate registration data (estate manager ID, estate name, etc.)
    const validatedData = EstateInsertSchema.parse(newEstateData);

    // 2. Create a new estate record in the estates table with status 'inactive' and payment status to 'pending'
    const { data, error } = await supabaseAdmin
      .from('estates')
      .insert({
        ...validatedData,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      estateLogs.error('Failed to create estate', {
        ...validatedData,
      });
      return errorResponseHelper(
        'Failed to create estate',
        'DATABASE_ERROR',
        'Error inserting estate into database',
        error,
      );
    }

    // 3. Send the estate details to the service caller
    return successResponseHelper('Estate created successfully', data);
  } catch (error) {
    if (isDev) {
      console.error('CreateEstateService error:', error);
    }

    if (error instanceof ZodError) {
      return errorResponseHelper(
        'Estate data validation error',
        'VALIDATION_ERROR',
        'Event data validation error',
        error,
      );
    }

    return errorResponseHelper(
      'Internal server error',
      'INTERNAL_ERROR',
      'Unexpected error while creating estate',
      error,
    );
  }
};

export default CreateEstateService;
