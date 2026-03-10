const API_URL = '/api';

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Task Management Elements
const tasksSidebar = document.getElementById('tasks-sidebar');
const tasksList = document.getElementById('tasks-list');
const toggleTasksBtn = document.getElementById('toggle-tasks-btn');
const closeTasksBtn = document.getElementById('close-tasks-btn');

// Task Wizard Elements
const taskInstruction = document.getElementById('task-instruction');
const taskFreq = document.getElementById('task-freq');
const taskVal = document.getElementById('task-val');
const taskValLabel = document.getElementById('task-val-label');
const createTaskBtn = document.getElementById('create-task-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const cronHelper = document.getElementById('cron-helper');

let currentEditingId = null;
let allTasks = [];

function renderMessage(role, content) {
    const isUser = role === 'user';
    const msgWrapper = document.createElement('div');
    msgWrapper.className = `message ${isUser ? 'user' : 'assistant'}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';

    // Basic Markdown formatting
    let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');

    bubble.innerHTML = formattedContent;
    msgWrapper.appendChild(bubble);
    chatMessages.appendChild(msgWrapper);
    chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

function showLoading(text = "Pensando") {
    sendBtn.disabled = true;
    messageInput.disabled = true;

    const msgWrapper = document.createElement('div');
    msgWrapper.className = 'message assistant id-loading';

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = `
    <div class="loading-content">
      <span class="loading-text">${text}</span>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;

    msgWrapper.appendChild(bubble);
    chatMessages.appendChild(msgWrapper);
    chatMessages.parentElement.scrollTop = chatMessages.parentElement.scrollHeight;
}

function stopLoading() {
    const loadingEl = document.querySelector('.id-loading');
    if (loadingEl) loadingEl.remove();
    sendBtn.disabled = false;
    messageInput.disabled = false;
    messageInput.focus();
}

async function sendMessage(text) {
    renderMessage('user', text);
    showLoading();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minutos para uploads/auth

    try {
        const res = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: text
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        stopLoading();

        if (data.error) {
            renderMessage('assistant', `⚠️ **Erro:** ${data.error}`);
        } else {
            renderMessage('assistant', data.response);
            if (!tasksSidebar.classList.contains('hidden')) loadTasks();
        }
    } catch (err) {
        clearTimeout(timeoutId);
        stopLoading();
        if (err.name === 'AbortError') {
            renderMessage('assistant', `⚠️ **Timeout:** O servidor demorou demais para responder.`);
        } else {
            renderMessage('assistant', `⚠️ **Erro de conexão:** Falha ao acessar a API.`);
        }
    }
}

async function loadTasks() {
    try {
        const res = await fetch(`${API_URL}/tasks`);
        const { tasks } = await res.json();
        allTasks = tasks;
        renderTasks(tasks);
    } catch (e) {
        tasksList.innerHTML = `<p class="error">Erro ao carregar tarefas.</p>`;
    }
}

function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
        tasksList.innerHTML = '<p class="empty-list">Nenhuma tarefa agendada.</p>';
        return;
    }

    tasksList.innerHTML = tasks.map(t => {
        const data = t.task_data ? (typeof t.task_data === 'string' ? JSON.parse(t.task_data) : t.task_data) : {};
        return `
      <div class="task-card ${t.status === 'paused' ? 'paused' : ''} ${currentEditingId == t.id ? 'editing' : ''}">
        <div class="task-info">
          <strong>${t.name || 'Tarefa'}</strong>
          <code>${t.cron}</code>
          <small>${(data.instruction || 'Sem instrução').substring(0, 80)}...</small>
        </div>
        <div class="task-actions">
          <button onclick="editTask('${t.id}')" title="Editar">✏️</button>
          <button onclick="deleteTask('${t.id}')" title="Excluir">🗑️</button>
        </div>
      </div>
    `;
    }).join('');
}

window.deleteTask = async (id) => {
    if (!confirm('Deseja realmente excluir esta tarefa?')) return;
    try {
        await fetch(`${API_URL}/tasks/${id}`, { method: 'DELETE' });
        if (currentEditingId == id) cancelEdit();
        loadTasks();
    } catch (e) {
        console.error('Erro ao excluir tarefa:', e);
    }
};

window.editTask = (id) => {
    const task = allTasks.find(t => t.id == id);
    if (!task) return;

    currentEditingId = id;
    const data = task.task_data ? (typeof task.task_data === 'string' ? JSON.parse(task.task_data) : task.task_data) : {};

    taskInstruction.value = data.instruction || "";

    // Tenta detectar a frequencia pelo cron simplificado
    if (task.cron.includes('*/') && task.cron.endsWith('* * * *')) {
        taskFreq.value = 'minutes';
        taskVal.value = task.cron.split('/')[1].split(' ')[0];
    } else if (task.cron.includes('*/') && task.cron.endsWith('* * *')) {
        taskFreq.value = 'hourly';
        taskVal.value = task.cron.split('/')[1].split(' ')[0];
    } else if (task.cron.split(' ').length === 5 && !task.cron.includes('* * *')) {
        taskFreq.value = 'weekly';
        taskVal.value = task.cron;
    } else {
        taskFreq.value = 'cron';
        taskVal.value = task.cron;
    }

    createTaskBtn.innerText = 'Salvar Alterações';
    cancelEditBtn.classList.remove('hidden');
    updateWizardUI();
    renderTasks(allTasks);
};

