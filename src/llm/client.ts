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

// callLLM supports multiple providers
export const callLLM = async (messages: any[], tools?: any[]): Promise<LLMResponse> => {
    const provider = env.LLM_PROVIDER;
    const MAX_RETRIES = 2;

    for (let i = 0; i <= MAX_RETRIES; i++) {
        try {
            console.log(`[LLM] Tentando ${provider} (Tentativa ${i + 1}/${MAX_RETRIES + 1})...`);

            if (provider === 'groq') {
                if (!groq) throw new Error("Configuração do Groq ausente.");

                const groqTools = tools?.map(t => ({
                    type: "function",
                    function: {
                        name: t.function.name,
                        description: t.function.description,
                        parameters: t.function.parameters
                    }
                }));

                const chatCompletion = await groq.chat.completions.create({
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

            throw new Error(`Provedor de LLM inválido: ${provider}`);

        } catch (error: any) {
            console.error(`❌ Erro no provedor ${provider} (Tentativa ${i + 1}):`, error?.message || error);

            if (i < MAX_RETRIES) {
                const waitTime = (i + 1) * 2000;
                console.log(`⏳ Aguardando ${waitTime}ms para nova tentativa...`);
                await delay(waitTime);
                continue;
            }
            throw new Error(`Falha crítica no LLM ${provider} após várias tentativas: ${error.message}`);
        }
    }

    throw new Error("Falha inesperada no processamento da IA.");
};
