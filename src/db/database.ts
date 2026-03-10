import Database from 'better-sqlite3';
import postgres from 'postgres';
import { env } from '../config/env.js';
import path from 'path';
import fs from 'fs';

// --- DATABASE SELECTION ---
const isPostgres = !!env.DATABASE_URL;

let sql: any;
let db: any;

if (isPostgres) {
    console.log('🌐 Usando PostgreSQL (Supabase/Remote)...');
    sql = postgres(env.DATABASE_URL!);
} else {
    console.log('📂 Usando SQLite (Local)...');
    // Ensure the directory for the DB exists
    const dbDir = path.dirname(env.DB_PATH);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(env.DB_PATH);
    db.pragma('journal_mode = WAL');
}

// Inicialização das tabelas
export const initDB = async () => {
    const query = `
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp BIGINT NOT NULL,
      tool_calls TEXT,
      tool_call_id TEXT
    );

    CREATE TABLE IF NOT EXISTS memories (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      cron TEXT NOT NULL,
      task_data TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at BIGINT NOT NULL
    );
    `;

    if (isPostgres) {
        await sql.unsafe(query);
        await sql`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`;
    } else {
        // Adapt query for SQLite (id SERIAL -> INTEGER PRIMARY KEY AUTOINCREMENT)
        const sqliteQuery = query
            .replace('SERIAL PRIMARY KEY', 'INTEGER PRIMARY KEY AUTOINCREMENT')
            .replace('BIGINT', 'INTEGER');
        db.exec(sqliteQuery);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`);
    }

    console.log('✅ Banco de dados inicializado com sucesso.');
};

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string;
    tool_calls?: string; // JSON string
    tool_call_id?: string;
    timestamp?: number;
}

export const saveMessage = async (sessionId: string, msg: ChatMessage) => {
    const timestamp = msg.timestamp || Date.now();
    const tool_calls = msg.tool_calls ? (typeof msg.tool_calls === 'string' ? msg.tool_calls : JSON.stringify(msg.tool_calls)) : null;

    if (isPostgres) {
        await sql`
      INSERT INTO messages (session_id, role, content, timestamp, tool_calls, tool_call_id)
      VALUES (${sessionId}, ${msg.role}, ${msg.content}, ${timestamp}, ${tool_calls}, ${msg.tool_call_id || null})
    `;
    } else {
        const insert = db.prepare(`
      INSERT INTO messages (session_id, role, content, timestamp, tool_calls, tool_call_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
        insert.run(sessionId, msg.role, msg.content, timestamp, tool_calls, msg.tool_call_id || null);
    }
};

export const getSessionHistory = async (sessionId: string, limit: number = 50): Promise<ChatMessage[]> => {
    let rows: any[];

    if (isPostgres) {
        rows = await sql`
      SELECT role, content, tool_calls, tool_call_id
      FROM messages 
      WHERE session_id = ${sessionId}
      ORDER BY timestamp DESC, id DESC
      LIMIT ${limit}
    `;
    } else {
        const stmt = db.prepare(`
      SELECT role, content, tool_calls, tool_call_id
      FROM messages 
      WHERE session_id = ? 
      ORDER BY timestamp DESC, id DESC
      LIMIT ?
    `);
        rows = stmt.all(sessionId, limit);
    }

    return rows.reverse().map(row => {
        const rawMsg: any = { role: row.role, content: row.content };
        if (row.tool_calls) {
            try {
                rawMsg.tool_calls = typeof row.tool_calls === 'string' ? JSON.parse(row.tool_calls) : row.tool_calls;
            } catch (e) {
                console.error("Erro ao fazer parse dos tool_calls", e);
            }
        }
        if (row.tool_call_id) rawMsg.tool_call_id = row.tool_call_id;
        return rawMsg;
    });
};

export const setMemory = async (key: string, value: string) => {
    const timestamp = Date.now();
    if (isPostgres) {
        await sql`
            INSERT INTO memories (key, value, updated_at)
            VALUES (${key}, ${value}, ${timestamp})
            ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = ${timestamp}
        `;
    } else {
        const stmt = db.prepare(`
            INSERT INTO memories (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
        `);
        stmt.run(key, value, timestamp);
    }
};

export const getMemories = async (): Promise<Record<string, string>> => {
    try {
        let rows: any[];
        if (isPostgres) {
            rows = await sql`SELECT key, value FROM memories`;
        } else {
            rows = db.prepare(`SELECT key, value FROM memories`).all();
        }

        const memories: Record<string, string> = {};
        rows.forEach(row => {
            memories[row.key] = row.value;
        });
        return memories;
    } catch (e) {
        console.error("Erro ao buscar memórias:", e);
        return {};
    }
};
