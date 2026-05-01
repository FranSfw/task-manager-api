require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;

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

// TABLAS 
const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      );
      ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS nombre VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS edad INTEGER;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending', -- 'pending' para solicitudes, 'accepted' para chats activos
        date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        likes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS photo_likes (
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        photo_id INTEGER REFERENCES photos(id) ON DELETE CASCADE,
        PRIMARY KEY (user_id, photo_id)
      );
    `);
    console.log('Tablas verificadas en la base de datos.');
  } catch (error) {
    console.error('Error DB:', error);
  }
};
initDB();

// ENDPOINTS DE AUTENTICACIÓN

app.post('/check-username', async (req, res) => {
  const { username } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    res.json({ exists: result.rowCount > 0 });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.post('/check-email', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    res.json({ exists: result.rowCount > 0 });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// 1. POST /register
app.post('/register', async (req, res) => {
  const { username, password, email, nombre, edad } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const result = await pool.query(
      'INSERT INTO users (username, password, email, nombre, edad) VALUES ($1, $2, $3, $4, $5) RETURNING id, username',
      [username, hashedPassword, email, nombre, edad]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 });
    res.status(201).json(user);
  } catch (error) { res.status(500).json({ error: 'Error al registrar' }); }
});

// 2. POST /login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (userResult.rowCount === 0) return res.status(400).json({ error: 'Usuario incorrecto' });
    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Contraseña incorrecta' });
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 2 * 60 * 60 * 1000 });
    res.json({ message: 'Login exitoso', user: { id: user.id, username: user.username } });
  } catch (error) { res.status(500).json({ error: 'Error servidor' }); }
});

// 3. POST /logout
app.post('/logout', (req, res) => {
  res.clearCookie('token', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' });
  res.json({ message: 'Sesión cerrada' });
});

// 4. GET /me - Obtener usuario logueado
app.get('/me', authenticateToken, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username });
});

// ENDPOINTS DE TAREAS

// 1. GET /tasks
app.get('/tasks', authenticateToken, async (req, res) => {
  try { const result = await pool.query('SELECT * FROM tasks WHERE user_id = $1 ORDER BY completed ASC, id ASC', [req.user.id]); res.status(200).json(result.rows); }
  catch (error) { res.status(500).json({ error: 'Error' }); }
});

// 2. POST /tasks
app.post('/tasks', authenticateToken, async (req, res) => {
  const { title, completed } = req.body;
  try { const result = await pool.query('INSERT INTO tasks (title, completed, user_id) VALUES ($1, $2, $3) RETURNING *', [title, completed || false, req.user.id]); res.status(201).json(result.rows[0]); }
  catch (error) { res.status(500).json({ error: 'Error' }); }
});

// 3. DELETE /tasks/:id
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try { const result = await pool.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]); if (result.rowCount === 0) return res.status(404).json({ error: 'No autorizada' }); res.status(204).send(); }
  catch (error) { res.status(500).json({ error: 'Error' }); }
});

// 4. PUT /tasks/:id
app.put('/tasks/:id', authenticateToken, async (req, res) => {
  const { completed } = req.body;
  try { const result = await pool.query('UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [completed, req.params.id, req.user.id]); if (result.rowCount === 0) return res.status(404).json({ error: 'No autorizada' }); res.status(200).json(result.rows[0]); }
  catch (error) { res.status(500).json({ error: 'Error' }); }
});

// ENDPOINTS DEL CHATS

// 1. GET /users
app.get('/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE id != $1', [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error al cargar usuarios' }); }
});

// 2. GET /comments 
app.get('/comments', authenticateToken, async (req, res) => {
  try {
    const query = `
            SELECT c.id, u.username, c.message, c.date, c.sender_id, c.receiver_id, c.status
            FROM comments c
            JOIN users u ON c.sender_id = u.id
            WHERE c.sender_id = $1 OR c.receiver_id = $1
            ORDER BY c.date ASC;
        `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error al obtener mensajes' }); }
});

// 3. POST /comments 
app.post('/comments', authenticateToken, async (req, res) => {
  const { receiver_id, message, date } = req.body; // La rúbrica pide mandar date desde JS

  if (!message || message.length < 5) return res.status(400).json({ error: 'Mensaje muy corto' });
  if (!receiver_id) return res.status(400).json({ error: 'Falta destinatario' });

  try {
    const query = 'INSERT INTO comments (sender_id, receiver_id, message, date) VALUES ($1, $2, $3, $4) RETURNING *';
    const result = await pool.query(query, [req.user.id, receiver_id, message, date]);
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Error al enviar mensaje' }); }
});

// 4. DELETE /comments/:id 
app.delete('/comments/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND (sender_id = $2 OR receiver_id = $2)',
      [req.params.id, req.user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Mensaje no encontrado o no autorizado' });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Error al eliminar' }); }
});

// 5. PUT /comments/:id/accept 
app.put('/comments/:id/accept', authenticateToken, async (req, res) => {
  try {
    // Cambia el status a 'accepted' solo si tú eres el receptor
    const result = await pool.query(
      "UPDATE comments SET status = 'accepted' WHERE id = $1 AND receiver_id = $2 RETURNING *",
      [req.params.id, req.user.id]
    );
    res.status(200).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: 'Error al aceptar solicitud' }); }
});

// ENDPOINTS DE FOTOS

// 1. GET /photos
app.get('/photos', authenticateToken, async (req, res) => {
  try {
    const query = `
      SELECT p.id, p.url, p.title, p.likes, p.created_at, u.username, p.user_id,
        EXISTS(SELECT 1 FROM photo_likes pl WHERE pl.photo_id = p.id AND pl.user_id = $1) AS user_liked
      FROM photos p 
      JOIN users u ON p.user_id = u.id 
      ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query, [req.user.id]);
    res.status(200).json(result.rows);
  } catch (error) { res.status(500).json({ error: 'Error al obtener fotos' }); }
});

// 2. POST /photos
app.post('/photos', authenticateToken, async (req, res) => {
  const { url, title } = req.body;
  if (!url || !title) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const result = await pool.query(
      'INSERT INTO photos (user_id, url, title) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, url, title]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al subir foto:', error.message);
    res.status(500).json({ error: 'Error al subir foto' });
  }
});

// 3. DELETE /photos/:id
app.delete('/photos/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM photos WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No autorizada o no encontrada' });
    res.status(204).send();
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

// 4. PUT /photos/:id/like (toggle)
app.put('/photos/:id/like', authenticateToken, async (req, res) => {
  const photoId = req.params.id;
  const userId = req.user.id;
  try {
    const likeCheck = await pool.query(
      'SELECT 1 FROM photo_likes WHERE user_id = $1 AND photo_id = $2',
      [userId, photoId]
    );

    let result;
    if (likeCheck.rowCount > 0) {
      // Ya likeó → quitar like
      await pool.query('DELETE FROM photo_likes WHERE user_id = $1 AND photo_id = $2', [userId, photoId]);
      result = await pool.query('UPDATE photos SET likes = GREATEST(likes - 1, 0) WHERE id = $1 RETURNING *', [photoId]);
    } else {
      // No ha likeado → agregar like
      await pool.query('INSERT INTO photo_likes (user_id, photo_id) VALUES ($1, $2)', [userId, photoId]);
      result = await pool.query('UPDATE photos SET likes = likes + 1 WHERE id = $1 RETURNING *', [photoId]);
    }

    if (result.rowCount === 0) return res.status(404).json({ error: 'Foto no encontrada' });
    res.status(200).json({ ...result.rows[0], user_liked: likeCheck.rowCount === 0 });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));