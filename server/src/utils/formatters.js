// Форматирование ответа трека
async function formatTrackResponse(track) {
    let artists = [];
    
    if (track.artist) {
        if (typeof track.artist === 'string') {
            artists = track.artist.split(',').map(name => ({ name: name.trim() }));
        }
        else if (Array.isArray(track.artist)) {
            artists = track.artist.map(artist => ({ 
                name: typeof artist === 'string' ? artist : artist.name || 'Unknown Artist' 
            }));
        }
        else if (typeof track.artist === 'object') {
            artists = [{ name: track.artist.name || 'Unknown Artist' }];
        }
    }

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

// Форматирование числа подписчиков
function formatSubscriberCount(subscriberCount) {
    if (!subscriberCount) return 'более 1 000 000 слушателей';
    
    const numericValue = subscriberCount.toString().replace(/[^\d]/g, '');
    const count = parseInt(numericValue, 10);
    
    if (isNaN(count)) return 'более 1 000 000 слушателей';
    
    if (count >= 1000000) {
        return `${Math.floor(count / 1000000)} млн слушателей`;
    } else if (count >= 1000) {
        return `${Math.floor(count / 1000)} тыс. слушателей`;
    } else {
        return `${count} слушателей`;
    }
}

// Форматирование описания исполнителя
function formatArtistDescription(description) {
    if (!description) return 'Информация об исполнителе отсутствует.';
    
    let formatted = description
        .replace(/\.\s+/g, '.\n\n')
        .replace(/(\r\n|\r|\n){3,}/g, '\n\n')
        .trim();
    
    if (formatted.length > 500) {
        formatted = formatted.substring(0, 497) + '...';
    }
    
    return formatted;
}

// Очистка названия трека и имени исполнителя
function cleanupMusicData(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .toLowerCase()
        .replace(/\(feat\.?.*?\)/gi, '')
        .replace(/\(ft\.?.*?\)/gi, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/official\s*(music)?\s*video/gi, '')
        .replace(/lyrics\s*video/gi, '')
        .replace(/\b(hd|hq)\b/gi, '')
        .replace(/\d{4}/, '')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = {
    formatTrackResponse,
    formatSubscriberCount,
    formatArtistDescription,
    cleanupMusicData
}; 