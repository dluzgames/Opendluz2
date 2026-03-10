import { groq, MODELS } from '../lib/groq';
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/db';

/**
 * Downloads a file from Telegram and transcribes it using Groq Whisper.
 */
export async function transcribeAudio(token: string, fileId: string): Promise<string> {
  try {
    // 1. Get file path from Telegram
    const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = await response.json();

    if (!data.ok) {
        throw new Error(`Telegram getFile failed: ${JSON.stringify(data)}`);
    }

    const filePath = data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    // 2. Download the file
    const audioResponse = await fetch(downloadUrl);
    const arrayBuffer = await audioResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save temporary file
    const tempPath = path.join(process.cwd(), 'temp_audio.ogg');
    fs.writeFileSync(tempPath, buffer);

    logger.info('Audio downloaded, sending to Groq Whisper...', { fileId });

    // 3. Transcribe with Groq
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: MODELS.WHISPER,
      response_format: 'json',
    });

    // Cleanup
    if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
    }

    logger.info('Transcription completed', { text: transcription.text });
    return transcription.text;
  } catch (error: any) {
    logger.error('Transcription error', { error: error.message });
    throw error;
  }
}
