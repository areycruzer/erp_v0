#!/usr/bin/env node

// Quick fix script to convert PostgreSQL syntax to SQLite in repository files
const fs = require('fs');
const path = require('path');

const repositoryFiles = [
  'src/repositories/WorkerRepository.ts',
  'src/repositories/AttendanceRepository.ts', 
  'src/repositories/AuditRepository.ts'
];

const convertToSQLite = (content) => {
  // Replace PostgreSQL parameter syntax ($1, $2) with SQLite (?)
  content = content.replace(/\$\d+/g, '?');
  
  // Replace PostgreSQL RETURNING * with separate operations
  content = content.replace(/RETURNING \*/g, '');
  
  // Replace result.rows with result
  content = content.replace(/result\.rows\[0\]/g, 'result[0]');
  content = content.replace(/result\.rows/g, 'result');
  
  // Replace rowCount with changes
  content = content.replace(/result\.rowCount/g, 'result.changes');
  
  // Replace ILIKE with LIKE
  content = content.replace(/ILIKE/g, 'LIKE');
  
  // Replace boolean true/false with 1/0 in queries
  content = content.replace(/= true/g, '= 1');
  content = content.replace(/= false/g, '= 0');
  
  // Replace ON CONFLICT with INSERT OR IGNORE
  content = content.replace(/INSERT INTO (.+?) VALUES (.+?) ON CONFLICT.+?DO NOTHING/gs, 'INSERT OR IGNORE INTO $1 VALUES $2');
  
  return content;
};

repositoryFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`Converting ${file}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    content = convertToSQLite(content);
    fs.writeFileSync(filePath, content);
    console.log(`✅ Converted ${file}`);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log('🎉 PostgreSQL to SQLite conversion completed!');
