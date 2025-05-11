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
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
    exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
}));

// Add OPTIONS handling for all routes
app.options('*', cors());

app.use(express.json());

// Инициализация YouTube Music API с настройками
const api = new YoutubeMusicApi();
const initializeApi = async () => {
    try {
        await api.initalize({
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Goog-Visitor-Id': ''
            }
        });
        console.log('YouTube Music API инициализирован успешно');
    } catch (error) {
        console.error('Ошибка инициализации YouTube Music API:', error);
        process.exit(1);
    }
};

// Проверка работоспособности сервера
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Инициализация API при запуске
initializeApi();

// Кэш для хранения информации о треках
const trackCache = new Map();

// Очистка кэша каждый час
setInterval(() => {
    trackCache.clear();
}, 3600000);

// Хранилище для любимых треков (в реальном приложении использовать базу данных)
const favoriteTracks = new Map();

// Функция для подготовки трека
async function prepareTrack(id) {
    try {
        if (trackCache.has(id)) {
            return trackCache.get(id);
        }

        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        const info = await ytdl.getInfo(videoUrl);
        
        const format = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly'
        });

        if (!format) {
            throw new Error('Не удалось найти подходящий аудио формат');
        }

        const trackInfo = {
            format,
            contentLength: format.contentLength,
            lengthSeconds: parseInt(info.videoDetails.lengthSeconds),
            ready: true,
            timestamp: Date.now()
        };

        trackCache.set(id, trackInfo);
        return trackInfo;
    } catch (error) {
        console.error('Ошибка подготовки трека:', error);
        return null;
    }
}

// Эндпоинт для проверки готовности трека
app.get('/api/check/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        const trackInfo = trackCache.get(id);
        if (trackInfo) {
            // Если информация в кэше старше 1 часа, обновляем её
            if (Date.now() - trackInfo.timestamp > 3600000) {
                trackCache.delete(id);
                const newInfo = await prepareTrack(id);
                return res.json({ ready: !!newInfo });
            }
            return res.json({ ready: true });
        }

        // Если трека нет в кэше, начинаем подготовку
        const info = await prepareTrack(id);
        res.json({ ready: !!info });
    } catch (error) {
        console.error('Ошибка проверки готовности трека:', error);
        res.status(500).json({ error: 'Ошибка проверки готовности трека' });
    }
});

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
        // Используем более надежный запрос для получения популярных треков
        const searchResults = await api.search("top hits", "song", 20);
        console.log('Получены результаты поиска:', searchResults.content.length, 'треков');

        if (!searchResults || !searchResults.content || searchResults.content.length === 0) {
            throw new Error('Не удалось получить результаты поиска');
        }

        const filteredTracks = searchResults.content
            .filter(track => track.type === 'song' && track.videoId)
            .slice(0, 20);

        console.log('Отфильтровано треков:', filteredTracks.length);

        const formattedResults = await Promise.all(
            filteredTracks.map(async (track) => {
                try {
                    return await formatTrackResponse(track);
                } catch (error) {
                    console.error('Ошибка форматирования трека:', error);
                    return null;
                }
            })
        );

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

// Обработка HEAD и GET запросов для аудио
app.head('/api/play/:id', handleAudioRequest);
app.get('/api/play/:id', handleAudioRequest);

