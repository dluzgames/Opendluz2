import { getCurrentTimeTool, executeGetCurrentTime } from "./get_current_time.js";
import { googleTools, executeGoogleTool } from "./google_tools.js";
import { wordpressTools, executeWordPressTool } from "./wordpress_tools.js";
import { memoryTools, executeMemoryTool } from "./memory_tools.js";
import { evolutionTools, executeEvolutionTool } from "./evolution_tools.js";
import { schedulerTools, executeSchedulerTool } from "./scheduler_tools.js";
import { youtubeTools, executeYouTubeTool } from "./youtube_tools.js";
import { browserTools, executeBrowserTool } from "./browser_tools.js";

// Registro local das nossas tools nativas
export const localTools = [
    getCurrentTimeTool,
    ...googleTools,
    ...wordpressTools,
    ...memoryTools,
    ...evolutionTools,
    ...schedulerTools,
    ...youtubeTools,
    ...browserTools,
];

// Registro combinado (Local)
export let availableTools: any[] = [...localTools];

export async function executeTool(name: string, args: Record<string, any>): Promise<string> {
    try {
        // Checa se é local (nativa)
        if (name === "get_current_time") {
            return await executeGetCurrentTime(args);
        }

        // Checa se é ferramenta do Google (gogcli)
        if (name.startsWith("gmail_") || name.startsWith("calendar_") || name.startsWith("drive_")) {
            return await executeGoogleTool(name, args);
        }

        // Checa se é ferramenta do WordPress
        if (name.startsWith("wp_")) {
            return await executeWordPressTool(name, args);
        }

        // Checa se é ferramenta de memória
        if (name.endsWith("_memory")) {
            return await executeMemoryTool(name, args);
        }

        // Checa se é ferramenta da Evolution API (WhatsApp)
        if (name.startsWith("whatsapp_")) {
            return await executeEvolutionTool(name, args);
        }

        // Checa se é ferramenta de agendamento (Cron)
        if (name.startsWith("scheduler_")) {
            return await executeSchedulerTool(name, args);
        }

        // Checa se é ferramenta do YouTube
        if (name.startsWith("youtube_")) {
            return await executeYouTubeTool(name, args);
        }

        // Checa se é ferramenta do Browser
        if (name.startsWith("browser_")) {
            return await executeBrowserTool(name, args);
        }

        return `Ferramenta '${name}' não encontrada.`;
    } catch (error: any) {
        console.error(`❌ Erro fatal ao executar ferramenta ${name}:`, error);
        return `Erro interno na ferramenta ${name}: ${error.message || error}`;
    }
}
