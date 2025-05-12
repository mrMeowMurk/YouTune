const express = require('express');
const router = express.Router();
const trackController = require('../controllers/trackController');
const artistController = require('../controllers/artistController');
const favoritesController = require('../controllers/favoritesController');

// Проверка работоспособности сервера
router.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Маршруты для треков
router.get('/search', trackController.search.bind(trackController));
router.get('/track/:id', trackController.getTrack.bind(trackController));
router.get('/check/:id', trackController.checkTrackStatus.bind(trackController));
router.head('/play/:id', trackController.handleAudioRequest.bind(trackController));
router.get('/play/:id', trackController.handleAudioRequest.bind(trackController));
router.get('/lyrics/:id', trackController.getLyrics.bind(trackController));
router.get('/recommendations', trackController.getRecommendations.bind(trackController));

// Маршруты для исполнителей
router.get('/artist/:id', artistController.getArtistById.bind(artistController));
router.get('/artist-by-name/:name', artistController.getArtistByName.bind(artistController));

// Маршруты для избранных треков
router.get('/favorites', favoritesController.getFavorites.bind(favoritesController));
router.post('/favorites/:id', favoritesController.addToFavorites.bind(favoritesController));
router.delete('/favorites/:id', favoritesController.removeFromFavorites.bind(favoritesController));
router.get('/favorites/:id', favoritesController.checkFavorite.bind(favoritesController));

module.exports = router; 