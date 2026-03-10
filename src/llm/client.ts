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
const groq = env.GROQ_API_KEY ? new Groq({ apiKey: env.GROQ_API_KEY }) : null;

// Helper for delay (backoff)
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

// callLLM now uses Groq as primary
export const callLLM = async (messages: any[], tools?: any[]): Promise<LLMResponse> => {
    const MAX_RETRIES = 2;

    if (!groq || !env.GROQ_API_KEY) {
        throw new Error("Configuração do Groq ausente (GROQ_API_KEY).");
    }

    // Format tools for Groq/OpenAI format
    const groqTools = tools?.map(t => ({
        type: "function",
        function: {
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
        }
    }));

    for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
            console.log(`[LLM] Tentando Groq (${env.GROQ_MODEL}) (Tentativa ${i + 1}/${MAX_RETRIES + 1})...`);

            const chatCompletion = await groq.chat.completions.create({
                messages: messages.map(m => ({
                    role: m.role === 'tool' ? 'tool' : (m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user')),
                    content: m.content || "",
                    tool_call_id: m.tool_call_id, // If it's a tool response
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

        } catch (error: any) {
            console.error(`❌ Erro Groq (Tentativa ${i + 1}):`, error?.message || error);

            if (i < MAX_RETRIES) {
                const waitTime = (i + 1) * 2000;
                console.log(`⏳ Aguardando ${waitTime}ms para nova tentativa no Groq...`);
                await delay(waitTime);
                continue;
            }
            throw new Error(`O Groq falhou após várias tentativas: ${error.message}`);
        }
    }

    throw new Error("Falha inesperada no processamento da IA com Groq.");
};
