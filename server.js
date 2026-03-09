require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false
      );
    `);
    console.log('Tabla "tasks" verificada/creada en la base de datos.');
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
  }
};

initDB();

// GET – Obtener todas las tareas
app.get('/tasks', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tasks ORDER BY id ASC');
    res.status(200).json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener las tareas' });
  }
});

// POST – Crear nueva tarea
app.post('/tasks', async (req, res) => {
  const { title, completed } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'El campo title es obligatorio' });
  }

  const isCompleted = completed !== undefined ? completed : false;

  try {
    const result = await pool.query(
      'INSERT INTO tasks (title, completed) VALUES ($1, $2) RETURNING *',
      [title, isCompleted]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear la tarea' });
  }
});

// DELETE – Eliminar tarea
app.delete('/tasks/:id', async (req, res) => {
  const idParam = parseInt(req.params.id);

  try {
    const result = await pool.query('DELETE FROM tasks WHERE id = $1', [idParam]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Tarea no encontrada' });
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar la tarea' });
  }
});

app.listen(PORT, () => {
  console.log(`Task Manager API corriendo en el puerto ${PORT}`);
});