import { execSync } from "child_process";
import path from "path";

// Determina o caminho para o binário gogcli baseando-se no OS
const isWindows = process.platform === 'win32';
const GOG_PATH = isWindows
    ? path.join(process.cwd(), "SKILLS", "google", "bin", "gog.exe")
    : path.join(process.cwd(), "SKILLS", "google", "bin", "gog_linux");
const GOG_ACCOUNT = "freefiregrupoefo@gmail.com";

export const googleTools = [
    {
        type: "function",
        function: {
            name: "gmail_search",
            description: "Busca e-mails no Gmail usando critérios de pesquisa.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "Consulta de busca (ex: 'newer_than:1d', 'from:pessoal').",
                    },
                    max: {
                        type: "number",
                        description: "Número máximo de resultados (padrão 5).",
                    },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "gmail_send",
            description: "Envia um e-mail simples.",
            parameters: {
                type: "object",
                properties: {
                    to: { type: "string", description: "E-mail do destinatário." },
                    subject: { type: "string", description: "Assunto do e-mail." },
                    body: { type: "string", description: "Corpo da mensagem." },
                },
                required: ["to", "subject", "body"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "calendar_list",
            description: "Lista eventos da agenda Google.",
            parameters: {
                type: "object",
                properties: {
                    calendarId: { type: "string", description: "ID da agenda (padrão 'primary')." },
                    days: { type: "number", description: "Número de dias para buscar (padrão 7)." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "drive_search",
            description: "Busca arquivos no Google Drive.",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Nome ou parte do nome do arquivo." },
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "calendar_create_event",
            description: "Cria um novo evento na agenda Google.",
            parameters: {
                type: "object",
                properties: {
                    calendarId: { type: "string", description: "ID da agenda (padrão 'primary')." },
                    summary: { type: "string", description: "Título do evento." },
                    from: { type: "string", description: "Início (ex: '2025-03-10T10:00:00Z' ou 'today 10am')." },
                    to: { type: "string", description: "Fim (ex: '2025-03-10T11:00:00Z' ou 'today 11am')." },
                    location: { type: "string", description: "Localização opcional." },
                    attendees: { type: "string", description: "Lista de e-mails separados por vírgula." },
                },
                required: ["summary", "from", "to"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "calendar_delete_event",
            description: "Exclui um evento da agenda.",
            parameters: {
                type: "object",
                properties: {
                    calendarId: { type: "string", description: "ID da agenda (ex: 'primary')." },
                    eventId: { type: "string", description: "ID do evento a ser removido." },
                },
                required: ["calendarId", "eventId"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "tasks_list_lists",
            description: "Lista todas as listas de tarefas (tasklists) do usuário.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "tasks_list_items",
            description: "Lista os itens de uma lista de tarefas específica.",
            parameters: {
                type: "object",
                properties: {
                    tasklistId: { type: "string", description: "ID da tasklist (padrão '@default')." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "tasks_add_item",
            description: "Adiciona uma nova tarefa a uma lista.",
            parameters: {
                type: "object",
                properties: {
                    tasklistId: { type: "string", description: "ID da tasklist (padrão '@default')." },
                    title: { type: "string", description: "Título da tarefa." },
                    notes: { type: "string", description: "Observações ou descrição." },
                    due: { type: "string", description: "Data de vencimento (RFC3339 ou YYYY-MM-DD)." },
                },
                required: ["title"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "tasks_delete_item",
            description: "Remove uma tarefa permanentemente.",
            parameters: {
                type: "object",
                properties: {
                    tasklistId: { type: "string", description: "ID da tasklist (padrão '@default')." },
                    taskId: { type: "string", description: "ID da tarefa a ser removida." },
                },
                required: ["tasklistId", "taskId"],
            },
        },
    },
];

export async function executeGoogleTool(name: string, args: any): Promise<string> {
    try {
        let cmd = "";

        switch (name) {
            case "gmail_search":
                const maxSearch = args.max || 5;
                cmd = `"${GOG_PATH}" gmail search "${args.query}" --max ${maxSearch} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "gmail_send":
                // Escapando aspas para o comando CLI
                const cleanBody = args.body.replace(/"/g, '\\"');
                cmd = `"${GOG_PATH}" gmail send --to "${args.to}" --subject "${args.subject}" --body "${cleanBody}" --account ${GOG_ACCOUNT} --no-input`;
                break;

            case "calendar_list":
                const calId = args.calendarId || "primary";
                const days = args.days || 7;
                const now = new Date().toISOString();
                const future = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
                cmd = `"${GOG_PATH}" calendar events ${calId} --from ${now} --to ${future} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "calendar_create_event":
                const createCalId = args.calendarId || "primary";
                const location = args.location ? `--location "${args.location}"` : "";
                const attendees = args.attendees ? `--attendees "${args.attendees}"` : "";
                cmd = `"${GOG_PATH}" calendar create ${createCalId} --summary "${args.summary}" --from "${args.from}" --to "${args.to}" ${location} ${attendees} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "calendar_delete_event":
                cmd = `"${GOG_PATH}" calendar delete ${args.calendarId} ${args.eventId} --force --account ${GOG_ACCOUNT} --no-input`;
                break;

            case "tasks_list_lists":
                cmd = `"${GOG_PATH}" tasks lists --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "tasks_list_items":
                const listId = args.tasklistId || "@default";
                cmd = `"${GOG_PATH}" tasks list ${listId} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "tasks_add_item":
                const addListId = args.tasklistId || "@default";
                const notes = args.notes ? `--notes "${args.notes}"` : "";
                const due = args.due ? `--due "${args.due}"` : "";
                cmd = `"${GOG_PATH}" tasks add ${addListId} "${args.title}" ${notes} ${due} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "tasks_delete_item":
                cmd = `"${GOG_PATH}" tasks delete ${args.tasklistId} ${args.taskId} --account ${GOG_ACCOUNT} --no-input`;
                break;

            case "drive_search":
                cmd = `"${GOG_PATH}" drive search "${args.query}" --max 10 --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            case "drive_upload":
                const uploadName = args.name ? `--name "${args.name}"` : "";
                cmd = `"${GOG_PATH}" drive upload "${args.localPath}" ${uploadName} --account ${GOG_ACCOUNT} --json --no-input`;
                break;

            default:
                return `Erro: Ferramenta Google '${name}' não implementada.`;
        }

        console.log(`[Google] Executando: ${cmd}`);
        const output = execSync(cmd).toString();
        return output || "Operação realizada com sucesso.";

    } catch (error: any) {
        console.error(`[Google] Erro em ${name}:`, error.message);
        return `Erro ao executar ${name} no gogcli: ${error.message}`;
    }
}
