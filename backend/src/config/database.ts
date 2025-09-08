import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'hajiri.db');

let db: Database<sqlite3.Database, sqlite3.Statement> | null = null;

// Ensure data directory exists
const ensureDataDirectory = (): void => {
  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`📁 Created data directory: ${dataDir}`);
  }
};

// Initialize database connection
export const initDatabase = async (): Promise<Database<sqlite3.Database, sqlite3.Statement>> => {
  if (db) {
    return db;
  }

  try {
    ensureDataDirectory();
    
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Enable foreign keys and other pragmas
    await db.exec('PRAGMA foreign_keys = ON');
    await db.exec('PRAGMA journal_mode = WAL');
    await db.exec('PRAGMA synchronous = NORMAL');
    await db.exec('PRAGMA cache_size = 1000');
    await db.exec('PRAGMA temp_store = MEMORY');
    
    console.log(`✅ SQLite database connection successful: ${dbPath}`);
    return db;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
};

// Get database instance
export const getDatabase = async (): Promise<Database<sqlite3.Database, sqlite3.Statement>> => {
  if (!db) {
    return await initDatabase();
  }
  return db;
};

// Test database connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const database = await getDatabase();
    await database.get('SELECT 1 as test');
    console.log('✅ Database connection test successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return false;
  }
};

// Query helper with error handling
export const query = async (sql: string, params?: any[]): Promise<any> => {
  const start = Date.now();
  try {
    const database = await getDatabase();
    const result = await database.all(sql, params);
    const duration = Date.now() - start;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 Query executed:', { sql, duration: `${duration}ms`, rows: result.length });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query error:', { sql, params, error });
    throw error;
  }
};

// Single row query helper
export const queryOne = async (sql: string, params?: any[]): Promise<any> => {
  try {
    const database = await getDatabase();
    return await database.get(sql, params);
  } catch (error) {
    console.error('❌ Database query error:', { sql, params, error });
    throw error;
  }
};

// Insert/Update/Delete helper
export const run = async (sql: string, params?: any[]): Promise<any> => {
  try {
    const database = await getDatabase();
    return await database.run(sql, params);
  } catch (error) {
    console.error('❌ Database run error:', { sql, params, error });
    throw error;
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (db: Database<sqlite3.Database, sqlite3.Statement>) => Promise<T>
): Promise<T> => {
  const database = await getDatabase();
  
  try {
    await database.exec('BEGIN TRANSACTION');
    const result = await callback(database);
    await database.exec('COMMIT');
    return result;
  } catch (error) {
    await database.exec('ROLLBACK');
    throw error;
  }
};

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  try {
    if (db) {
      await db.close();
      db = null;
      console.log('🔌 Database connection closed');
    }
  } catch (error) {
    console.error('❌ Error closing database connection:', error);
  }
};

export default { getDatabase, query, queryOne, run, withTransaction };