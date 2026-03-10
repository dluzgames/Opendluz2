import { logger } from '../lib/db';

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<any>;
}

export const tools: Record<string, ToolDef> = {
  get_current_time: {
    name: 'get_current_time',
    description: 'Returns the current local time.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async () => {
      const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      return { time: now };
    }
  },
  // Add more tools here (e.g., weather, search, etc.)
};

export function getToolSchemas() {
  return Object.values(tools).map(t => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }
  }));
}
