import { z } from 'zod';
import dotenv from 'dotenv';

// Load .env explicitly if needed, or rely on --env-file in Node or dotenv/config
dotenv.config();

const envSchema = z.object({
    TELEGRAM_BOT_TOKEN: z.string().min(1, "O token do bot do Telegram é obrigatório"),
    TELEGRAM_ALLOWED_USER_IDS: z.string().min(1, "Pelo menos um ID de usuário deve ser permitido"),
    DB_PATH: z.string().default(process.env.NODE_ENV === 'production' ? '/app/data/memory.db' : './memory.db'),
    DATABASE_URL: z.string().optional(), // Connection string for Supabase/Postgres
    SUPABASE_URL: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
    WP_URL: z.string().optional(),
    WP_TOKEN: z.string().optional(),
    WP_USERNAME: z.string().optional(),
    WP_APP_PASSWORD: z.string().optional(),
    EVOLUTION_API_URL: z.string().optional(),
    EVOLUTION_API_KEY: z.string().optional(),
    EVOLUTION_INSTANCE_NAME: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    GROQ_MODEL: z.string().default("llama-3.1-8b-instant"),
    OPENROUTER_API_KEY: z.string().optional(),
    OPENROUTER_MODEL: z.string().default("google/gemini-2.0-flash-001"),
    OLLAMA_CLOUD_URL: z.string().optional(),
    OLLAMA_MODEL: z.string().default("llama3"),
    LLM_PROVIDER: z.enum(["groq", "openrouter", "ollama", "gemini"]).default("groq"),
    LLM_FAILOVER_LIST: z.string().default("groq,openrouter,gemini"),
    PORT: z.coerce.number().default(4000),
    CHROME_REMOTE_DEBUGGING_PORT: z.coerce.number().default(9222),
    YOUTUBE_MCP_PATH: z.string().default("./SKILLS/youtube/bin/youtube-uploader-mcp.exe"),
    YOUTUBE_CLIENT_SECRET_PATH: z.string().default("./SKILLS/youtube/client_secret.json"),
});

const parseEnv = () => {
    try {
        const rawEnv = process.env;
        const parsed = envSchema.parse(rawEnv);

        // Convert allowed IDs from string to array of numbers
        const allowedUserIds = (parsed.TELEGRAM_ALLOWED_USER_IDS || "")
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));

        return {
            ...parsed,
            allowedUserIds,
        };
    } catch (error: any) {
        if (error instanceof z.ZodError) {
            console.error("❌ Erro na validação .env:");
            error.issues.forEach((err: any) => console.error(`  - ${err.path.join('.')}: ${err.message}`));
        } else {
            console.error("❌ Erro fatal no ambiente:", error.message);
        }
        throw error;
    }
};

export const env = parseEnv();
