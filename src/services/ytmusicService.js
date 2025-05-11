const API_URL = 'http://localhost:5000/api';

export const ytmusicService = {
    async checkHealth() {
        try {
            const response = await fetch(`${API_URL}/health`);
            const data = await response.json();
            return data.status === 'ok';
        } catch (error) {
            console.error('API Error:', error);
            return false;
        }
    },

    async searchTracks(query) {
        try {
            const response = await fetch(`${API_URL}/search?query=${encodeURIComponent(query)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка поиска');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async getRecommendations() {
        try {
            const response = await fetch(`${API_URL}/recommendations`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка получения рекомендаций');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    async getTrack(id) {
        try {
            const response = await fetch(`${API_URL}/track/${id}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка получения информации о треке');
            }
            
            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    // Получение URL для воспроизведения
    async getPlayUrl(id) {
        if (!id) {
            throw new Error('ID трека обязателен');
        }
        const { data } = await fetch(`${API_URL}/play/${id}`);
        return data.url;
    }
}; 