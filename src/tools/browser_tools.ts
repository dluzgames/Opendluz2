import { spawn } from "child_process";
import { env } from "../config/env.js";

export const browserTools = [
    {
        type: "function",
        function: {
            name: "browser_navigate",
            description: "Navega para uma URL específica no Chrome.",
            parameters: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "A URL para navegar.",
                    }
                },
                required: ["url"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "browser_screenshot",
            description: "Captura uma captura de tela da página atual.",
            parameters: {
                type: "object",
                properties: {},
            },
        },
    },
    {
        type: "function",
        function: {
            name: "browser_evaluate",
            description: "Executa JavaScript na página e retorna o resultado.",
            parameters: {
                type: "object",
                properties: {
                    script: {
                        type: "string",
                        description: "O código JavaScript a ser executado.",
                    }
                },
                required: ["script"],
            },
        },
    }
];

export async function executeBrowserTool(name: string, args: any): Promise<string> {
    const port = env.CHROME_REMOTE_DEBUGGING_PORT;

    // Comando para rodar o MCP server como um "one-shot" client é difícil sem o SDK completo
    // No entanto, podemos usar o 'npx chrome-devtools-mcp' e enviar JSON-RPC via stdio.

    return new Promise((resolve) => {
        console.log(`[Browser] Executando ferramenta: ${name}`);

        // Iniciamos o server
        const child = spawn("npx", ["-y", "chrome-devtools-mcp@latest", "--slim"]);

        let output = "";
        let errorOutput = "";
        let hasResolved = false;

        const sendRequest = (method: string, params: any) => {
            const request = {
                jsonrpc: "2.0",
                id: Date.now(),
                method: method,
                params: params
            };
            child.stdin.write(JSON.stringify(request) + "\n");
        };

        child.stdout.on('data', (data) => {
            const str = data.toString();
            output += str;

            // Tenta parsear a resposta JSON-RPC
            try {
                // O MCP server pode mandar várias linhas (logs + JSON)
                // Procuramos por algo que pareça um resultado
                if (str.includes('"result":')) {
                    const lines = output.split('\n');
                    for (const line of lines) {
                        try {
                            const json = JSON.parse(line);
                            if (json.result !== undefined) {
                                hasResolved = true;
                                child.kill();
                                resolve(JSON.stringify(json.result, null, 2));
                                break;
                            }
                        } catch (e) { }
                    }
                }
            } catch (e) { }
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('error', (err) => {
            if (!hasResolved) {
                hasResolved = true;
                resolve(`Erro ao iniciar processo: ${err.message}`);
            }
        });

        child.on('close', (code) => {
            if (!hasResolved) {
                hasResolved = true;
                if (code !== 0 && code !== null) {
                    resolve(`Erro na ferramenta de browser (Código ${code}): ${errorOutput}`);
                } else {
                    resolve(output || "Comando executado.");
                }
            }
        });

        // Espera um pouco para o server subir e então envia o comando
        // Nota: chrome-devtools-mcp espera que o Chrome esteja rodando na porta debugging.
        setTimeout(() => {
            if (hasResolved) return;

            // Map Frya tools to MCP tools
            let mcpMethod = "";
            let mcpParams = args;

            switch (name) {
                case "browser_navigate":
                    mcpMethod = "navigate";
                    break;
                case "browser_screenshot":
                    mcpMethod = "screenshot";
                    break;
                case "browser_evaluate":
                    mcpMethod = "evaluate";
                    break;
            }

            if (mcpMethod) {
                sendRequest(mcpMethod, mcpParams);
            } else {
                hasResolved = true;
                child.kill();
                resolve(`Método ${name} não mapeado.`);
            }
        }, 3000);

        // Timeout global de 30s
        setTimeout(() => {
            if (!hasResolved) {
                hasResolved = true;
                child.kill();
                resolve("⚠️ Timeout: A ferramenta de browser demorou demais para responder.");
            }
        }, 30000);
    });
}
