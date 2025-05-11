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
            const response = await fetch(`${API_BASE_URL}/track/${id}`);
            if (!response.ok) throw new Error('Failed to fetch track');
            return await response.json();
        } catch (error) {
            console.error('Error fetching track:', error);
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

    async getFavoriteTracks() {
        try {
            const response = await fetch(`${API_BASE_URL}/favorites`);
            if (!response.ok) throw new Error('Failed to fetch favorite tracks');
            return await response.json();
        } catch (error) {
            console.error('Error fetching favorite tracks:', error);
            throw error;
        }
    }

    async getNewReleases() {
        try {
            const response = await fetch(`${API_BASE_URL}/new-releases`);
            if (!response.ok) throw new Error('Failed to fetch new releases');
            return await response.json();
        } catch (error) {
            console.error('Error fetching new releases:', error);
            throw error;
        }
    }
}

export const ytmusicService = new YoutubeMusicService(); 