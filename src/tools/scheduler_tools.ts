import { schedulerManager } from '../scheduler/manager.js';
import cronParser from 'cron-parser';

export const schedulerTools = [
    {
        type: "function",
        function: {
            name: "scheduler_add_task",
            description: "Agenda uma tarefa recorrente ou única usando uma expressão cron. Para linguagem natural, a IA deve converter para cron.",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Nome curto e descritivo da tarefa (ex: 'Lembrete de Café').",
                    },
                    cron: {
                        type: "string",
                        description: "Expressão cron válida (ex: '0 8 * * *' para todo dia às 8h).",
                    },
                    instruction: {
                        type: "string",
                        description: "A instrução que a IA deve executar quando o gatilho disparar.",
                    },
                },
                required: ["name", "cron", "instruction"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "scheduler_list_tasks",
            description: "Lista todas as tarefas agendadas no sistema.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "scheduler_delete_task",
            description: "Remove permanentemente uma tarefa agendada pelo seu ID.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "number", description: "O ID numérico da tarefa." },
                },
                required: ["id"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "scheduler_toggle_task",
            description: "Pausa ou ativa uma tarefa agendada.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "number", description: "O ID numérico da tarefa." },
                    status: { type: "string", enum: ["active", "paused"], description: "O novo status." },
                },
                required: ["id", "status"],
            },
        },
    },
];

export async function executeSchedulerTool(name: string, args: any): Promise<string> {
    try {
        switch (name) {
            case "scheduler_add_task":
                // Valida o cron antes de salvar
                try {
                    // @ts-ignore
                    cronParser.parseExpression(args.cron);
                } catch (e) {
                    return `Erro: Expressão cron inválida ('${args.cron}'). Certifique-se de usar o formato padrão de 5 campos.`;
                }

                const taskData = JSON.stringify({ instruction: args.instruction });
                const newTask = await schedulerManager.addTask(args.name, args.cron, taskData);
                // @ts-ignore
                return `Sucesso: Tarefa '${args.name}' agendada com sucesso! ID: ${newTask.id}, Próxima execução: ${cronParser.parseExpression(args.cron).next().toString()}`;

            case "scheduler_list_tasks":
                const tasks = await schedulerManager.listTasks();
                if (tasks.length === 0) return "Nenhuma tarefa agendada encontrada.";

                let output = "📋 Tarefas Agendadas:\n";
                for (const t of tasks) {
                    const data = JSON.parse(t.task_data);
                    output += `ID: ${t.id} | ${t.name} | [${t.status}] | Cron: ${t.cron} | Ação: ${data.instruction}\n`;
                }
                return output;

            case "scheduler_delete_task":
                await schedulerManager.deleteTask(args.id);
                return `Sucesso: Tarefa ID ${args.id} removida.`;

            case "scheduler_toggle_task":
                await schedulerManager.toggleTask(args.id, args.status);
                return `Sucesso: Tarefa ID ${args.id} agora está ${args.status === 'active' ? 'Ativa' : 'Pausada'}.`;

            default:
                return `Erro: Ferramenta de agendamento '${name}' não implementada.`;
        }
    } catch (error: any) {
        console.error(`[Scheduler Tool] Erro em ${name}:`, error.message);
        return `Erro ao executar ${name}: ${error.message}`;
    }
}
