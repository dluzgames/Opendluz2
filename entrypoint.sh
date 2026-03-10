#!/bin/bash

# Inicia o Chromium em background para depuração remota
# Usamos --no-sandbox porque dentro do Docker é necessário
chromium --remote-debugging-port=9222 --headless --no-sandbox --disable-gpu --disable-dev-shm-usage &

# Pequena espera para o browser subir
sleep 5

# Inicia a aplicação
echo "🚀 Iniciando Frya na porta $PORT..."
node dist/index.js
