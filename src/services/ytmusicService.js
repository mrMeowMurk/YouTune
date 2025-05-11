import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class YoutubeMusicService {
    async checkHealth() {
        try {
            const response = await axios.get(`${API_BASE_URL}/health`);
            return response.data.status === 'ok';
        } catch (error) {
            console.error('Ошибка проверки здоровья сервера:', error);
            return false;
        }
    }

    async searchTracks(query) {
        try {
            const response = await axios.get(`${API_BASE_URL}/search`, {
                params: { query }
            });
            return response.data;
        } catch (error) {
            console.error('Ошибка поиска треков:', error);
            throw error;
        }
    }

    async getTrack(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/track/${id}`);
            return response.data;
        } catch (error) {
            console.error('Ошибка получения трека:', error);
            throw error;
        }
    }

    async getRecommendations() {
        try {
            const response = await axios.get(`${API_BASE_URL}/recommendations`);
            return response.data;
        } catch (error) {
            console.error('Ошибка получения рекомендаций:', error);
            throw error;
        }
    }

    // Получение URL для воспроизведения
    async getPlayUrl(id) {
        if (!id) {
            throw new Error('ID трека обязателен');
        }
        const { data } = await axios.get(`${API_BASE_URL}/play/${id}`);
        return data.url;
    }
}

export const ytmusicService = new YoutubeMusicService(); 