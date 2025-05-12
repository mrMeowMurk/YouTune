const axios = require('axios');
const { cleanupMusicData } = require('../utils/formatters');

class LyricsService {
    async fetchLyrics(trackName, artistName) {
        try {
            if (!trackName || !artistName) {
                console.log('Отсутствуют данные:', { trackName, artistName });
                return {
                    lyrics: 'Недостаточно данных для поиска текста песни.',
                    source: 'error',
                    error: 'MISSING_DATA'
                };
            }

            const artistNameStr = typeof artistName === 'object' && artistName.name 
                ? artistName.name 
                : String(artistName);

            const cleanTrackName = cleanupMusicData(trackName);
            const cleanArtistName = cleanupMusicData(artistNameStr);

            if (!cleanTrackName || !cleanArtistName) {
                console.log('Некорректные данные после очистки:', { cleanTrackName, cleanArtistName });
                return {
                    lyrics: 'Не удалось обработать название песни или имя исполнителя.',
                    source: 'error',
                    error: 'INVALID_DATA'
                };
            }

            const searchVariants = [
                { track: cleanTrackName, artist: cleanArtistName },
                { track: trackName, artist: artistNameStr }
            ];

            console.log('Поиск текста песни для вариантов:', searchVariants);

            for (const variant of searchVariants) {
                try {
                    const response = await axios.get(
                        `https://api.lyrics.ovh/v1/${encodeURIComponent(variant.artist)}/${encodeURIComponent(variant.track)}`,
                        {
                            timeout: 10000,
                            headers: {
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        }
                    );

                    if (response.data && response.data.lyrics) {
                        const formattedLyrics = response.data.lyrics
                            .trim()
                            .replace(/\r\n/g, '\n')
                            .replace(/\n{3,}/g, '\n\n')
                            .replace(/\[.*?\]/g, '')
                            .trim();

                        return {
                            lyrics: formattedLyrics,
                            source: 'lyrics.ovh'
                        };
                    }
                } catch (error) {
                    if (error.response && error.response.status === 404) {
                        console.log(`Текст не найден для варианта: ${variant.artist} - ${variant.track}`);
                        continue;
                    }
                    
                    if (error.response) {
                        console.error('Ошибка API lyrics.ovh:', error.response.status, error.response.data);
                    } else if (error.request) {
                        console.error('Нет ответа от lyrics.ovh:', error.request);
                    } else {
                        console.error('Ошибка запроса:', error.message);
                    }
                    
                    throw error;
                }
            }

            return {
                lyrics: `К сожалению, текст песни "${trackName}" от исполнителя "${artistNameStr}" не найден.\n\nВозможные причины:\n- Текст песни еще не добавлен в базу данных\n- Название песни или исполнителя указано неверно\n- Временная недоступность сервиса`,
                source: 'not_found'
            };
        } catch (error) {
            console.error('Ошибка при получении текста песни:', error);
            return {
                lyrics: 'Произошла ошибка при получении текста песни. Пожалуйста, попробуйте позже.',
                source: 'error',
                error: error.message
            };
        }
    }
}

module.exports = new LyricsService(); 