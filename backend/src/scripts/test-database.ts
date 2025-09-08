#!/usr/bin/env node

import { testConnection, closeConnection } from '../config/database';
import { migrationRunner } from '../migrations';
import { UserRepository, SiteRepository, WorkerRepository } from '../repositories';

async function testDatabase() {
  console.log('🧪 Testing database connection and models...\n');

  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Run migrations
    console.log('\n2. Running migrations...');
    await migrationRunner.runMigrations();

    // Test basic repository operations
    console.log('\n3. Testing repository operations...');

    // Test UserRepository
    console.log('   - Testing UserRepository...');
    const users = await UserRepository.findAll();
    console.log(`     Found ${users.length} users in database`);

    // Test SiteRepository
    console.log('   - Testing SiteRepository...');
    const sites = await SiteRepository.findAll();
    console.log(`     Found ${sites.length} sites in database`);

    // Test WorkerRepository
    console.log('   - Testing WorkerRepository...');
    const workers = await WorkerRepository.findAll();
    console.log(`     Found ${workers.length} workers in database`);

    // Test site hours calculation
    console.log('   - Testing hours calculation...');
    const testSite = sites[0];
    if (testSite) {
      const hours = SiteRepository.calculateHours(testSite, 1, 2);
      console.log(`     Site "${testSite.name}" (${testSite.interpretation_mode}): 1 full day + 2 extra = ${hours} hours`);
    }

    console.log('\n✅ All database tests passed successfully!');

  } catch (error) {
    console.error('\n❌ Database test failed:', error);
    process.exit(1);
  } finally {
    await closeConnection();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testDatabase();