import { groq, MODELS } from '../lib/groq';
import { tools, getToolSchemas } from './tools';
import { logger } from '../lib/db';

const SYSTEM_PROMPT = `
Você é o OpenDluz, um agente de IA pessoal ultra-inteligente, prestativo e animado!
Você deve ajudar o usuário com qualquer tarefa, utilizando as ferramentas disponíveis quando necessário.
Sempre responda em Português do Brasil de forma amigável.

Se você decidir usar uma ferramenta, retorne a chamada da ferramenta. 
Após receber o resultado da ferramenta, continue seu raciocínio até dar uma resposta final ao usuário.
`;

export async function runAgent(userId: string, userMessage: string) {
  logger.agent('Starting agent loop', { userId, userMessage });

  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const response = await groq.chat.completions.create({
      model: MODELS.LLM,
      messages,
      tools: getToolSchemas(),
      tool_choice: 'auto',
    });

    const responseMessage = response.choices[0].message;
    messages.push(responseMessage);

    if (responseMessage.tool_calls) {
      logger.agent('Tool calls detected', { tool_calls: responseMessage.tool_calls });

      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);
        
        const tool = tools[toolName];
        if (tool) {
          try {
            const result = await tool.execute(toolArgs);
            messages.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolName,
              content: JSON.stringify(result),
            });
            logger.agent(`Tool ${toolName} executed`, { result });
          } catch (err: any) {
            messages.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              name: toolName,
              content: JSON.stringify({ error: err.message }),
            });
            logger.error(`Tool ${toolName} failed`, { error: err.message });
          }
        }
      }
      continue; // Check if agent wants to call more tools or finish
    }

    // No tool calls, return final message
    logger.agent('Agent finished loop', { response: responseMessage.content });
    return responseMessage.content;
  }

  return "Desculpe, eu me perdi no meu raciocínio. Pode tentar de novo?";
}