function cancelEdit() {
    currentEditingId = null;
    taskInstruction.value = '';
    taskVal.value = '';
    createTaskBtn.innerText = 'Agendar Agora';
    cancelEditBtn.classList.add('hidden');
    updateWizardUI();
    renderTasks(allTasks);
}

function updateWizardUI() {
    const freq = taskFreq.value;
    const val = taskVal.value.trim();
    let help = "";

    if (freq === 'minutes') {
        taskValLabel.innerText = 'Intervalo (Minutos)';
        taskVal.placeholder = '15';
        const m = parseInt(val) || 15;
        help = `💡 Frya verificará a cada **${m} minutos**.`;
    } else if (freq === 'hourly') {
        taskValLabel.innerText = 'Intervalo (Horas)';
        taskVal.placeholder = '4';
        const h = parseInt(val) || 4;
        help = `💡 Frya verificará a cada **${h} horas**.`;
    } else if (freq === 'daily') {
        taskValLabel.innerText = 'Horário (HH:mm)';
        taskVal.placeholder = '08:00';
        help = `💡 Frya executará todo dia às **${val || '08:00'}**.`;
    } else if (freq === 'weekly') {
        taskValLabel.innerText = 'Dia e Hora (ex: Seg 08:00)';
        taskVal.placeholder = 'Seg 08:00';
        help = `💡 Frya executará toda **${val || 'Segunda às 08:00'}**.`;
    } else if (freq === 'cron') {
        taskValLabel.innerText = 'Expressão Cron';
        taskVal.placeholder = '0 */4 * * *';
        help = "💡 Use o formato padrão do Cron (min hora dia mes sem).";
    }

    cronHelper.innerHTML = help;
}

async function handleCreateTask() {
    const instr = taskInstruction.value.trim();
    const freq = taskFreq.value;
    const val = taskVal.value.trim();

    if (!instr) return alert('Por favor, descreva o que a IA deve fazer.');

    let cron = '';
    if (freq === 'minutes') {
        const mins = parseInt(val) || 15;
        cron = `*/${mins} * * * *`;
    } else if (freq === 'hourly') {
        const hours = parseInt(val) || 1;
        cron = `0 */${hours} * * *`;
    } else if (freq === 'daily') {
        const [hh, mm] = (val || '08:00').split(':');
        cron = `${mm || '0'} ${hh || '8'} * * *`;
    } else if (freq === 'weekly') {
        const daysMap = { 'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3, 'Qui': 4, 'Sex': 5, 'Sab': 6 };
        if (val.includes(':')) {
            const parts = val.split(' ');
            const dayStr = parts[0] || 'Seg';
            const timeStr = parts[1] || '08:00';
            const [hh, mm] = timeStr.split(':');
            const dayNum = daysMap[dayStr] ?? 1;
            cron = `${mm || '0'} ${hh || '8'} * * ${dayNum}`;
        } else {
            cron = val;
        }
    } else {
        cron = val || '0 */4 * * *';
    }

    createTaskBtn.disabled = true;
    createTaskBtn.innerText = currentEditingId ? 'Salvando...' : 'Agendando...';

    try {
        if (currentEditingId) {
            const res = await fetch(`${API_URL}/tasks/${currentEditingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'Tarefa Manual',
                    cron: cron,
                    task_data: { instruction: instr }
                })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            renderMessage('assistant', `✅ **Tarefa atualizada com sucesso!**`);
            cancelEdit();
        } else {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: `Agende uma tarefa personalizada com o cron "${cron}" para fazer o seguinte: ${instr}` })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            taskInstruction.value = '';
            taskVal.value = '';
            renderMessage('assistant', data.response);
        }
        loadTasks();
    } catch (e) {
        alert('Erro ao processar tarefa: ' + e.message);
    } finally {
        createTaskBtn.disabled = false;
        createTaskBtn.innerText = currentEditingId ? 'Salvar Alterações' : 'Agendar Agora';
    }
}

// Event Listeners
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const txt = messageInput.value.trim();
    if (!txt) return;
    messageInput.value = '';
    sendMessage(txt);
});

toggleTasksBtn.addEventListener('click', () => {
    tasksSidebar.classList.toggle('hidden');
    if (!tasksSidebar.classList.contains('hidden')) loadTasks();
});

closeTasksBtn.addEventListener('click', () => {
    tasksSidebar.classList.add('hidden');
});

taskFreq.addEventListener('change', updateWizardUI);
taskVal.addEventListener('input', updateWizardUI);
createTaskBtn.addEventListener('click', handleCreateTask);
cancelEditBtn.addEventListener('click', cancelEdit);

// Startup
updateWizardUI();
fetch(`${API_URL}/health`)
    .then(r => r.json())
    .then(d => {
        console.log('Conectado ao Bot:', d);
    })
    .catch(e => console.warn('Aviso: Backend inativo no momento.'));
