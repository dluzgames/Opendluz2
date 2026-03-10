import Groq from 'groq-sdk';
import { env } from './env';

export const groq = new Groq({
  apiKey: env.GROQ_API_KEY,
});

export const MODELS = {
  LLM: "llama-3.3-70b-versatile",
  WHISPER: "whisper-large-v3",
};
