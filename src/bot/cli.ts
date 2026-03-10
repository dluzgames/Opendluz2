import * as readline from 'readline';
import { processUserMessage } from '../agent/loop.js';

export const startCLI = () => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const SESSION_ID = 'local_cli_dev';

    console.log("=========================================");
    console.log("🤖 Frya [Modo Terminal/Dev] Iniciada! ");
    console.log("=========================================");
    console.log("Digite sua mensagem e pressione Enter. (Digite 'sair' para encerrar)");
    console.log("");

    const askQuestion = () => {
        rl.question('Você: ', async (userMessage) => {
            if (userMessage.toLowerCase() === 'sair' || userMessage.toLowerCase() === 'exit') {
                console.log('Encerrando...');
                rl.close();
                process.exit(0);
            }

            if (!userMessage.trim()) {
                askQuestion();
                return;
            }

            try {
                // Indicador visual de processamento simples...
                process.stdout.write("Agente: Pensando...\r");
                const response = await processUserMessage(SESSION_ID, userMessage);

                // Limpa o 'pensando' e exibe a resposta
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                console.log(`Agente: ${response}\n`);
            } catch (error) {
                console.error("\n❌ Erro ao tentar processar a chamada:", error);
            }

            askQuestion();
        });
    };

    askQuestion();
};
