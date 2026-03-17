require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuraciones
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000', 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser()); 

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Bd
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);
    console.log('Tablas verificadas/creadas en la base de datos.');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
};
initDB();

// Middleware de autenticación
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No hay token.' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; 
    next(); 
  } catch (error) {
    res.status(403).json({ error: 'Token inválido o expirado' });
  }
};

// Auth endpointss
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar usuario (quizá el username ya existe)' });
  }
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) return res.status(400).json({ error: 'Usuario no encontrado' });
    
    const user = userResult.rows[0];

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true, 
      secure: isProduction, 
      sameSite: isProduction ? 'none' : 'lax', 
      maxAge: 2 * 60 * 60 * 1000 
    });

    res.json({ message: 'Login exitoso', user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Error en el login' });
  }
});

// Logout

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada' });
});

// Endpoints

app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY completed ASC, id ASC', [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las tareas' });
  }
});

app.post('/tasks', authenticateToken, async (req, res) => {
  const { title, completed } = req.body;
  if (!title) return res.status(400).json({ error: 'El campo title es obligatorio' });
  
  const isCompleted = completed !== undefined ? completed : false;

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, completed, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, isCompleted, req.user.id] 
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  const idParam = parseInt(req.params.id);

  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [idParam, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada o no autorizada' });
    
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const idParam = parseInt(req.params.id);
  const { completed } = req.body;

  if (completed === undefined) return res.status(400).json({ error: 'El campo completed es obligatorio' });

  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [completed, idParam, req.user.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Tarea no encontrada o no autorizada' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar la tarea' });
  }
});

app.listen(PORT, () => {
  console.log(`Task Manager API corriendo en el puerto ${PORT}`);
});