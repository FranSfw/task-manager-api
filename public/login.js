const API_URL = '';

const usernameInput = document.getElementById('usernameInput');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const authErrorMsg = document.getElementById('authErrorMsg');

function showError(msg) {
    authErrorMsg.textContent = msg;
    authErrorMsg.classList.remove('hidden');
}

async function handleAuth(endpoint) {
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        showError('Llena ambos campos por favor.');
        return;
    }

    loginBtn.disabled = true;
    registerBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include', 
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            window.location.href = 'index.html';
        } else {
            showError(data.error || 'Ocurrió un error');
        }
    } catch (error) {
        showError('Error de conexión con el servidor.');
    } finally {
        loginBtn.disabled = false;
        registerBtn.disabled = false;
    }
}

loginBtn.addEventListener('click', () => handleAuth('/login'));
registerBtn.addEventListener('click', () => handleAuth('/register'));