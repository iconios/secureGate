import 'dotenv/config';
import { seedAccessMethods } from './seeds/accessMethods.seed.js';
import { seedSubscriptionPlans } from './seeds/subscriptionPlans.seed.js';

const seed = async () => {
  try {
    console.log('Starting database seed...');

    await seedAccessMethods();
    await seedSubscriptionPlans();

    console.log('Database seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Database seed failed:', error);
    process.exit(1);
  }
};

await seed();
