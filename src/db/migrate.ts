import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const runMigration = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is missing!');
  }

  // Max 1 connection for migrations
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(migrationClient);

  console.log('⏳ Running migrations...');

  await migrate(db, {
    // This must match the "out" folder folder defined in drizzle.config.ts
    migrationsFolder: './drizzle',
  });

  console.log('✅ Migrations completed successfully!');
  await migrationClient.end();
  process.exit(0);
};

runMigration().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
