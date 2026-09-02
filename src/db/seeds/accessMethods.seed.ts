import db from '../index.js';
import { accessMethods } from '../schema/accessMethods.js';

const accessMethodSeedData = [
  {
    methodKey: 'mobile_app',
    name: 'Mobile App',
    description: 'Access through the resident mobile application',
    isActive: true,
  },
  {
    methodKey: 'rfid_key_card',
    name: 'RFID Keycard',
    description: 'Access using an RFID-enabled keycard',
    isActive: true,
  },
  {
    methodKey: 'biometric',
    name: 'Biometric (Fingerprint)',
    description: 'Access using registered biometric information',
    isActive: true,
  },
  {
    methodKey: 'vehicle_tag',
    name: 'Vehicle Tag (Long-range RFID)',
    description: 'Vehicle access using a registered RFID tag',
    isActive: true,
  },
  {
    methodKey: 'numeric_access_code',
    name: 'Numeric Access Code',
    description: 'Access using a numeric PIN',
    isActive: true,
  },
] satisfies Array<typeof accessMethods.$inferInsert>;

export const seedAccessMethods = async () => {
  await db.insert(accessMethods).values(accessMethodSeedData).onConflictDoNothing({
    target: accessMethods.methodKey,
  });

  console.log('Access methods seeded successfully');
};
