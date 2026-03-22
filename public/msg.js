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