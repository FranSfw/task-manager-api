const API_URL = '';

const appContainer = document.getElementById('appContainer');
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const emptyMsg = document.getElementById('emptyMsg');
const logoutBtn = document.getElementById('logoutBtn');

// JWT
function checkAuthError(response) {
    if (!response || response.status === 401 || response.status === 403) {
        window.location.replace('login.html');
        return true;
    }
    return false;
}

async function logout() {
    try {
        await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
        window.location.replace('login.html');
    } catch (error) {
        console.error('Error al cerrar sesión', error);
    }
}

// CRUD
async function fetchTasks() {
    try {
        const response = await fetch(`${API_URL}/tasks`, { credentials: 'include' });
        
        if (checkAuthError(response)) return;

        if(appContainer) appContainer.classList.remove('hidden');

        const tasks = await response.json();
        renderTasks(tasks);
    } catch (error) {
        console.error('Error de red:', error);
        window.location.replace('login.html');
    }
}

function renderTasks(tasks) {
    taskList.innerHTML = '';
    if (tasks.length === 0) {
        emptyMsg.classList.remove('hidden');
    } else {
        emptyMsg.classList.add('hidden');
        tasks.forEach(task => {
            const li = document.createElement('li');
            li.className = 'group flex justify-between items-center py-2 px-2 hover:bg-gray-50 rounded-md transition-colors -mx-2';
            li.innerHTML = `
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${task.completed ? 'checked' : ''} 
                        onchange="toggleTask(${task.id}, ${task.completed})"
                        class="w-4 h-4 text-gray-900 rounded border-gray-300 cursor-pointer transition-colors">
                    <span class="text-base transition-all duration-300 ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}">
                        ${task.title}
                    </span>
                </div>
                <button onclick="deleteTask(${task.id})" class="text-gray-400 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all text-sm font-medium px-2">
                    Eliminar
                </button>
            `;
            taskList.appendChild(li);
        });
    }
}

async function addTask() {
    const title = taskInput.value.trim();
    if (!title) return;

    addBtn.disabled = true;
    addBtn.textContent = '...';

    try {
        const response = await fetch(`${API_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ title, completed: false })
        });

        if (checkAuthError(response)) return;

        if (response.ok) {
            taskInput.value = '';
            fetchTasks();
        }
    } catch (error) {
        console.error('Error al agregar tarea:', error);
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Agregar';
    }
}

async function deleteTask(id) {
    try {
        const response = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (checkAuthError(response)) return;
        if (response.ok) fetchTasks();
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
}

async function toggleTask(id, currentStatus) {
    try {
        const response = await fetch(`${API_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ completed: !currentStatus })
        });
        if (checkAuthError(response)) return;
        if (response.ok) fetchTasks();
    } catch (error) {
        console.error('Error al actualizar:', error);
    }
}

// Cargar usuario logueado
async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/me`, { credentials: 'include' });
        if (checkAuthError(response)) return;
        const user = await response.json();
        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay) userDisplay.textContent = `@${user.username}`;
    } catch (error) {
        console.error('Error al obtener usuario:', error);
    }
}

// Event Listeners
if(addBtn) addBtn.addEventListener('click', addTask);
if(taskInput) taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});
if(logoutBtn) logoutBtn.addEventListener('click', logout);

// Iniciar aplicación
fetchTasks();
loadCurrentUser();