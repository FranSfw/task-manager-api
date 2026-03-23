const API_URL = '';

const appContainer = document.getElementById('appContainer');
const taskInput = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');
const taskList = document.getElementById('taskList');
const emptyMsg = document.getElementById('emptyMsg');
const logoutBtn = document.getElementById('logoutBtn');
const navTasksBtn = document.getElementById('navTasksBtn');
const navMessagesBtn = document.getElementById('navMessagesBtn');
const tasksSection = document.getElementById('tasksSection');
const messagesSection = document.getElementById('messagesSection');
const userSearchInput = document.getElementById('userSearchInput');
const usersList = document.getElementById('usersList');

let allUsers = [];
let currentSelectedUser = null;
let currentUserId = null;

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

        if (appContainer) appContainer.classList.remove('hidden');

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
        currentUserId = user.id;

        const userDisplay = document.getElementById('currentUserDisplay');
        if (userDisplay) userDisplay.textContent = `@${user.username}`;
    } catch (error) {
        console.error('Error al obtener usuario:', error);
    }
}

// Event Listeners
if (addBtn) addBtn.addEventListener('click', addTask);
if (taskInput) taskInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTask();
});
if (logoutBtn) logoutBtn.addEventListener('click', logout);

navTasksBtn.addEventListener('click', () => {
    // Mostrar tareas, ocultar mensajes
    tasksSection.classList.remove('hidden');
    messagesSection.classList.add('hidden');

    // Cambiar estilos de los botones (activo/inactivo)
    navTasksBtn.classList.add('bg-gray-200', 'text-gray-900');
    navTasksBtn.classList.remove('text-gray-600', 'hover:bg-gray-200');
    navMessagesBtn.classList.remove('bg-gray-200', 'text-gray-900');
    navMessagesBtn.classList.add('text-gray-600', 'hover:bg-gray-200');
});

navMessagesBtn.addEventListener('click', () => {
    // Mostrar mensajes, ocultar tareas
    messagesSection.classList.remove('hidden');
    tasksSection.classList.add('hidden');

    // Cambiar estilos de los botones (activo/inactivo)
    navMessagesBtn.classList.add('bg-gray-200', 'text-gray-900');
    navMessagesBtn.classList.remove('text-gray-600', 'hover:bg-gray-200');
    navTasksBtn.classList.remove('bg-gray-200', 'text-gray-900');
    navTasksBtn.classList.add('text-gray-600', 'hover:bg-gray-200');

    loadUsersForChat();
});

// Cargar lista de usuarios
async function loadUsersForChat() {
    try {
        allUsers = await api.getUsers();
        renderUsersList(allUsers);
    } catch (error) {
        console.error("Error cargando usuarios:", error);
    }
}

// Lista de Usuarios
function renderUsersList(usersToRender) {
    usersList.innerHTML = '';

    if (usersToRender.length === 0) {
        usersList.innerHTML = `<p class="text-xs text-center text-gray-400 mt-4">No se encontraron usuarios.</p>`;
        return;
    }

    usersToRender.forEach(user => {
        const li = document.createElement('li');
        li.className = `flex items-center gap-3 p-3 rounded-md cursor-pointer transition-colors ${currentSelectedUser?.id === user.id ? 'bg-gray-100' : 'hover:bg-gray-50'
            }`;

        const initial = user.username.charAt(0).toUpperCase();

        li.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold flex-shrink-0">
                ${initial}
            </div>
            <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">@${user.username}</p>
                <p class="text-xs text-gray-500 truncate">Haz clic para chatear</p>
            </div>
        `;

        li.addEventListener('click', () => {
            openChatWith(user);
        });

        usersList.appendChild(li);
    });
}

// Buscador
userSearchInput.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    const filteredUsers = allUsers.filter(user =>
        user.username.toLowerCase().includes(searchTerm)
    );

    renderUsersList(filteredUsers);
});

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return "Hace un momento";
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
}

// Chat
function openChatWith(user) {
    currentSelectedUser = user;
    renderUsersList(allUsers);

    // Cambiamos la vista derecha
    document.getElementById('chatEmptyState').classList.add('hidden');
    document.getElementById('chatActiveState').classList.remove('hidden');
    document.getElementById('chatHeaderName').textContent = `@${user.username}`;

    document.getElementById('chatWall').innerHTML = `<p class="text-center text-gray-400 text-sm mt-10">Cargando mensajes con ${user.username}...</p>`;
    loadMessages();
}

async function loadMessages() {
    const chatWall = document.getElementById('chatWall');
    chatWall.innerHTML = `<p class="text-center text-gray-400 text-sm mt-10">Cargando...</p>`;
    
    try {
        const allComments = await api.getComments();
        
        // Filtramos solo los mensajes entre tú y el usuario seleccionado
        const chatHistory = allComments.filter(m => 
            (m.sender_id === currentUserId && m.receiver_id === currentSelectedUser.id) ||
            (m.sender_id === currentSelectedUser.id && m.receiver_id === currentUserId)
        );
        
        renderChatWall(chatHistory);
    } catch (error) {
        chatWall.innerHTML = `<p class="text-center text-red-500 text-sm mt-10">Error de conexión.</p>`;
    }
}

function renderChatWall(messages) {
    const chatWall = document.getElementById('chatWall');
    chatWall.innerHTML = '';
    
    // Requerimiento: Mensaje "No hay comentarios aún"
    if (messages.length === 0) {
        chatWall.innerHTML = `<p class="text-center text-gray-400 text-sm mt-10">No hay comentarios aún. ¡Inicia la conversación!</p>`;
        return;
    }
    
    // Requerimiento: Diferenciar visualmente cada comentario (Cards)
    messages.forEach(msg => {
        const isMe = msg.sender_id === currentUserId;
        const div = document.createElement('div');
        div.className = `flex flex-col ${isMe ? 'items-end' : 'items-start'}`;
        
        div.innerHTML = `
            <span class="text-xs text-gray-500 mb-1 mx-1">
                ${isMe ? 'Tú' : '@' + msg.username} • ${timeAgo(msg.date)}
            </span>
            <div class="relative group max-w-[75%] px-4 py-2 rounded-2xl ${isMe ? 'bg-gray-900 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'}">
                <p class="text-sm break-words">${msg.message}</p>
                
                <button onclick="deleteMessage(${msg.id})" class="absolute top-2 ${isMe ? '-left-16' : '-right-16'} text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium">
                    Eliminar
                </button>
            </div>
        `;
        chatWall.appendChild(div);
    });
    
    // Bajar el scroll automáticamente al último mensaje
    chatWall.scrollTop = chatWall.scrollHeight;
}


// Iniciar aplicación
fetchTasks();
loadCurrentUser();