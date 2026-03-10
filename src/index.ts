import { initDB } from './db/database.js';
import { startBot } from "./bot/telegram.js";
import { startCLI } from "./bot/cli.js";
import { startAPI } from "./bot/api.js";
async function main() {
    try {
        console.log("Iniciando a Frya - Agente Dluz Games...");

        // 1. Inicializa o banco de dados e cria tabelas se não existirem
        await initDB();

        // 2. Inicializa o Agendador (Cron)
        const { schedulerManager } = await import("./scheduler/manager.js");
        const { processUserMessage } = await import("./agent/loop.js");
        const { env: dbEnv } = await import("./config/env.js");
        const postgres = (await import("postgres")).default;
        const Database = (await import("better-sqlite3")).default;

        let dbHandle;
        if (dbEnv.DATABASE_URL) {
            dbHandle = postgres(dbEnv.DATABASE_URL);
        } else {
            dbHandle = new Database(dbEnv.DB_PATH);
        }

        await schedulerManager.init(dbHandle);
        schedulerManager.setProcessor(async (task) => {
            const data = JSON.parse(task.task_data);
            console.log(`[Cron Job] Executando: ${task.name}`);
            await processUserMessage('cron_system', `TAREFA AGENDADA ESTIMULADA: ${data.instruction}`);
        });

        // 3. Escolha a interface de comunicação
        startBot(); // Descomente para usar o Telegram
        // startCLI(); // Inicia interface de linha de comando para testes locais
        await startAPI(); // Inicia o servidor Express na porta 3000 para a web-app

    } catch (error: any) {
        console.error("Falha ao iniciar a aplicação:", error);
        process.exit(1);
    }
}

main();
