export const getCurrentTimeTool = {
    type: "function",
    function: {
        name: "get_current_time",
        description: "Retorna a data e hora atual do sistema em formato legível.",
        parameters: {
            type: "object",
            properties: {
                timezone: {
                    type: "string",
                    description: "Fuso horário opcional, ex: 'America/Sao_Paulo'. Se omitido, usará o fuso local do servidor."
                }
            },
        },
    }
};

export const executeGetCurrentTime = async (args: { timezone?: string }): Promise<string> => {
    const options: Intl.DateTimeFormatOptions = {
        dateStyle: 'full',
        timeStyle: 'long',
        timeZone: args.timezone
    };

    try {
        const formatted = new Intl.DateTimeFormat('pt-BR', options).format(new Date());
        return `A data e hora atual é: ${formatted}`;
    } catch (e) {
        // Fallback if timezone is invalid
        const formatted = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'long' }).format(new Date());
        return `A data e hora atual é: ${formatted} (fuso original ignorado por erro literal)`;
    }
};
