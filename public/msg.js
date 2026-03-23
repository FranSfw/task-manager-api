const api = {
    // 1. Obtener todos los usuarios registrados (para la barra lateral)
    async getUsers() {
        const response = await fetch('/users', { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar usuarios');
        return response.json();
    },

    // 2. Obtener todos los mensajes/comentarios
    async getComments() {
        const response = await fetch('/comments', { credentials: 'include' });
        if (!response.ok) throw new Error('Error al cargar mensajes');
        return response.json();
    },

    // 3. Crear un nuevo mensaje (Requisito: POST)
    async postComment(receiverId, message, date) {
        const response = await fetch('/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ receiver_id: receiverId, message: message, date: date })
        });
        if (!response.ok) throw new Error('Error al enviar el mensaje');
        return response.json();
    },

    // 4. Eliminar o rechazar un mensaje (Requisito: DELETE)
    async deleteComment(id) {
        const response = await fetch(`/comments/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al eliminar el mensaje');
        return true;
    },

    // 5. Aceptar una solicitud de chat (Extra para tu lógica tipo Instagram)
    async acceptRequest(id) {
        const response = await fetch(`/comments/${id}/accept`, {
            method: 'PUT',
            credentials: 'include'
        });
        if (!response.ok) throw new Error('Error al aceptar la solicitud');
        return response.json();
    }
};

const messageInput = document.getElementById('messageInput');
const sendMsgBtn = document.getElementById('sendMsgBtn');
const msgError = document.getElementById('msgError');

// Enviar Comentario (POST)
async function handleSendMessage() {
    if (!currentSelectedUser) return;
    
    const text = messageInput.value.trim();
    
    // Requerimiento: Validar mensaje mínimo 5 caracteres
    if (text.length < 5) {
        msgError.classList.remove('hidden');
        return;
    }
    msgError.classList.add('hidden');
    
    // Requerimiento: Agregar fecha automáticamente desde JS
    const date = new Date().toISOString();
    
    sendMsgBtn.disabled = true;
    sendMsgBtn.textContent = '...';
    
    try {
        await api.postComment(currentSelectedUser.id, text, date);
        messageInput.value = ''; 
        await loadMessages(); // Requerimiento: Actualizar lista dinámicamente
    } catch (error) {
        console.error('Error al enviar:', error);
    } finally {
        sendMsgBtn.disabled = false;
        sendMsgBtn.textContent = 'Enviar';
    }
}

// Eliminar Comentario (DELETE)
async function deleteMessage(id) {
    // Requerimiento: Confirmación antes de eliminar
    if (!confirm('¿Seguro que quieres eliminar este mensaje?')) return;
    
    try {
        await api.deleteComment(id);
        await loadMessages(); // Actualizar lista dinámicamente
    } catch (error) {
        console.error('Error al eliminar:', error);
        alert('No se pudo eliminar el comentario.');
    }
}

// Conectar los eventos del input y botón
if (sendMsgBtn) sendMsgBtn.addEventListener('click', handleSendMessage);
if (messageInput) {
    messageInput.addEventListener('keypress', (e) => {
        // Enviar con Enter (sin presionar Shift)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });
}