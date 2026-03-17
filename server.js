require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: 'https://fransfw.github.io', 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());

app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Middleware para verificar el JWT en la cookie
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Acceso denegado' });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; 
    next(); 
  } catch (error) {
    res.status(403).json({ error: 'Token inválido' });
  }
};

// Endpoints de autenticación
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const result = await pool.query(
      'INSERT INTO users (username, password) VALUES ($1, $2) RETURNING id, username',
      [username, hashedPassword]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
    
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Error al registrar (quizá el usuario ya existe)' });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) return res.status(400).json({ error: 'Usuario incorrecto' });
    
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    res.json({ message: 'Login exitoso' });
  } catch (error) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.post('/logout', (req, res) => {
  res.clearCookie('token', { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === 'production', 
      sameSite: 'lax'
  });
  res.json({ message: 'Sesión cerrada' });
});

// Endpoints

// Get
app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY completed ASC, id ASC', [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las tareas' });
  }
});

// Post
app.post('/tasks', authenticateToken, async (req, res) => {
  const { title, completed } = req.body;
  if (!title) return res.status(400).json({ error: 'Título obligatorio' });
  
  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, completed, user_id) VALUES ($1, $2, $3) RETURNING *',
      [title, completed || false, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

// Delete
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No autorizada' });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar' });
  }
});

// Put
app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const { completed } = req.body;
  if (completed === undefined) return res.status(400).json({ error: 'Falta campo completed' });

  try {
    const result = await pool.query(
      'UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [completed, req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'No autorizada' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar' });
  }
});

app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));