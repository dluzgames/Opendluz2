import { Bot, Context } from 'grammy';
import { env } from '../lib/env';
import { logger } from '../lib/db';
import { transcribeAudio } from './audio';
import { runAgent } from '../agent/loop';

export const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

// Whitelist Middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id.toString();
  if (!userId || !env.TELEGRAM_ALLOWED_USER_IDS.includes(userId)) {
    logger.warn('Unauthorized access attempt', { userId, username: ctx.from?.username });
    return; // Ignore unauthorized users
  }
  await next();
});

bot.command('start', (ctx) => {
    ctx.reply('Opa, Dluz! OpenDluz está online e pronto para agir! 🚀 No que posso te ajudar hoje?');
});

// Handle Voice Messages
bot.on('message:voice', async (ctx) => {
  const userId = ctx.from.id.toString();
  const fileId = ctx.message.voice.file_id;

  try {
    await ctx.replyWithChatAction('typing');
    const transcription = await transcribeAudio(env.TELEGRAM_BOT_TOKEN, fileId);
    
    await ctx.reply(`🎤 **Transcrição:** ${transcription}`);
    
    // Pass to Agent
    const response = await runAgent(userId, transcription);
    await ctx.reply(response);
  } catch (err: any) {
    logger.error('Error handling voice message', { error: err.message });
    await ctx.reply('Ops, tive um probleminha ao processar esse áudio. 😅');
  }
});

// Handle Text Messages
bot.on('message:text', async (ctx) => {
  const userId = ctx.from.id.toString();
  const text = ctx.message.text;

  if (text.startsWith('/')) return; // Ignore other commands

  try {
    await ctx.replyWithChatAction('typing');
    const response = await runAgent(userId, text);
    await ctx.reply(response);
  } catch (err: any) {
    logger.error('Error handling text message', { error: err.message });
    await ctx.reply('Vish, deu erro aqui no meu cérebro! 🤯');
  }
});
