import { execSync, spawn } from "child_process";
import path from "path";
import fs from "fs";
import { env } from "../config/env.js";

// O binário do MCP YouTube Uploader
const isWindows = process.platform === "win32";
const mcpBinaryPath = isWindows ? (env.YOUTUBE_MCP_PATH.endsWith(".exe") ? env.YOUTUBE_MCP_PATH : `${env.YOUTUBE_MCP_PATH}.exe`) : env.YOUTUBE_MCP_PATH.replace(".exe", "");

const YOUTUBE_MCP_EXE = path.resolve(process.cwd(), mcpBinaryPath);
const CLIENT_SECRET_FILE = path.resolve(process.cwd(), env.YOUTUBE_CLIENT_SECRET_PATH);

export const youtubeTools = [
    {
        type: "function",
        function: {
            name: "youtube_upload",
            description: "Faz o upload de um vídeo para o YouTube.",
            parameters: {
                type: "object",
                properties: {
                    video_path: {
                        type: "string",
                        description: "Caminho local para o arquivo de vídeo.",
                    },
                    title: {
                        type: "string",
                        description: "Título do vídeo.",
                    },
                    description: {
                        type: "string",
                        description: "Descrição do vídeo.",
                    },
                    privacy: {
                        type: "string",
                        enum: ["private", "public", "unlisted"],
                        description: "Status de privacidade do vídeo.",
                        default: "private"
                    },
                    tags: {
                        type: "string",
                        description: "Tags separadas por vírgula.",
                    }
                },
                required: ["video_path", "title"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "youtube_auth_status",
            description: "Verifica se a autenticação com o YouTube está configurada corretamente.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    }
];

export async function executeYouTubeTool(name: string, args: any): Promise<string> {
    try {
        if (!fs.existsSync(YOUTUBE_MCP_EXE)) {
            return `Erro: Binário do YouTube MCP não encontrado em ${YOUTUBE_MCP_EXE}. Por favor, verifique a instalação.`;
        }

        switch (name) {
            case "youtube_auth_status":
                if (!fs.existsSync(CLIENT_SECRET_FILE)) {
                    return `⚠️ O arquivo client_secret.json não foi encontrado em ${CLIENT_SECRET_FILE}.
Você precisa baixar este arquivo do Google Cloud Console e salvá-lo como 'client_secret.json' na pasta SKILLS/youtube/ para usar as ferramentas do YouTube.`;
                }
                const tokenFile = path.resolve(process.cwd(), "youtube-uploader-mcp-v1.json");
                if (fs.existsSync(tokenFile)) {
                    return `✅ Autenticação configurada! O token de acesso foi encontrado. Você pode fazer uploads diretamente.`;
                }
                return `✅ client_secret.json encontrado. 
👉 **Nota**: Como você ainda não logou, na primeira vez que pedir um upload, o app abrirá uma aba no seu navegador para você autorizar.`;

            case "youtube_upload":
                if (!fs.existsSync(CLIENT_SECRET_FILE)) {
                    return `Erro: Arquivo client_secret.json não encontrado. Verifique SKILLS/youtube/client_secret.json`;
                }

                const privacy = args.privacy || "private";
                const tagsStr = args.tags || "";
                const descriptionStr = args.description || "";

                // Usamos spawn para não travar o processo principal e capturar saída em tempo real
                return new Promise((resolve) => {
                    console.log(`[YouTube] Iniciando upload: ${args.title}`);

                    const child = spawn(YOUTUBE_MCP_EXE, [
                        "upload",
                        "--client_secret_file", CLIENT_SECRET_FILE,
                        "--video_file", args.video_path,
                        "--title", args.title,
                        "--description", descriptionStr,
                        "--privacy", privacy,
                        "--tags", tagsStr
                    ]);

                    let output = "";
                    let errorOutput = "";

                    child.stdout.on('data', (data) => {
                        const str = data.toString();
                        output += str;
                        console.log(`[YouTube STDOUT] ${str}`);
                    });

                    child.stderr.on('data', (data) => {
                        const str = data.toString();
                        errorOutput += str;
                        console.error(`[YouTube STDERR] ${str}`);
                    });

                    child.on('close', (code) => {
                        if (code === 0) {
                            resolve(`✅ Upload concluído com sucesso!\n\n${output}`);
                        } else {
                            if (output.includes("http") || errorOutput.includes("http")) {
                                resolve(`⚠️ Autenticação necessária. Por favor, verifique o navegador no servidor para autorizar o app.\n\n${output || errorOutput}`);
                            } else {
                                resolve(`❌ Erro no upload (Código ${code}):\n${errorOutput || output}`);
                            }
                        }
                    });

                    // Timeout interno de 10 minutos para o processo filho
                    setTimeout(() => {
                        child.kill();
                        resolve("⚠️ O processo de upload demorou demais (timeout de 10min) e foi encerrado.");
                    }, 600000);
                });

            default:
                return `Erro: Ferramenta YouTube '${name}' não implementada.`;
        }
    } catch (error: any) {
        console.error(`[YouTube] Erro fatal em ${name}:`, error);
        return `Erro interno na ferramenta YouTube ${name}: ${error.message}`;
    }
}
