import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

class YTMusicService {
    async checkHealth() {
        try {
            const response = await axios.get(`${API_BASE_URL}/health`);
            return response.data.status === 'ok';
        } catch (error) {
            console.error('Ошибка проверки состояния сервера:', error);
            return false;
        }
    }

    async searchTracks(query) {
        try {
            const response = await axios.get(`${API_BASE_URL}/search`, {
                params: { q: query }
            });
            return response.data;
        } catch (error) {
            console.error('Ошибка поиска:', error);
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

    async getFavoriteTracks() {
        try {
            const response = await axios.get(`${API_BASE_URL}/favorites`);
            return response.data;
        } catch (error) {
            console.error('Ошибка получения любимых треков:', error);
            throw error;
        }
    }

    async addToFavorites(id) {
        try {
            const response = await axios.post(`${API_BASE_URL}/favorites/${id}`);
            return response.data;
        } catch (error) {
            console.error('Ошибка добавления в любимые:', error);
            throw error;
        }
    }

    async removeFromFavorites(id) {
        try {
            const response = await axios.delete(`${API_BASE_URL}/favorites/${id}`);
            return response.data;
        } catch (error) {
            console.error('Ошибка удаления из любимых:', error);
            throw error;
        }
    }

    async checkIsFavorite(id) {
        try {
            const response = await axios.get(`${API_BASE_URL}/favorites/${id}`);
            return response.data.isFavorite;
        } catch (error) {
            console.error('Ошибка проверки избранного:', error);
            return false;
        }
    }

    async getNewReleases() {
        try {
            const response = await axios.get(`${API_BASE_URL}/new-releases`);
            return response.data;
        } catch (error) {
            console.error('Ошибка получения новых релизов:', error);
            throw error;
        }
    }
}

export const ytmusicService = new YTMusicService(); 