import { bot } from './bot/bot';
import { logger } from './lib/db';

async function main() {
  logger.info('Starting OpenDluz Telegram Bot Worker...');
  
  try {
    const me = await bot.api.getMe();
    logger.info(`Bot @${me.username} is connected and ready!`);

    await bot.start({
      onStart: (info) => {
        logger.info(`Polling started for @${info.username}`);
      },
      drop_pending_updates: true,
    });
  } catch (err: any) {
    logger.error('Worker crashed during startup', { error: err.message });
    process.exit(1);
  }
}

main();
