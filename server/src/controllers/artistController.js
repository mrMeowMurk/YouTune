const youtubeMusic = require('../services/youtubeMusic');
const { formatSubscriberCount, formatArtistDescription, formatTrackResponse } = require('../utils/formatters');

class ArtistController {
    async getArtistById(req, res) {
        try {
            const { id } = req.params;
            if (!id) {
                return res.status(400).json({ error: 'ID исполнителя обязателен' });
            }

            const artistData = await youtubeMusic.getArtist(id);
            
            if (!artistData) {
                return res.status(404).json({ error: 'Исполнитель не найден' });
            }

            const formattedArtist = {
                id: artistData.artistId || id,
                name: artistData.name || 'Неизвестный исполнитель',
                image: artistData.thumbnails && artistData.thumbnails.length > 0 
                    ? artistData.thumbnails[0].url 
                    : null,
                followers: formatSubscriberCount(artistData.subscriberCount),
                description: formatArtistDescription(artistData.description || 'Информация об исполнителе отсутствует.'),
                songs: artistData.songs ? artistData.songs.map(formatTrackResponse) : []
            };
            
            res.json(formattedArtist);
        } catch (error) {
            console.error('Ошибка получения информации об исполнителе:', error);
            res.status(500).json({ 
                error: 'Ошибка при получении информации об исполнителе',
                message: error.message 
            });
        }
    }

    async getArtistByName(req, res) {
        try {
            const { name } = req.params;
            if (!name) {
                return res.status(400).json({ error: 'Имя исполнителя обязательно' });
            }

            const searchResults = await youtubeMusic.search(name, "artist");
            
            if (!searchResults || !searchResults.content || searchResults.content.length === 0) {
                return res.status(404).json({ error: 'Исполнитель не найден' });
            }

            const artist = searchResults.content.find(item => item.type === 'artist');
            
            if (!artist) {
                return res.status(404).json({ error: 'Исполнитель не найден' });
            }

            const artistData = await youtubeMusic.getArtist(artist.browseId);
            
            const formattedArtist = {
                id: artistData.artistId || artist.browseId,
                name: artistData.name || artist.name || 'Неизвестный исполнитель',
                image: artistData.thumbnails && artistData.thumbnails.length > 0 
                    ? artistData.thumbnails[0].url 
                    : (artist.thumbnailUrl || null),
                followers: formatSubscriberCount(artistData.subscriberCount),
                description: formatArtistDescription(artistData.description || 'Информация об исполнителе отсутствует.'),
                songs: artistData.songs ? artistData.songs.map(formatTrackResponse) : []
            };
            
            res.json(formattedArtist);
        } catch (error) {
            console.error('Ошибка получения информации об исполнителе по имени:', error);
            res.status(500).json({ 
                error: 'Ошибка при получении информации об исполнителе',
                message: error.message 
            });
        }
    }
}

module.exports = new ArtistController(); 