async function handleAudioRequest(req, res) {
    try {
        const { id } = req.params;
        const { range } = req.headers;
        
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        console.log(`${req.method} запрос аудио для трека:`, id);

        // Получаем или подготавливаем информацию о треке
        let trackInfo = trackCache.get(id);
        if (!trackInfo || Date.now() - trackInfo.timestamp > 3600000) {
            trackInfo = await prepareTrack(id);
            if (!trackInfo) {
                throw new Error('Не удалось подготовить трек');
            }
        }

        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        const { format, contentLength, lengthSeconds } = trackInfo;

        // Устанавливаем базовые заголовки
        res.setHeader('Content-Type', format.mimeType || 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('X-Content-Duration', lengthSeconds);
        res.setHeader('Content-Duration', lengthSeconds);

        // Для HEAD запроса возвращаем только заголовки
        if (req.method === 'HEAD') {
            res.setHeader('Content-Length', contentLength);
            return res.end();
        }

        // Обработка запроса с указанным диапазоном
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
            const chunkSize = end - start + 1;

            console.log(`Запрошен диапазон: ${start}-${end}`);

            res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
            res.setHeader('Content-Length', chunkSize);
            res.status(206);

            const stream = ytdl(videoUrl, {
                format,
                range: { start, end },
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1024 * 1024, // 1MB
            });

            stream.on('error', (error) => {
                console.error('Ошибка потока:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Ошибка при получении аудио потока',
                        details: error.message
                    });
                }
            });

            // Добавляем обработку окончания потока
            stream.on('end', () => {
                console.log(`Завершена передача диапазона ${start}-${end} для трека ${id}`);
            });

            stream.pipe(res);
        } else {
            res.setHeader('Content-Length', contentLength);
            
            const stream = ytdl(videoUrl, {
                format,
                filter: 'audioonly',
                quality: 'highestaudio',
                highWaterMark: 1024 * 1024, // 1MB
            });

            stream.on('error', (error) => {
                console.error('Ошибка потока:', error);
                if (!res.headersSent) {
                    res.status(500).json({
                        error: 'Ошибка при получении аудио потока',
                        details: error.message
                    });
                }
            });

            // Добавляем обработку окончания потока
            stream.on('end', () => {
                console.log(`Завершена передача трека ${id}`);
            });

            stream.pipe(res);
        }

    } catch (error) {
        console.error('Ошибка получения аудио:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Ошибка при получении аудио',
                details: error.message
            });
        }
    }
}

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

// Получение любимых треков
app.get('/api/favorites', async (req, res) => {
    try {
        // Преобразуем Map в массив треков
        const trackPromises = Array.from(favoriteTracks.keys()).map(async (id) => {
            try {
                // Получаем информацию о треке через поиск по ID
                const searchResults = await api.search(id, "song");
                const track = searchResults.content.find(t => t.videoId === id);
                if (track) {
                    return await formatTrackResponse(track);
                }
                return null;
            } catch (error) {
                console.error(`Ошибка получения трека ${id}:`, error);
                return null;
            }
        });

        const tracks = await Promise.all(trackPromises);
        const validTracks = tracks.filter(track => track !== null);
        
        res.json(validTracks);
    } catch (error) {
        console.error('Ошибка получения любимых треков:', error);
        res.status(500).json({ error: 'Ошибка при получении любимых треков' });
    }
});

// Добавление трека в любимые
app.post('/api/favorites/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        // Получаем информацию о треке
        const searchResults = await api.search(id, "song");
        const track = searchResults.content.find(t => t.videoId === id);
        
        if (!track) {
            return res.status(404).json({ error: 'Трек не найден' });
        }

        // Добавляем трек в любимые
        favoriteTracks.set(id, track);
        
        res.json({ success: true, message: 'Трек добавлен в любимые' });
    } catch (error) {
        console.error('Ошибка добавления в любимые:', error);
        res.status(500).json({ error: 'Ошибка при добавлении трека в любимые' });
    }
});

// Удаление трека из любимых
app.delete('/api/favorites/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        // Удаляем трек из любимых
        favoriteTracks.delete(id);
        
        res.json({ success: true, message: 'Трек удален из любимых' });
    } catch (error) {
        console.error('Ошибка удаления из любимых:', error);
        res.status(500).json({ error: 'Ошибка при удалении трека из любимых' });
    }
});

// Проверка, находится ли трек в любимых
app.get('/api/favorites/:id', (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID трека обязателен' });
        }

        const isFavorite = favoriteTracks.has(id);
        res.json({ isFavorite });
    } catch (error) {
        console.error('Ошибка проверки избранного:', error);
        res.status(500).json({ error: 'Ошибка при проверке избранного' });
    }
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

app.listen(port, () => {
    console.log(`Сервер запущен на порту ${port}`);
}); 