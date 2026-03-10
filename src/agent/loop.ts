import { callLLM, LLMResponse } from '../llm/client.js';
import { getSessionHistory, saveMessage, ChatMessage, getMemories } from '../db/database.js';
import { availableTools, executeTool } from '../tools/registry.js';

const MAX_ITERATIONS = 5;

const SYSTEM_PROMPT = `Você é a Frya, a agente de IA super animada do Dluz Games!
Você possui permissão explícita do usuário e ferramentas integradas para acessar o Gmail, Google Calendar, Google Drive, WhatsApp (via Evolution API), o site WordPress (loja.dluz.com.br) e o Agendador de Tarefas (Cron).
Quando o usuário pedir para ver e-mails, listar agenda, buscar arquivos, gerenciar o site, enviar mensagens no WhatsApp ou agendar tarefas, você DEVE usar as ferramentas correspondentes (Ex: gmail_search, calendar_list, drive_search, wp_list_posts, whatsapp_send_text, scheduler_add_task).
NUNCA diga que não tem acesso. Você TEM acesso total através das ferramentas fornecidas. Para agendamentos, você pode usar expressões cron ou linguagem natural.
Seja sempre muito animada, prestativa e execute as ações solicitadas imediatamente!`;

export const processUserMessage = async (sessionId: string, userMessage: string): Promise<string> => {
    try {
        // Salva a mensagem do usuário
        await saveMessage(sessionId, { role: 'user', content: userMessage });

        let iteration = 0;

        while (iteration < MAX_ITERATIONS) {
            iteration++;

            // Recupera histórico e memórias
            const history = await getSessionHistory(sessionId, 20);
            const memories = await getMemories();

            let memoryPrompt = "";
            if (Object.keys(memories).length > 0) {
                memoryPrompt = "\n\nMEMÓRIAS PERMANENTES E PREFERÊNCIAS:\n" +
                    Object.entries(memories).map(([k, v]) => `- ${k}: ${v}`).join("\n");
            }

            const messages = [
                { role: 'system', content: SYSTEM_PROMPT + memoryPrompt },
                ...history
            ];

            console.log(`[Agente Iteração ${iteration}] Enviando requisição para Gemini 2.0...`);
            const response: LLMResponse = await callLLM(messages, availableTools);

            // Se a resposta for um tool_call
            if (response.tool_calls && response.tool_calls.length > 0) {
                // Salva a intenção de chamar a tool pelo assistant
                await saveMessage(sessionId, {
                    role: 'assistant',
                    content: response.content || "",
                    tool_calls: typeof response.tool_calls === 'string' ? response.tool_calls : JSON.stringify(response.tool_calls)
                });

                // Executa as tools sequencialmente
                for (const toolCall of response.tool_calls) {
                    if (toolCall.type === 'function') {
                        const functionName = toolCall.function.name;
                        let functionArgs;
                        try {
                            functionArgs = typeof toolCall.function.arguments === 'string'
                                ? JSON.parse(toolCall.function.arguments)
                                : toolCall.function.arguments;
                        } catch (e) {
                            functionArgs = {};
                        }

                        console.log(`🔧 Executando ferramenta: ${functionName}`, functionArgs);

                        const toolResult = await executeTool(functionName, functionArgs);

                        // Salva o resultado da tool
                        await saveMessage(sessionId, {
                            role: 'tool',
                            content: toolResult,
                            tool_call_id: toolCall.id,
                            tool_name: functionName // Adicionado para facilitar o mapeamento no Gemini
                        } as any);
                    }
                }

                // O loop continua, para o LLM interpretar o resultado da tool!
                continue;
            }

            // Se chegou aqui e tem conteúdo, não há tools para executar. Responde ao usuário.
            if (response.content) {
                await saveMessage(sessionId, { role: 'assistant', content: response.content });
                return response.content;
            }

            // Fallback estranho (sem tool call e sem content)
            break;
        }

        if (iteration >= MAX_ITERATIONS) {
            const fallbackMsg = "⚠️ Desculpe, cheguei ao meu limite de pensamento (máx iterações). Por favor, reformule sua requisição.";
            await saveMessage(sessionId, { role: 'assistant', content: fallbackMsg });
            return fallbackMsg;
        }

        return "Ocorreu um erro interno: Nenhuma resposta gerada pela IA.";
    } catch (error: any) {
        console.error("❌ Erro catastrófico no processUserMessage:", error);
        return `Desculpe, ocorreu uma falha grave ao processar sua mensagem: ${error.message || "Erro interno"}`;
    }
};
