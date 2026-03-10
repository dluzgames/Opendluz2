import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { env } from '../config/env.js';

export interface LLMResponse {
    role: string;
    content: string;
    tool_calls?: any[];
}

// Clients
const genAI = env.GEMINI_API_KEY ? new GoogleGenerativeAI(env.GEMINI_API_KEY) : null;
const groqClient = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

// Helper for delay (backoff)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

async function executeProvider(provider: string, messages: any[], tools?: any[]): Promise<LLMResponse> {
    if (provider === 'groq') {
        if (!groqClient) throw new Error("Configuração do Groq ausente.");

        const groqTools = tools?.map(t => ({
            type: "function",
            function: {
                name: t.function.name,
                description: t.function.description,
                parameters: t.function.parameters
            }
        }));

        const chatCompletion = await groqClient.chat.completions.create({
            messages: messages.map(m => ({
                role: m.role === 'tool' ? 'tool' : (m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user')),
                content: m.content || "",
                tool_call_id: m.tool_call_id,
            })),
            model: env.GROQ_MODEL,
            tools: groqTools as any,
            tool_choice: "auto",
            temperature: 0.1,
        });

        const response = chatCompletion.choices[0].message;
        return {
            role: 'assistant',
            content: response.content || "",
            tool_calls: response.tool_calls ? response.tool_calls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: {
                    name: tc.function.name,
                    arguments: tc.function.arguments
                }
            })) : undefined
        };
    }

    if (provider === 'openrouter') {
        if (!env.OPENROUTER_API_KEY) throw new Error("Configuração do OpenRouter ausente.");

        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: env.OPENROUTER_MODEL,
                messages,
                tools,
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`OpenRouter error: ${JSON.stringify(data)}`);

        const message = data.choices[0].message;
        return {
            role: 'assistant',
            content: message.content || "",
            tool_calls: message.tool_calls
        };
    }

    if (provider === 'ollama') {
        if (!env.OLLAMA_CLOUD_URL) throw new Error("Configuração do Ollama Cloud ausente.");

        const response = await fetch(`${env.OLLAMA_CLOUD_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: env.OLLAMA_MODEL,
                messages,
                stream: false,
                tools
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(`Ollama error: ${JSON.stringify(data)}`);

        return {
            role: 'assistant',
            content: data.message.content || "",
            tool_calls: data.message.tool_calls
        };
    }

    if (provider === 'gemini') {
        if (!genAI) throw new Error("Configuração do Gemini ausente.");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

        const result = await model.generateContent({
            contents: messages.map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content || "" }]
            }))
        });

        return {
            role: 'assistant',
            content: result.response.text(),
        };
    }

    throw new Error(`Provedor desconhecido: ${provider}`);
}

// callLLM supports multiple providers with Failover logic
export const callLLM = async (messages: any[], tools?: any[]): Promise<LLMResponse> => {
    // Priority order: primary provider first, then failover list
    const primaryProvider = env.LLM_PROVIDER;
    const failovers = env.LLM_FAILOVER_LIST.split(',').map(p => p.trim()).filter(p => p !== primaryProvider);
    const providersToTry = [primaryProvider, ...failovers];

    const MAX_RETRIES_PER_PROVIDER = 1;

    for (const provider of providersToTry) {
        for (let attempt = 0; attempt <= MAX_RETRIES_PER_PROVIDER; attempt++) {
            try {
                console.log(`[LLM] Tentando ${provider} (Tentativa ${attempt + 1})...`);
                return await executeProvider(provider, messages, tools);
            } catch (error: any) {
                const isRateLimit = error.message?.includes('429') || error.message?.includes('rate limit');
                console.error(`❌ Erro no provedor ${provider}:`, error.message);

                if (attempt < MAX_RETRIES_PER_PROVIDER && !isRateLimit) {
                    const waitTime = (attempt + 1) * 2000;
                    console.log(`⏳ Aguardando ${waitTime}ms para nova tentativa em ${provider}...`);
                    await delay(waitTime);
                    continue;
                }

                console.log(`🔄 Falha em ${provider}, tentando próximo provedor se disponível...`);
                break; // Move to next provider in providersToTry
            }
        }
    }

    throw new Error("Falha total: Todos os provedores de LLM falharam.");
};
