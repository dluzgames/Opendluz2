import cron from 'node-cron';
import { env } from '../config/env.js';
import { ChatMessage } from '../db/database.js';

// Interface para as tarefas agendadas
export interface ScheduledTask {
    id: number;
    name: string;
    cron: string;
    task_data: string; // JSON com as instruções ou contexto
    status: 'active' | 'paused';
    created_at: number;
}

// Mapa para manter as jobs em execução na memória
const runningJobs = new Map<number, cron.ScheduledTask>();

class SchedulerManager {
    private sql: any;
    private db: any;
    private isPostgres: boolean;
    private processor: ((task: ScheduledTask) => Promise<void>) | null = null;

    constructor() {
        this.isPostgres = !!env.DATABASE_URL;
    }

    setProcessor(processor: (task: ScheduledTask) => Promise<void>) {
        this.processor = processor;
    }

    async init(sqlOrDb: any) {
        if (this.isPostgres) {
            this.sql = sqlOrDb;
        } else {
            this.db = sqlOrDb;
        }
        await this.loadAllTasks();
    }

    async loadAllTasks() {
        console.log('[Scheduler] Carregando tarefas do banco de dados...');
        let tasks: ScheduledTask[] = [];

        if (this.isPostgres) {
            tasks = await this.sql`SELECT * FROM scheduled_tasks WHERE status = 'active'`;
        } else {
            tasks = this.db.prepare(`SELECT * FROM scheduled_tasks WHERE status = 'active'`).all();
        }

        for (const task of tasks) {
            this.scheduleJob(task);
        }
        console.log(`[Scheduler] ${tasks.length} tarefas ativas agendadas.`);
    }

    scheduleJob(task: ScheduledTask) {
        if (runningJobs.has(task.id)) {
            runningJobs.get(task.id)?.stop();
        }

        const job = cron.schedule(task.cron, async () => {
            console.log(`[Scheduler] Executando tarefa: ${task.name} (ID: ${task.id})`);
            if (this.processor) {
                try {
                    await this.processor(task);
                } catch (error) {
                    console.error(`[Scheduler] Erro ao processar tarefa ${task.id}:`, error);
                }
            }
        });

        runningJobs.set(task.id, job);
    }

    async addTask(name: string, cronExpr: string, taskData: string): Promise<ScheduledTask> {
        const createdAt = Date.now();
        let newTask: ScheduledTask;

        if (this.isPostgres) {
            const rows = await this.sql`
                INSERT INTO scheduled_tasks (name, cron, task_data, created_at, status)
                VALUES (${name}, ${cronExpr}, ${taskData}, ${createdAt}, 'active')
                RETURNING *
            `;
            newTask = rows[0];
        } else {
            const stmt = this.db.prepare(`
                INSERT INTO scheduled_tasks (name, cron, task_data, created_at, status)
                VALUES (?, ?, ?, ?, 'active')
            `);
            const info = stmt.run(name, cronExpr, taskData, createdAt);
            newTask = { id: Number(info.lastInsertRowid), name, cron: cronExpr, task_data: taskData, created_at: createdAt, status: 'active' };
        }

        this.scheduleJob(newTask);
        return newTask;
    }

    async listTasks(): Promise<ScheduledTask[]> {
        if (this.isPostgres) {
            return await this.sql`SELECT * FROM scheduled_tasks ORDER BY created_at DESC`;
        } else {
            return this.db.prepare(`SELECT * FROM scheduled_tasks ORDER BY created_at DESC`).all();
        }
    }

    async deleteTask(id: number) {
        runningJobs.get(id)?.stop();
        runningJobs.delete(id);

        if (this.isPostgres) {
            await this.sql`DELETE FROM scheduled_tasks WHERE id = ${id}`;
        } else {
            this.db.prepare(`DELETE FROM scheduled_tasks WHERE id = ?`).run(id);
        }
    }

    async toggleTask(id: number, status: 'active' | 'paused') {
        if (status === 'paused') {
            runningJobs.get(id)?.stop();
            runningJobs.delete(id);
        }

        if (this.isPostgres) {
            await this.sql`UPDATE scheduled_tasks SET status = ${status} WHERE id = ${id}`;
            if (status === 'active') {
                const rows = await this.sql`SELECT * FROM scheduled_tasks WHERE id = ${id}`;
                if (rows[0]) this.scheduleJob(rows[0]);
            }
        } else {
            this.db.prepare(`UPDATE scheduled_tasks SET status = ? WHERE id = ?`).run(status, id);
            if (status === 'active') {
                const task = this.db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id);
                if (task) this.scheduleJob(task);
            }
        }
    }

    async updateTask(id: number, name: string, cronExpr: string, taskData: string) {
        if (this.isPostgres) {
            await this.sql`
                UPDATE scheduled_tasks 
                SET name = ${name}, cron = ${cronExpr}, task_data = ${taskData} 
                WHERE id = ${id}
            `;
            const rows = await this.sql`SELECT * FROM scheduled_tasks WHERE id = ${id}`;
            if (rows[0] && rows[0].status === 'active') this.scheduleJob(rows[0]);
        } else {
            this.db.prepare(`
                UPDATE scheduled_tasks 
                SET name = ?, cron = ?, task_data = ? 
                WHERE id = ?
            `).run(name, cronExpr, taskData, id);
            const task = this.db.prepare(`SELECT * FROM scheduled_tasks WHERE id = ?`).get(id);
            if (task && task.status === 'active') this.scheduleJob(task);
        }
    }
}

export const schedulerManager = new SchedulerManager();
