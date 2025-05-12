const app = require('./app');
const config = require('./config/config');

app.listen(config.port, () => {
    console.log(`Сервер запущен на порту ${config.port}`);
}); 