// DB Maintenance Api Key Authentication Service
/*
#Plan:
1. Accept and validate the API Key value
2. Get the stored maintenance key
3. If no key exists, initialise it from environment variable
4. If it's not null, compare the received api key value with stored value
5. Send response to caller
*/

import { eq } from 'drizzle-orm';
import db from '../../db/index.js';
import { configurationKeys } from '../../db/schema/configurationKeys.js';
import { errorResponseHelper } from '../../utils/errorResponseHelper.js';
import { successResponseHelper } from '../../utils/successResponseHelper.js';
import logger from '../../common/winston/logger.js';
import { randomUUID } from 'crypto';
import { compareString, hashString } from '../../utils/hashHelper.js';

const DB_MAINTENANCE_KEY_NAME = 'dbMaintenanceApiKey';

export const dbMaintenanceApiKeyAuthenticationService = async (apiKey: string) => {
  const dbMaintenanceLogs = logger.child({
    service: 'dbMaintenanceApiKeyAuthenticationService',
    requestId: randomUUID(),
  });

  try {
    // 1. Accept and validate the API Key
    const receivedApiKey = apiKey?.trim();

    if (!receivedApiKey) {
      dbMaintenanceLogs.warn('Api key missing in db maintenance request');
      return errorResponseHelper('Api key required', 'API_KEY_NOT_FOUND', 'Api key required');
    }

    // 2. Get the stored maintenance key
    const [apiKeyData] = await db
      .select({
        id: configurationKeys.id,
        key: configurationKeys.key,
        value: configurationKeys.value,
      })
      .from(configurationKeys)
      .where(eq(configurationKeys.key, DB_MAINTENANCE_KEY_NAME));

    let storedApiKeyHash = apiKeyData?.value;

    // 3. If no key exists, initialise it from environment variable
    if (!storedApiKeyHash) {
      const dbMaintenanceApiKey = process.env.DB_MAINTENANCE_KEY?.trim();

      if (!dbMaintenanceApiKey) {
        dbMaintenanceLogs.error('Database maintenance api access key cannot be empty');

        return errorResponseHelper(
          'Maintenance api key is not configured',
          'MAINTENANCE_API_KEY_NOT_CONFIGURED',
          'Maintenance api key is not configured',
        );
      }

      storedApiKeyHash = await hashString(dbMaintenanceApiKey);
      if (apiKeyData?.id) {
        await db
          .update(configurationKeys)
          .set({
            value: storedApiKeyHash,
            description: 'Api access key for the database maintenance',
          })
          .where(eq(configurationKeys.id, apiKeyData.id));
      } else {
        await db.insert(configurationKeys).values({
          value: storedApiKeyHash,
          key: DB_MAINTENANCE_KEY_NAME,
          description: 'Api access key for the database maintenance',
        });
      }
    }

    // 4. Compare the received api key value with stored value
    const isApiKeyValueMatch = await compareString(receivedApiKey, storedApiKeyHash);

    if (!isApiKeyValueMatch) {
      dbMaintenanceLogs.warn('Invalid db maintenance api key');

      return errorResponseHelper(
        'Access denied. Api key incorrect',
        'ACCESS_DENIED',
        'Access denied. Api key incorrect',
      );
    }
    // 5. Send response to caller
    dbMaintenanceLogs.info('Database maintenance api successfully authenticated');
    return successResponseHelper('Database maintenance api successfully authenticated');
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : 'Unknown error while authenticating db maintenance api key';

    dbMaintenanceLogs.error('Failed to authenticate db maintenance api key', {
      message: errorMessage,
      error,
    });

    return errorResponseHelper(
      'Failed to authenticate db maintenance api key',
      'UNKNOWN_ERROR',
      'Failed to authenticate db maintenance api key',
      error,
    );
  }
};
