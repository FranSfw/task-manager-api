import { FormGroup, FormControl, FormArray, Validators } from './reactive-forms.js';

// Validadores personalizados
const passwordMatchValidator = (group) => {
    const password = group.get('password').value;
    const confirmPassword = group.get('confirmPassword').value;
    if (password && confirmPassword && password !== confirmPassword) {
        return { mismatch: true };
    }
    return null;
};

// Validación asíncrona
const checkEmailAsyncValidator = async (control) => {
    if (!control.value) return null;
    try {
        const res = await fetch('/check-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: control.value })
        });
        const data = await res.json();
        return data.exists ? { emailExists: true } : null;
    } catch(e) {
        return null;
    }
};

// Configuración de ReactiveForms
const registerForm = new FormGroup({
    nombre: new FormControl('', [Validators.required]),
    email: new FormControl('', [Validators.required, Validators.email], [checkEmailAsyncValidator]),
    password: new FormControl('', [Validators.required]),
    confirmPassword: new FormControl('', [Validators.required]),
    edad: new FormControl('', [Validators.required, Validators.min(18)]),
    hobbies: new FormArray([new FormControl('', [Validators.required])])
});

registerForm.validator = passwordMatchValidator;
registerForm.updateValueAndValidity(); // Evaluate initial state

// DOM Elements
const inputs = {
    nombre: document.getElementById('nombreInput'),
    email: document.getElementById('emailInput'),
    password: document.getElementById('passwordInput'),
    confirmPassword: document.getElementById('confirmPasswordInput'),
    edad: document.getElementById('edadInput')
};

const errors = {
    nombre: document.getElementById('nombreError'),
    email: document.getElementById('emailError'),
    password: document.getElementById('passwordError'),
    confirmPassword: document.getElementById('confirmPasswordError'),
    edad: document.getElementById('edadError'),
    hobbies: document.getElementById('hobbiesError')
};

const submitBtn = document.getElementById('submitBtn');
const emailPending = document.getElementById('emailPending');
const hobbiesList = document.getElementById('hobbiesList');
const addHobbieBtn = document.getElementById('addHobbieBtn');

// Helper para mostrar/ocultar errores con touched/dirty
const updateUI = () => {
    // Check submit disabled state
    submitBtn.disabled = registerForm.invalid || registerForm.pending;

    // Nombre
    const nombreCtrl = registerForm.get('nombre');
    if ((nombreCtrl.touched || nombreCtrl.dirty) && nombreCtrl.invalid) {
        errors.nombre.textContent = nombreCtrl.errors.required ? 'El nombre es obligatorio.' : '';
        errors.nombre.classList.remove('hidden');
    } else {
        errors.nombre.classList.add('hidden');
    }

    // Email
    const emailCtrl = registerForm.get('email');
    emailPending.classList.toggle('hidden', !emailCtrl.pending);
    
    if ((emailCtrl.touched || emailCtrl.dirty) && emailCtrl.invalid && !emailCtrl.pending) {
        if (emailCtrl.errors.required) errors.email.textContent = 'El email es obligatorio.';
        else if (emailCtrl.errors.email) errors.email.textContent = 'Formato de email inválido.';
        else if (emailCtrl.errors.emailExists) errors.email.textContent = 'Este email ya está registrado.';
        errors.email.classList.remove('hidden');
    } else {
        errors.email.classList.add('hidden');
    }

    // Password
    const passCtrl = registerForm.get('password');
    if ((passCtrl.touched || passCtrl.dirty) && passCtrl.invalid) {
        errors.password.textContent = passCtrl.errors.required ? 'La contraseña es obligatoria.' : '';
        errors.password.classList.remove('hidden');
    } else {
        errors.password.classList.add('hidden');
    }

    // Confirm Password
    const confirmCtrl = registerForm.get('confirmPassword');
    if ((confirmCtrl.touched || confirmCtrl.dirty) && (confirmCtrl.invalid || registerForm.errors?.mismatch)) {
        if (confirmCtrl.errors?.required) errors.confirmPassword.textContent = 'Confirmar contraseña es obligatorio.';
        else if (registerForm.errors?.mismatch) errors.confirmPassword.textContent = 'Las contraseñas no coinciden.';
        errors.confirmPassword.classList.remove('hidden');
    } else {
        errors.confirmPassword.classList.add('hidden');
    }

    // Edad
    const edadCtrl = registerForm.get('edad');
    if ((edadCtrl.touched || edadCtrl.dirty) && edadCtrl.invalid) {
        if (edadCtrl.errors.required) errors.edad.textContent = 'La edad es obligatoria.';
        else if (edadCtrl.errors.min) errors.edad.textContent = 'Debes ser mayor de 18 años.';
        errors.edad.classList.remove('hidden');
    } else {
        errors.edad.classList.add('hidden');
    }

    // Hobbies
    const hobbiesCtrl = registerForm.get('hobbies');
    if ((hobbiesCtrl.touched || hobbiesCtrl.dirty) && hobbiesCtrl.invalid) {
        errors.hobbies.textContent = 'Todos los hobbies deben estar llenos.';
        errors.hobbies.classList.remove('hidden');
    } else {
        errors.hobbies.classList.add('hidden');
    }
};

// Bind inputs to FormControls
Object.keys(inputs).forEach(key => {
    const el = inputs[key];
    const ctrl = registerForm.get(key);
    
    el.addEventListener('input', (e) => {
        ctrl.setValue(e.target.value);
    });
    
    el.addEventListener('blur', () => {
        ctrl.markAsTouched();
    });
});

// Subscribe UI updates to form status changes
registerForm.statusSubscribe(updateUI);

// FormArray Dynamic UI Rendering
const renderHobbies = () => {
    hobbiesList.innerHTML = '';
    const hobbiesArray = registerForm.get('hobbies');
    
    hobbiesArray.controls.forEach((control, index) => {
        const div = document.createElement('div');
        div.className = 'flex gap-2';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = `Hobbie ${index + 1}`;
        input.className = 'flex-1 px-3 py-1 border border-gray-200 rounded-md focus:outline-none focus:border-gray-900 transition-colors text-sm';
        input.value = control.value;
        
        input.addEventListener('input', (e) => control.setValue(e.target.value));
        input.addEventListener('blur', () => control.markAsTouched());
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'X';
        removeBtn.className = 'px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 text-sm';
        removeBtn.onclick = () => {
            hobbiesArray.removeAt(index);
            renderHobbies();
        };
        
        div.appendChild(input);
        if (hobbiesArray.controls.length > 1) {
            div.appendChild(removeBtn);
        }
        hobbiesList.appendChild(div);
    });
    updateUI();
};

addHobbieBtn.addEventListener('click', () => {
    registerForm.get('hobbies').push(new FormControl('', [Validators.required]));
    renderHobbies();
});

// Initial Render
renderHobbies();

// Submit Form
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (registerForm.invalid || registerForm.pending) {
        registerForm.markAllAsTouched();
        return;
    }
    
    submitBtn.disabled = true;
    const globalError = document.getElementById('globalError');
    globalError.classList.add('hidden');
    
    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: registerForm.value.nombre, // We use email as the actual unique username in DB
                email: registerForm.value.email,
                password: registerForm.value.password,
                edad: registerForm.value.edad
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Redirigir a la pagina principal (index.html)
            window.location.href = 'index.html';
        } else {
            globalError.textContent = data.error || 'Ocurrió un error al registrar.';
            globalError.classList.remove('hidden');
        }
    } catch (error) {
        globalError.textContent = 'Error de conexión con el servidor.';
        globalError.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
    }
});
