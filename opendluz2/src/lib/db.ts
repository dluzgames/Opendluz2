import Database from 'better-sqlite3';
import { env } from './env';
import path from 'path';
import fs from 'fs';

// Ensure the directory for the database exists
const dbDir = path.dirname(env.DATABASE_URL);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(env.DATABASE_URL, { verbose: console.log });
db.pragma('journal_mode = WAL');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    type TEXT DEFAULT 'text', -- 'text' or 'audio_transcript'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL, -- 'info', 'warn', 'error', 'agent_step'
    message TEXT NOT NULL,
    metadata TEXT, -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
`);

export const logger = {
  info: (msg: string, metadata?: any) => {
    const stmt = db.prepare('INSERT INTO logs (level, message, metadata) VALUES (?, ?, ?)');
    stmt.run('info', msg, metadata ? JSON.stringify(metadata) : null);
    console.log(`[INFO] ${msg}`, metadata || '');
  },
  error: (msg: string, metadata?: any) => {
    const stmt = db.prepare('INSERT INTO logs (level, message, metadata) VALUES (?, ?, ?)');
    stmt.run('error', msg, metadata ? JSON.stringify(metadata) : null);
    console.error(`[ERROR] ${msg}`, metadata || '');
  },
  agent: (msg: string, metadata?: any) => {
    const stmt = db.prepare('INSERT INTO logs (level, message, metadata) VALUES (?, ?, ?)');
    stmt.run('agent_step', msg, metadata ? JSON.stringify(metadata) : null);
    console.log(`[AGENT] ${msg}`, metadata || '');
  }
};

export default db;
