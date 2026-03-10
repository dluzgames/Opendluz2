import { setMemory, getMemories } from '../db/database.js';

export const memoryTools = [
    {
        type: "function",
        function: {
            name: "store_memory",
            description: "Armazena uma informação importante para ser lembrada permanentemente (ex: preferências do usuário, fatos aprendidos).",
            parameters: {
                type: "object",
                properties: {
                    key: {
                        type: "string",
                        description: "Chave única para a memória (ex: 'user_preferred_name').",
                    },
                    value: {
                        type: "string",
                        description: "O conteúdo da memória a ser salvo.",
                    },
                },
                required: ["key", "value"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "list_memories",
            description: "Lista todas as informações salvas na memória permanente.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
];

export async function executeMemoryTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case "store_memory":
                await setMemory(args.key, args.value);
                return `Sucesso: Memória '${args.key}' salva permanentemente.`;

            case "list_memories":
                const memories = await getMemories();
                const keys = Object.keys(memories);
                if (keys.length === 0) return "Nenhuma memória salva ainda.";

                let output = "Memórias Permanentes:\n";
                for (const [key, value] of Object.entries(memories)) {
                    output += `- ${key}: ${value}\n`;
                }
                return output;

            default:
                return `Erro: Ferramenta de memória '${name}' não implementada.`;
        }
    } catch (error: any) {
        console.error(`[Memory] Erro em ${name}:`, error.message);
        return `Erro ao executar ${name}: ${error.message}`;
    }
}
