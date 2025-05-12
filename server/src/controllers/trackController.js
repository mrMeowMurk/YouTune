const youtubeMusic = require('../services/youtubeMusic');
const lyricsService = require('../services/lyrics');
const { formatTrackResponse } = require('../utils/formatters');

class TrackController {
    async search(req, res) {
        try {
            const searchQuery = req.query.query || req.query.q;
            if (!searchQuery) {
                return res.status(400).json({ error: 'Поисковый запрос обязателен' });
            }

            const searchResults = await youtubeMusic.search(searchQuery, "song");
            const formattedResults = await Promise.all(
                searchResults.content.map(formatTrackResponse)
            );
            res.json(formattedResults);
        } catch (error) {
            console.error('Ошибка поиска:', error);
            res.status(500).json({ error: 'Ошибка при поиске треков' });
        }
    }

    async getTrack(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID трека обязателен' });
            }

            const searchResults = await youtubeMusic.search(id, "song");
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
    }

    async checkTrackStatus(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID трека обязателен' });
            }

            const trackInfo = await youtubeMusic.prepareTrack(id);
            res.json({ ready: !!trackInfo });
        } catch (error) {
            console.error('Ошибка проверки готовности трека:', error);
            res.status(500).json({ error: 'Ошибка проверки готовности трека' });
        }
    }

    async getLyrics(req, res) {
        try {
            const { id } = req.params;
            
            const searchResults = await youtubeMusic.search(id, "song");
            const track = searchResults.content.find(t => t.videoId === id);
            
            if (!track) {
                return res.status(404).json({
                    lyrics: 'Трек не найден',
                    source: 'error',
                    error: 'TRACK_NOT_FOUND'
                });
            }

            if (!track.name || !track.artist) {
                console.error('Некорректные данные трека:', track);
                return res.status(400).json({
                    lyrics: 'Недостаточно данных для поиска текста песни',
                    source: 'error',
                    error: 'INVALID_TRACK_DATA'
                });
            }

            const lyricsResult = await lyricsService.fetchLyrics(track.name, track.artist);
            res.json(lyricsResult);
        } catch (error) {
            console.error('Ошибка при обработке запроса текста песни:', error);
            res.status(500).json({
                lyrics: 'Произошла ошибка при получении текста песни. Пожалуйста, попробуйте позже.',
                source: 'error',
                error: error.message
            });
        }
    }

    async handleAudioRequest(req, res) {
        try {
            const { id } = req.params;
            const { range } = req.headers;
            
            if (!id) {
                return res.status(400).json({ error: 'ID трека обязателен' });
            }

            console.log(`${req.method} запрос аудио для трека:`, id);

            let trackInfo = await youtubeMusic.prepareTrack(id);
            if (!trackInfo) {
                throw new Error('Не удалось подготовить трек');
            }

            const videoUrl = `https://www.youtube.com/watch?v=${id}`;
            const { format, contentLength, lengthSeconds } = trackInfo;

            res.setHeader('Content-Type', format.mimeType || 'audio/mpeg');
            res.setHeader('Accept-Ranges', 'bytes');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('X-Content-Duration', lengthSeconds);
            res.setHeader('Content-Duration', lengthSeconds);

            if (req.method === 'HEAD') {
                res.setHeader('Content-Length', contentLength);
                return res.end();
            }

            if (range) {
                const parts = range.replace(/bytes=/, '').split('-');
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
                const chunkSize = end - start + 1;

                console.log(`Запрошен диапазон: ${start}-${end}`);

                res.setHeader('Content-Range', `bytes ${start}-${end}/${contentLength}`);
                res.setHeader('Content-Length', chunkSize);
                res.status(206);

                const stream = youtubeMusic.createAudioStream(videoUrl, format, { start, end });
                this.handleStream(stream, res, id, `${start}-${end}`);
            } else {
                res.setHeader('Content-Length', contentLength);
                const stream = youtubeMusic.createAudioStream(videoUrl, format);
                this.handleStream(stream, res, id);
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

    handleStream(stream, res, id, range = null) {
        stream.on('error', (error) => {
            console.error('Ошибка потока:', error);
            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Ошибка при получении аудио потока',
                    details: error.message
                });
            }
        });

        stream.on('end', () => {
            console.log(`Завершена передача ${range ? `диапазона ${range}` : 'трека'} ${id}`);
        });

        stream.pipe(res);
    }

    async getRecommendations(req, res) {
        try {
            // Используем более надежный запрос для получения популярных треков
            const searchResults = await youtubeMusic.search("top hits", "song", 20);
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
    }
}

module.exports = new TrackController(); 