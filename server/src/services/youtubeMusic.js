const YoutubeMusicApi = require('youtube-music-api');
const ytdl = require('@distube/ytdl-core');
const config = require('../config/config');

class YoutubeMusicService {
    constructor() {
        this.api = new YoutubeMusicApi();
        this.trackCache = new Map();
        this.initializeApi();
        this.setupCacheCleaning();
    }

    async initializeApi() {
        try {
            await this.api.initalize({
                headers: {
                    'User-Agent': config.youtube.userAgent,
                    'Accept-Language': config.youtube.acceptLanguage,
                    'X-Goog-Visitor-Id': ''
                }
            });
            console.log('YouTube Music API инициализирован успешно');
        } catch (error) {
            console.error('Ошибка инициализации YouTube Music API:', error);
            process.exit(1);
        }
    }

    setupCacheCleaning() {
        setInterval(() => {
            this.trackCache.clear();
        }, config.cache.clearInterval);
    }

    async prepareTrack(id) {
        try {
            if (this.trackCache.has(id)) {
                return this.trackCache.get(id);
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

            this.trackCache.set(id, trackInfo);
            return trackInfo;
        } catch (error) {
            console.error('Ошибка подготовки трека:', error);
            return null;
        }
    }

    async search(query, type = "song") {
        return await this.api.search(query, type);
    }

    async getArtist(id) {
        return await this.api.getArtist(id);
    }

    createAudioStream(videoUrl, format, range = null) {
        const options = {
            format,
            filter: 'audioonly',
            quality: 'highestaudio',
            highWaterMark: 1024 * 1024
        };

        if (range) {
            options.range = range;
        }

        return ytdl(videoUrl, options);
    }
}

module.exports = new YoutubeMusicService(); 