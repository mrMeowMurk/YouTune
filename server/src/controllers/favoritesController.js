const youtubeMusic = require('../services/youtubeMusic');
const { formatTrackResponse } = require('../utils/formatters');

class FavoritesController {
    constructor() {
        this.favoriteTracks = new Map();
    }

    async getFavorites(req, res) {
        try {
            const trackPromises = Array.from(this.favoriteTracks.keys()).map(async (id) => {
                try {
                    const searchResults = await youtubeMusic.search(id, "song");
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
    }

    async addToFavorites(req, res) {
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

            this.favoriteTracks.set(id, track);
            
            res.json({ success: true, message: 'Трек добавлен в любимые' });
        } catch (error) {
            console.error('Ошибка добавления в любимые:', error);
            res.status(500).json({ error: 'Ошибка при добавлении трека в любимые' });
        }
    }

    removeFromFavorites(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID трека обязателен' });
            }

            this.favoriteTracks.delete(id);
            
            res.json({ success: true, message: 'Трек удален из любимых' });
        } catch (error) {
            console.error('Ошибка удаления из любимых:', error);
            res.status(500).json({ error: 'Ошибка при удалении трека из любимых' });
        }
    }

    checkFavorite(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID трека обязателен' });
            }

            const isFavorite = this.favoriteTracks.has(id);
            res.json({ isFavorite });
        } catch (error) {
            console.error('Ошибка проверки избранного:', error);
            res.status(500).json({ error: 'Ошибка при проверке избранного' });
        }
    }
}

module.exports = new FavoritesController(); 