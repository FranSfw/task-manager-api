const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;


app.use(cors()); 
app.use(express.json()); 

let tasks = [];
let currentId = 1;

// GET – Obtener todas las tareas
app.get('/tasks', (req, res) => {
  res.status(200).json(tasks);
});

// POST – Crear nueva tarea
app.post('/tasks', (req, res) => {
  const { title, completed } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'El campo title es obligatorio' });
  }

  const newTask = {
    id: currentId,
    title: title,
    completed: completed !== undefined ? completed : false
  };

  tasks.push(newTask);
  currentId++; 

  res.status(201).json(newTask);
});

// DELETE – Eliminar tarea
app.delete('/tasks/:id', (req, res) => {
  const idParam = parseInt(req.params.id);
  
  const taskIndex = tasks.findIndex(task => task.id === idParam);

  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Tarea no encontrada' });
  }

  tasks.splice(taskIndex, 1);
  
  res.status(204).send(); 
});


app.listen(PORT, () => {
  console.log(`Task Manager API corriendo en http://localhost:${PORT}/tasks`);
});
