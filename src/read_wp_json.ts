import { env } from "./config/env.js";

async function readFull() {
    console.log("Lendo JSON completo de:", env.WP_URL);

    try {
        const res = await fetch(env.WP_URL!, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${env.WP_TOKEN}`
            }
        });

        const json = await res.json();
        console.log("RESPOSTA JSON:");
        console.log(JSON.stringify(json, null, 2));

    } catch (err: any) {
        console.error("Erro:", err.message);
    }
}

readFull();
