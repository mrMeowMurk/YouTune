module.exports = {
    port: 5000,
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Range'],
        exposedHeaders: ['Content-Length', 'Content-Range', 'Accept-Ranges']
    },
    youtube: {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        acceptLanguage: 'en-US,en;q=0.9'
    },
    cache: {
        clearInterval: 3600000 // 1 час
    }
}; 