import { query } from '../config/database';
import fs from 'fs';
import path from 'path';

export interface Migration {
  version: string;
  description: string;
  up: string;
  down?: string;
}

export class MigrationRunner {
  private migrationsPath: string;

  constructor(migrationsPath: string = path.join(__dirname, '../../database/migrations')) {
    this.migrationsPath = migrationsPath;
  }

  // Create migrations table if it doesn't exist
  private async ensureMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await query(sql);
  }

  // Get applied migrations
  private async getAppliedMigrations(): Promise<string[]> {
    await this.ensureMigrationsTable();
    
    const result = await query('SELECT version FROM schema_migrations ORDER BY version');
    return result.map((row: any) => row.version);
  }

  // Get available migration files
  private async getAvailableMigrations(): Promise<Migration[]> {
    if (!fs.existsSync(this.migrationsPath)) {
      console.log('📁 Migrations directory does not exist, creating...');
      fs.mkdirSync(this.migrationsPath, { recursive: true });
      return [];
    }

    const files = fs.readdirSync(this.migrationsPath)
      .filter(file => file.endsWith('.sql'))
      .sort();

    const migrations: Migration[] = [];

    for (const file of files) {
      const filePath = path.join(this.migrationsPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Extract version from filename (e.g., 001_initial_schema.sql -> 001)
      const version = file.split('_')[0];
      const description = file.replace('.sql', '').replace(/^\d+_/, '').replace(/_/g, ' ');
      
      migrations.push({
        version,
        description,
        up: content
      });
    }

    return migrations;
  }

  // Run pending migrations
  async runMigrations(): Promise<void> {
    console.log('🔄 Checking for pending migrations...');
    
    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    const pendingMigrations = availableMigrations.filter(
      migration => !appliedMigrations.includes(migration.version)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ No pending migrations');
      return;
    }

    console.log(`📋 Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      console.log(`⚡ Running migration ${migration.version}: ${migration.description}`);
      
      try {
        // Run the migration
        await query(migration.up);
        
        // Record the migration as applied
        await query(
          'INSERT INTO schema_migrations (version, description) VALUES (?, ?)',
          [migration.version, migration.description]
        );
        
        console.log(`✅ Migration ${migration.version} completed successfully`);
      } catch (error) {
        console.error(`❌ Migration ${migration.version} failed:`, error);
        throw error;
      }
    }

    console.log('🎉 All migrations completed successfully');
  }

  // Create a new migration file
  async createMigration(name: string): Promise<string> {
    if (!fs.existsSync(this.migrationsPath)) {
      fs.mkdirSync(this.migrationsPath, { recursive: true });
    }

    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = await this.getAvailableMigrations();
    
    // Get the next version number
    const allVersions = [...appliedMigrations, ...availableMigrations.map(m => m.version)];
    const maxVersion = allVersions.length > 0 
      ? Math.max(...allVersions.map(v => parseInt(v))) 
      : 0;
    
    const nextVersion = String(maxVersion + 1).padStart(3, '0');
    const fileName = `${nextVersion}_${name.toLowerCase().replace(/\s+/g, '_')}.sql`;
    const filePath = path.join(this.migrationsPath, fileName);
    
    const template = `-- Migration: ${name}
-- Version: ${nextVersion}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example (
--   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
-- );

-- CREATE INDEX idx_example_name ON example(name);
`;

    fs.writeFileSync(filePath, template);
    console.log(`📝 Created migration file: ${fileName}`);
    
    return filePath;
  }

  // Get migration status
  async getStatus(): Promise<{
    applied: Array<{ version: string; description: string; applied_at: Date }>;
    pending: Array<{ version: string; description: string }>;
  }> {
    await this.ensureMigrationsTable();
    
    const appliedResult = await query(
      'SELECT version, description, applied_at FROM schema_migrations ORDER BY version'
    );
    
    const availableMigrations = await this.getAvailableMigrations();
    const appliedVersions = appliedResult.map((row: any) => row.version);
    
    const pending = availableMigrations.filter(
      migration => !appliedVersions.includes(migration.version)
    );

    return {
      applied: appliedResult,
      pending: pending.map(m => ({ version: m.version, description: m.description }))
    };
  }
}

// Default migration runner instance
export const migrationRunner = new MigrationRunner();