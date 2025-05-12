const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const routes = require('./routes');

const app = express();

// Настройка CORS
app.use(cors(config.cors));

// Add OPTIONS handling for all routes
app.options('*', cors());

app.use(express.json());

// Подключение маршрутов
app.use('/api', routes);

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app; 