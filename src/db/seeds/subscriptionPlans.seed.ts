import db from '../index.js';
import { subscriptionPlans } from '../schema/subscriptionPlans.js';

const subscriptionPlansSeedData = [
  {
    description: 'Small community or boutique residential complex.',
    name: 'Starter',
    householdLimit: 50,
    status: 'active',
    pricePerPeriod: '50000',
    monthlyFee: '7500',
    yearlyFee: '75000',
  },
  {
    description: 'Ideal for growing estates and mid-sized communities.',
    name: 'Growing',
    householdLimit: 100,
    status: 'active',
    pricePerPeriod: '100000',
    monthlyFee: '12500',
    yearlyFee: '125000',
  },
  {
    description: 'Perfect for standard residential developments.',
    name: 'Standard',
    householdLimit: 150,
    status: 'active',
    pricePerPeriod: '150000',
    monthlyFee: '17500',
    yearlyFee: '175000',
  },
  {
    description: 'Recommended for large multi-family estates.',
    name: 'Large',
    householdLimit: 200,
    status: 'active',
    pricePerPeriod: '200000',
    monthlyFee: '25000',
    yearlyFee: '250000',
  },
  {
    description: 'Enterprise scale for sprawling gated communities.',
    name: 'Enterprise',
    householdLimit: 500,
    status: 'active',
    pricePerPeriod: '500000',
    monthlyFee: '100000',
    yearlyFee: '1000000',
  },
] satisfies Array<typeof subscriptionPlans.$inferInsert>;

export const seedSubscriptionPlans = async () => {
  await db.insert(subscriptionPlans).values(subscriptionPlansSeedData).onConflictDoNothing();

  console.log('Subscription plans seeded successfully');
};
