import fetch from "node-fetch";

import { env } from "../config/env.js";

// Configurações do WordPress - Prioriza .env
const WP_URL = process.env.WP_URL || "https://loja.dluz.com.br";
const WP_TOKEN = process.env.WP_TOKEN;
const WP_USERNAME = process.env.WP_USERNAME;
const WP_APP_PASSWORD = process.env.WP_APP_PASSWORD;

export const wordpressTools = [
    {
        type: "function",
        function: {
            name: "wp_get_site_info",
            description: "Obtém informações gerais sobre o site WordPress.",
            parameters: { type: "object", properties: {} },
        },
    },
    {
        type: "function",
        function: {
            name: "wp_list_posts",
            description: "Lista os posts mais recentes do site.",
            parameters: {
                type: "object",
                properties: {
                    per_page: { type: "number", description: "Número de posts por página (padrão 5)." },
                    status: { type: "string", enum: ["publish", "draft", "any"], description: "Status do post." },
                },
            },
        },
    },
    {
        type: "function",
        function: {
            name: "wp_create_post",
            description: "Cria um novo post ou rascunho no WordPress.",
            parameters: {
                type: "object",
                properties: {
                    title: { type: "string", description: "Título do post." },
                    content: { type: "string", description: "Conteúdo do post (HTML ou texto)." },
                    status: { type: "string", enum: ["publish", "draft"], description: "Status do novo post (padrão 'draft')." },
                },
                required: ["title", "content"],
            },
        },
    },
];

export async function executeWordPressTool(name: string, args: any): Promise<string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    // Define o método de autenticação
    if (WP_USERNAME && WP_APP_PASSWORD) {
        // Método 1: Application Passwords (Basic Auth) - Mais estável
        const auth = Buffer.from(`${WP_USERNAME}:${WP_APP_PASSWORD}`).toString('base64');
        headers["Authorization"] = `Basic ${auth}`;
    } else if (WP_TOKEN) {
        // Método 2: JWT Token (Fallback)
        headers["Authorization"] = `Bearer ${WP_TOKEN}`;
    }

    try {
        switch (name) {
            case "wp_get_site_info":
                const infoRes = await fetch(`${WP_URL}/wp-json/`, { headers });
                if (!infoRes.ok) throw new Error(`HTTP ${infoRes.status}`);
                const infoData: any = await infoRes.json();
                return JSON.stringify({
                    name: infoData.name,
                    description: infoData.description,
                    url: infoData.url,
                    timezone: infoData.timezone_string
                }, null, 2);

            case "wp_list_posts":
                const limit = args.per_page || 5;
                const status = args.status || "publish";
                const listRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts?per_page=${limit}&status=${status}`, { headers });
                if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);
                const posts: any = await listRes.json();
                return JSON.stringify(posts.map((p: any) => ({
                    id: p.id,
                    title: p.title.rendered,
                    link: p.link,
                    date: p.date
                })), null, 2);

            case "wp_create_post":
                const createRes = await fetch(`${WP_URL}/wp-json/wp/v2/posts`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title: args.title,
                        content: args.content,
                        status: args.status || "draft"
                    }),
                });
                if (!createRes.ok) {
                    const errBody = await createRes.text();
                    throw new Error(`HTTP ${createRes.status}: ${errBody}`);
                }
                const newPost: any = await createRes.json();
                return `Post criado com sucesso! ID: ${newPost.id}, Link: ${newPost.link}`;

            default:
                return `Erro: Ferramenta WordPress '${name}' não implementada.`;
        }
    } catch (error: any) {
        console.error(`[WordPress] Erro em ${name}:`, error.message);
        return `Erro ao executar ${name} no WordPress: ${error.message}`;
    }
}
