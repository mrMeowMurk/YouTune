require('dotenv').config();
const express = require('express');
const cors = require('cors');
const YoutubeMusicApi = require('youtube-music-api');
const ytdl = require('@distube/ytdl-core');

const app = express();
const port = process.env.PORT || 5000;

// Настройка CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

app.use(express.json());

// Инициализация YouTube Music API
const api = new YoutubeMusicApi();

// Проверка работоспособности сервера
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Инициализация API при запуске
(async () => {
    try {
        await api.initalize();
        console.log('YouTube Music API инициализирован');
    } catch (error) {
        console.error('Ошибка инициализации YouTube Music API:', error);
        process.exit(1);
    }
})();

// Поиск треков
app.get('/api/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Поисковый запрос обязателен' });
        }

        const searchResults = await api.search(query, "song");
        const formattedResults = await Promise.all(
            searchResults.content.map(formatTrackResponse)
        );
        res.json(formattedResults);
    } catch (error) {
        console.error('Ошибка поиска:', error);
        res.status(500).json({ error: 'Ошибка при поиске треков' });
    }
});

// Получение рекомендаций
app.get('/api/recommendations', async (req, res) => {
    try {
        const searchResults = await api.search("top hits 2024", "song", 20);
        console.log('Получены результаты поиска:', searchResults.content.length, 'треков');

        const filteredTracks = searchResults.content.filter(track => track.type === 'song');
        console.log('Отфильтровано треков:', filteredTracks.length);

        const formattedResults = await Promise.all(
            filteredTracks.map(async (track) => {
                try {
                    return await formatTrackResponse(track);
                } catch (error) {
                    console.error('Ошибка форматирования трека:', error, '\nТрек:', track);
                    return null;
                }
            })
        );

        // Удаляем null значения из результатов
        const validResults = formattedResults.filter(result => result !== null);
        console.log('Успешно отформатировано треков:', validResults.length);

        if (validResults.length === 0) {
            throw new Error('Не удалось получить корректные данные треков');
        }

        res.json(validResults);
    } catch (error) {
        console.error('Ошибка получения рекомендаций:', error);
        res.status(500).json({ 
            error: 'Ошибка при получении рекомендаций',
            details: error.message 
        });
    }
});

// Получение информации о треке
app.get('/api/track/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        // Получаем информацию о треке через поиск по ID
        const searchResults = await api.search(id, "song");
        const track = searchResults.content.find(t => t.videoId === id);
        
        if (!track) {
            return res.status(404).json({ error: 'Трек не найден' });
        }

        const formattedTrack = await formatTrackResponse(track);
        res.json(formattedTrack);
    } catch (error) {
        console.error('Ошибка получения трека:', error);
        res.status(500).json({ error: 'Ошибка при получении информации о треке' });
    }
});

// Получение URL для воспроизведения
app.get('/api/play/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        console.log('Получение аудио для трека:', id);
        const videoUrl = `https://www.youtube.com/watch?v=${id}`;

        // Получаем информацию о видео
        const info = await ytdl.getInfo(videoUrl);
        
        // Выбираем аудио формат
        const format = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        if (!format) {
            throw new Error('Не удалось найти подходящий аудио формат');
        }

        // Создаем поток
        const stream = ytdl(videoUrl, {
            format: format,
            quality: 'highestaudio',
            filter: 'audioonly',
            highWaterMark: 1 << 25
        });

        // Устанавливаем заголовки для стриминга
        res.setHeader('Content-Type', format.mimeType || 'audio/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');

        // Передаем поток клиенту
        stream.pipe(res);

        // Обработка ошибок потока
        stream.on('error', (error) => {
            console.error('Ошибка потока:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Ошибка при получении аудио потока',
                    details: error.message
                });
            }
        });

    } catch (error) {
        console.error('Ошибка получения аудио:', error);
        res.status(500).json({
            error: 'Ошибка при получении аудио',
            details: error.message
        });
    }
});

// Вспомогательная функция для форматирования ответа трека
async function formatTrackResponse(track) {
    let artists = [];
    
    if (track.artist) {
        // Если artist это строка
        if (typeof track.artist === 'string') {
            artists = track.artist.split(',').map(name => ({ name: name.trim() }));
        }
        // Если artist это массив
        else if (Array.isArray(track.artist)) {
            artists = track.artist.map(artist => ({ 
                name: typeof artist === 'string' ? artist : artist.name || 'Unknown Artist' 
            }));
        }
        // Если artist это объект
        else if (typeof track.artist === 'object') {
            artists = [{ name: track.artist.name || 'Unknown Artist' }];
        }
    }

    // Если artists все еще пуст, добавляем Unknown Artist
    if (artists.length === 0) {
        artists = [{ name: 'Unknown Artist' }];
    }
    
    return {
        id: track.videoId,
        name: track.name || track.title,
        artists: artists,
        album: {
            name: track.album || 'Unknown Album',
            images: [{ 
                url: track.thumbnailUrl || `https://img.youtube.com/vi/${track.videoId}/hqdefault.jpg`
            }]
        },
        duration_ms: track.duration || 0
    };
}

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
}); 