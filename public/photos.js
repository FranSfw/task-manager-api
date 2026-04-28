const API_URL = '';

const appContainer = document.getElementById('appContainer');
const photosGrid = document.getElementById('photosGrid');
const emptyPhotosMsg = document.getElementById('emptyPhotosMsg');
const addPhotoForm = document.getElementById('addPhotoForm');
const photoUrlInput = document.getElementById('photoUrl');
const photoTitleInput = document.getElementById('photoTitle');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const formError = document.getElementById('formError');
const totalLikesDisplay = document.getElementById('totalLikesDisplay');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserDisplay = document.getElementById('currentUserDisplay');

let currentUserId = null;

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

async function loadCurrentUser() {
    try {
        const response = await fetch(`${API_URL}/me`, { credentials: 'include' });
        if (checkAuthError(response)) return;
        const user = await response.json();
        currentUserId = user.id;
        if (currentUserDisplay) currentUserDisplay.textContent = `@${user.username}`;
        
        // Cargar fotos una vez tengamos el usuario
        fetchPhotos();
        if (appContainer) appContainer.classList.remove('hidden');
    } catch (error) {
        console.error('Error al obtener usuario:', error);
        window.location.replace('login.html');
    }
}

async function fetchPhotos() {
    try {
        const response = await fetch(`${API_URL}/photos`, { credentials: 'include' });
        if (checkAuthError(response)) return;

        const photos = await response.json();
        renderPhotos(photos);
        updateTotalLikes(photos);
    } catch (error) {
        console.error('Error al obtener fotos:', error);
    }
}

function updateTotalLikes(photos) {
    const total = photos.reduce((sum, p) => sum + p.likes, 0);
    totalLikesDisplay.textContent = total;
}

function renderPhotos(photos) {
    photosGrid.innerHTML = '';
    
    if (photos.length === 0) {
        emptyPhotosMsg.classList.remove('hidden');
        return;
    }
    
    emptyPhotosMsg.classList.add('hidden');
    
    photos.forEach(photo => {
        const isOwner = photo.user_id === currentUserId;
        
        const item = document.createElement('div');
        item.className = 'masonry-item relative group bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 transform hover:-translate-y-1';
        
        // Validar si la imagen carga, si no poner placeholder
        item.innerHTML = `
            <div class="relative w-full overflow-hidden bg-gray-100">
                <img src="${photo.url}" alt="${photo.title}" 
                    onerror="this.src='https://via.placeholder.com/400x300?text=Error+al+cargar+imagen'"
                    class="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105">
                
                <!-- Overlay on hover -->
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                    <div class="flex justify-end">
                        ${isOwner ? `
                        <button onclick="deletePhoto(${photo.id})" class="bg-white/90 hover:bg-red-500 hover:text-white text-gray-800 p-2 rounded-full backdrop-blur-sm transition-colors shadow-sm transform hover:scale-110">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        ` : ''}
                    </div>
                    
                    <div class="flex justify-between items-end">
                        <p class="text-white font-medium text-sm drop-shadow-md truncate pr-2">@${photo.username}</p>
                    </div>
                </div>
            </div>
            
            <div class="p-4 flex justify-between items-start gap-3">
                <div class="flex-1 min-w-0">
                    <h4 class="text-gray-900 font-semibold text-sm truncate">${photo.title}</h4>
                </div>
                
                <button onclick="likePhoto(${photo.id})" class="flex items-center gap-1.5 ${photo.user_liked ? 'text-pink-500' : 'text-gray-400 hover:text-pink-500'} transition-colors group/like flex-shrink-0">
                    <svg class="w-5 h-5 transition-transform group-hover/like:scale-110" fill="${photo.user_liked ? 'currentColor' : 'none'}" stroke="${photo.user_liked ? 'none' : 'currentColor'}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path></svg>
                    <span class="text-sm font-bold">${photo.likes}</span>
                </button>
            </div>
        `;
        
        photosGrid.appendChild(item);
    });
}

addPhotoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const url = photoUrlInput.value.trim();
    const title = photoTitleInput.value.trim();
    
    if (!url || !title) return;
    
    addPhotoBtn.disabled = true;
    addPhotoBtn.innerHTML = '<span class="animate-pulse">Publicando...</span>';
    formError.classList.add('hidden');
    
    try {
        const response = await fetch(`${API_URL}/photos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ url, title })
        });

        if (checkAuthError(response)) return;

        if (response.ok) {
            photoUrlInput.value = '';
            photoTitleInput.value = '';
            fetchPhotos(); // Recargar galería
        } else {
            const data = await response.json();
            formError.textContent = data.error || 'Error al publicar';
            formError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error:', error);
        formError.textContent = 'Error de red';
        formError.classList.remove('hidden');
    } finally {
        addPhotoBtn.disabled = false;
        addPhotoBtn.textContent = 'Publicar';
    }
});

window.deletePhoto = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar esta foto?')) return;
    
    try {
        const response = await fetch(`${API_URL}/photos/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (checkAuthError(response)) return;
        
        if (response.ok) {
            fetchPhotos();
        }
    } catch (error) {
        console.error('Error al eliminar:', error);
    }
};

window.likePhoto = async (id) => {
    try {
        const response = await fetch(`${API_URL}/photos/${id}/like`, {
            method: 'PUT',
            credentials: 'include'
        });
        
        if (checkAuthError(response)) return;
        
        if (response.ok) {
            fetchPhotos(); // Recargamos para ver el nuevo like y el total actualizado
        }
    } catch (error) {
        console.error('Error al dar like:', error);
    }
};

if (logoutBtn) logoutBtn.addEventListener('click', logout);

// Iniciar cargando el usuario
loadCurrentUser();
