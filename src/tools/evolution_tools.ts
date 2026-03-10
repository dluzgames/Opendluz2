import fetch from "node-fetch";
import { env } from "../config/env.js";

export const evolutionTools = [
    {
        type: "function",
        function: {
            name: "whatsapp_send_text",
            description: "Envia uma mensagem de texto via WhatsApp usando a Evolution API.",
            parameters: {
                type: "object",
                properties: {
                    number: {
                        type: "string",
                        description: "O número de telefone com código do país (ex: 5511999999999).",
                    },
                    text: {
                        type: "string",
                        description: "O conteúdo da mensagem a ser enviada.",
                    },
                },
                required: ["number", "text"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "whatsapp_search_contact",
            description: "Procura um contato pelo nome ou número na agenda do WhatsApp.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "O nome ou parte do nome do contato para buscar.",
                    },
                },
                required: ["query"],
            },
        },
    },
];

export async function executeEvolutionTool(name: string, args: any): Promise<string> {
    const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME } = env;

    if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE_NAME) {
        return "Erro: Credenciais da Evolution API não configuradas no .env";
    }

    if (name === "whatsapp_send_text") {
        const { number, text } = args;

        // Limpar o número (manter apenas dígitos)
        const cleanNumber = number.replace(/\D/g, "");

        try {
            const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "apikey": EVOLUTION_API_KEY,
                },
                body: JSON.stringify({
                    number: cleanNumber,
                    text: text,
                }),
            });

            const result: any = await response.json();

            if (response.ok) {
                return `Mensagem enviada com sucesso para ${number}. ID: ${result.key?.id || "N/A"}`;
            } else {
                return `Erro ao enviar mensagem: ${result.message || response.statusText}`;
            }
        } catch (error: any) {
            return `Erro na requisição para Evolution API: ${error.message}`;
        }
    }

    if (name === "whatsapp_search_contact") {
        const { query } = args;
        try {
            // Na Evolution API v2, podemos buscar contatos
            const response = await fetch(`${EVOLUTION_API_URL}/contact/fetch/${EVOLUTION_INSTANCE_NAME}`, {
                method: "GET",
                headers: {
                    "apikey": EVOLUTION_API_KEY,
                },
            });

            const contacts: any = await response.json();

            if (!response.ok) {
                return `Erro ao buscar contatos: ${contacts.message || response.statusText}`;
            }

            // Filtrar contatos pelo nome (query)
            const filtered = contacts.filter((c: any) =>
                (c.name && c.name.toLowerCase().includes(query.toLowerCase())) ||
                (c.pushName && c.pushName.toLowerCase().includes(query.toLowerCase())) ||
                (c.id && c.id.includes(query))
            );

            if (filtered.length === 0) {
                return `Nenhum contato encontrado para "${query}".`;
            }

            const results = filtered.map((c: any) => `${c.name || c.pushName || "Sem Nome"}: ${c.id.split("@")[0]}`).join("\n");
            return `Contatos encontrados:\n${results}`;
        } catch (error: any) {
            return `Erro ao buscar contatos na Evolution API: ${error.message}`;
        }
    }

    return `Ferramenta Evolution '${name}' não implementada.`;
}
