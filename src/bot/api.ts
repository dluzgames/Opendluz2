import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { processUserMessage } from '../agent/loop.js';
import { getSessionHistory } from '../db/database.js';
import { schedulerManager } from '../scheduler/manager.js';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const startAPI = async () => {
    const app = express();
    const PORT = env.PORT;
    // Para este protótipo, vamos usar uma mesma sessão estática
    const WEB_SESSION_ID = 'web_user_dev';

    // Middlewares
    app.use(cors());
    app.use(express.json());

    // Serve arquivos estáticos da pasta web-app built (produção) ou original (dev)
    const prodPath = path.join(__dirname, '../../web-app-dist');
    const devPath = path.join(__dirname, '../../web-app');
    const webAppPath = fs.existsSync(prodPath) ? prodPath : devPath;

    console.log(`[API] Servindo arquivos estáticos de: ${webAppPath}`);
    app.use(express.static(webAppPath));

    // Rotas
    app.get('/api/health', (req, res) => {
        res.json({ status: 'ok', bot: 'Frya Web - Agente Dluz Games' });
    });

    // Busca todo o histórico
    app.get('/api/history', async (req, res) => {
        try {
            const history = await getSessionHistory(WEB_SESSION_ID, 50);
            res.json({ history });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Envia mensagem e recebe resposta
    app.post('/api/chat', async (req, res) => {
        try {
            const { message } = req.body;
            if (!message) {
                return res.status(400).json({ error: 'Mensagem vazia' });
            }

            console.log(`[Web] Mensagem Recebida: ${message}`);
            const response = await processUserMessage(WEB_SESSION_ID, message);

            res.json({ response });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message || 'Erro interno' });
        }
    });

    // --- Endpoints do Agendador (Cron) ---

    // Lista todas as tarefas
    app.get('/api/tasks', async (req, res) => {
        try {
            const tasks = await schedulerManager.listTasks();
            res.json({ tasks });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Alterna status (ativa/pausa)
    app.post('/api/tasks/toggle', async (req, res) => {
        try {
            const { id, status } = req.body;
            await schedulerManager.toggleTask(id, status);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Deleta uma tarefa
    app.delete('/api/tasks/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            await schedulerManager.deleteTask(id);
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Atualiza uma tarefa
    app.patch('/api/tasks/:id', async (req, res) => {
        try {
            const id = parseInt(req.params.id);
            const { name, cron, task_data } = req.body;
            await schedulerManager.updateTask(id, name, cron, JSON.stringify(task_data));
            res.json({ success: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Fallback para SPA
    app.use((req, res) => {
        res.sendFile(path.join(webAppPath, 'index.html'));
    });

    app.listen(PORT, () => {
        console.log("=========================================");
        console.log(`🌐 Frya API Servidor rodando na porta ${PORT}`);
        console.log(`   http://localhost:${PORT}/api/health`);
        console.log("=========================================");
    });
};
