import { Bot, InputFile } from 'grammy';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { env } from '../config/env.js';
import { processUserMessage } from '../agent/loop.js';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Middleware para Whitelist de Usuários
bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;

    console.log(`[Nova Mensagem] Recebido de ID: ${userId} (${ctx.from?.username || 'Sem username'}) Texto: ${ctx.message?.text || 'Nenhum'}`);

    if (!userId || !env.allowedUserIds.includes(userId)) {
        console.warn(`[Segurança] Acesso negado para o ID: ${userId}`);
        // Ignora silenciosamente para não dar dicas a invasores
        return;
    }

    await next();
});

// Helper para enviar mensagens de forma segura (impede crash em caso de erro no Markdown)
const safeReply = async (ctx: any, text: string) => {
    try {
        await ctx.reply(text, { parse_mode: 'Markdown' });
    } catch (error: any) {
        console.error("⚠️ Falha ao enviar mensagem com Markdown, tentando sem formatação...", error.message);
        try {
            await ctx.reply(text);
        } catch (finalError: any) {
            console.error("❌ Falha crítica ao enviar mensagem:", finalError.message);
        }
    }
};

// Responde a comandos básicos
bot.command('start', (ctx) => {
    ctx.reply('Olá! Eu sou a Frya, sua agente pessoal de IA do Dluz Games! Como posso ajudar? ✨');
});

// Processa mensagens de texto
bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const userMessage = ctx.message.text;

    // Mostra "digitando..." para feedback
    await ctx.replyWithChatAction('typing');

    try {
        const response = await processUserMessage(userId, userMessage);
        await safeReply(ctx, response);
    } catch (error: any) {
        console.error("❌ Erro fatal no bot:", error);
        await ctx.reply(`⚠️ Desculpe, encontrei um problema técnico: ${error.message || "Erro desconhecido"}. Por favor, tente novamente em instantes.`);
    }
});

// Processa documentos e fotos
bot.on(['message:document', 'message:photo'], async (ctx) => {
    const userId = ctx.from.id.toString();

    // Mostra "uploading..." para feedback
    await ctx.replyWithChatAction('upload_document');

    try {
        const file = ctx.message.document || ctx.message.photo?.pop();
        if (!file) return;

        const fileId = file.file_id;
        const fileName = (file as any).file_name || `photo_${Date.now()}.jpg`;
        const uploadDir = path.join(process.cwd(), 'data', 'uploads');

        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, fileName);
        const link = await ctx.api.getFile(fileId);
        const url = `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${link.file_path}`;

        // Download do arquivo
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const agentMessage = `[Arquivo Recebido] Nome: ${fileName}, Caminho: ${filePath}. O usuário enviou este arquivo. O que devo fazer com ele? (Dica: posso salvar no Google Drive usando drive_upload se ele pedir)`;
        const botResponse = await processUserMessage(userId, agentMessage);

        await safeReply(ctx, botResponse);

    } catch (error: any) {
        console.error("Erro ao processar arquivo:", error);
        await ctx.reply("Desculpe, ocorreu um erro ao receber seu arquivo.");
    }
});

export const startBot = () => {
    bot.start({
        onStart: (botInfo) => {
            console.log("Frya está online e pronta! 🚀✨");
            console.log(`🔒 IDs permitidos: ${env.allowedUserIds.join(', ')}`);
        }
    });
};

// Graceful shutdown
process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());
