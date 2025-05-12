import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ytmusicService } from './services/ytmusicService';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentPlaylist, setCurrentPlaylist] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(true);
  const [favoriteTracksCount, setFavoriteTracksCount] = useState(0);
  const [favoriteTracksIds, setFavoriteTracksIds] = useState(new Set());
  const [artistInfo, setArtistInfo] = useState(null);
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [viewMode, setViewMode] = useState('list');

  const handleTrackSelect = useCallback(async (track, playlist = null) => {
    try {
      setLoading(true);
      setError(null);
      setIsBuffering(true);

      // Обновляем текущий плейлист если он передан
      if (playlist) {
        setCurrentPlaylist(playlist);
        const trackIndex = playlist.findIndex(t => t.id === track.id);
        setCurrentTrackIndex(trackIndex);
      }

      const trackData = await ytmusicService.getTrack(track.id);
      
      if (!trackData) {
        throw new Error('Не удалось получить данные трека');
      }

      // Проверяем готовность трека к воспроизведению
      const checkResponse = await fetch(`http://localhost:5000/api/check/${track.id}`);
      const checkData = await checkResponse.json();
      
      if (!checkData.ready) {
        throw new Error('Трек не готов к воспроизведению');
      }

      const audioUrl = `http://localhost:5000/api/play/${track.id}`;

      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          setIsPlaying(false);
        }

        const loadAudioPromise = new Promise((resolve, reject) => {
          const audio = audioRef.current;
          if (!audio) {
            reject(new Error('Аудио элемент не найден'));
            return;
          }

          const handleCanPlay = () => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            resolve();
          };

          const handleError = (e) => {
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('error', handleError);
            reject(new Error(e.target.error?.message || 'Ошибка загрузки аудио'));
          };

          audio.addEventListener('canplay', handleCanPlay);
          audio.addEventListener('error', handleError);

          audio.src = audioUrl;
          audio.load();
        });

        setCurrentTrack({ ...trackData, playUrl: audioUrl });
        await loadAudioPromise;

        if (audioRef.current) {
          await audioRef.current.play();
          setIsPlaying(true);
          setError(null);
        }
      } catch (error) {
        console.error('Ошибка при загрузке аудио:', error);
        setError(`Ошибка при загрузке аудио: ${error.message}`);
        if (audioRef.current) {
          audioRef.current.src = '';
        }
        setIsPlaying(false);
        throw error;
      }
    } catch (error) {
      console.error('Ошибка при выборе трека:', error);
      setError(`Ошибка при загрузке трека: ${error.message}`);
      setIsPlaying(false);
    } finally {
      setLoading(false);
      setIsBuffering(false);
    }
  }, []);

  // Функция для переключения на следующий трек
  const playNextTrack = useCallback(async () => {
    if (!currentPlaylist.length || currentTrackIndex === -1) return;
    
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    setCurrentTrackIndex(nextIndex);
    await handleTrackSelect(currentPlaylist[nextIndex]);
  }, [currentPlaylist, currentTrackIndex, handleTrackSelect]);

  // Функция для переключения на предыдущий трек
  const playPreviousTrack = useCallback(async () => {
    if (!currentPlaylist.length || currentTrackIndex === -1) return;
    
    const prevIndex = (currentTrackIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    setCurrentTrackIndex(prevIndex);
    await handleTrackSelect(currentPlaylist[prevIndex]);
  }, [currentPlaylist, currentTrackIndex, handleTrackSelect]);

  // Обработка темы
  useEffect(() => {
    // Проверяем сохраненную тему
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setIsDarkTheme(savedTheme === 'dark');
    } else {
      // Проверяем системные настройки
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDarkTheme(prefersDark);
    }
  }, []);

  useEffect(() => {
    // Применяем тему
    document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(!isDarkTheme);
  };

  // Проверка состояния сервера и загрузка рекомендаций
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const isServerReady = await ytmusicService.checkHealth();
        setServerStatus(isServerReady);
        
        if (isServerReady) {
          await loadRecommendations();
        }
      } catch (error) {
        setError('Сервер недоступен');
        console.error('Ошибка инициализации:', error);
      }
    };

    initializeApp();
  }, []);

  // Обработка ошибок воспроизведения
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleError = (e) => {
      console.error('Ошибка воспроизведения:', e);
      setError('Ошибка воспроизведения аудио');
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (currentPlaylist.length > 1) {
        playNextTrack();
      } else {
        setCurrentTrack(null);
      }
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentPlaylist, playNextTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const currentTime = audio.currentTime;
      const duration = audio.duration;
      
      if (!isNaN(currentTime)) {
        setProgress(currentTime);
      }
      
      if (!isNaN(duration) && duration > 0) {
        setDuration(duration);
      }
    };

    const handleLoadedMetadata = () => {
      const duration = audio.duration;
      if (!isNaN(duration) && duration > 0) {
        setDuration(duration);
        setIsBuffering(false);
      }
    };

    const handleError = (e) => {
      const error = e.target.error;
      console.error('Ошибка аудио:', error);
      
      let errorMessage = 'Произошла ошибка при воспроизведении';
      if (error) {
        switch (error.code) {
          case 1:
            errorMessage = 'Загрузка медиа прервана';
            break;
          case 2:
            errorMessage = 'Ошибка сети при загрузке медиа';
            break;
          case 3:
            errorMessage = 'Ошибка декодирования медиа';
            break;
          case 4:
            errorMessage = 'Медиа источник не поддерживается';
            break;
          default:
            errorMessage = `Ошибка воспроизведения: ${error.message}`;
        }
      }
      
      setError(errorMessage);
      setIsPlaying(false);
      setLoading(false);
      setIsBuffering(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await ytmusicService.getRecommendations();
      setRecommendations(data);
    } catch (error) {
      setError('Ошибка загрузки рекомендаций');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const data = await ytmusicService.searchTracks(searchQuery);
      setSearchResults(data);
    } catch (error) {
      setError('Ошибка поиска');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Добавляем очистку при размонтировании компонента
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, []);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || loading) return;

    try {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Ошибка воспроизведения:', error);
            setError('Не удалось начать воспроизведение');
          });
        }
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Ошибка управления воспроизведением:', error);
      setError('Ошибка управления воспроизведением');
    }
  }, [isPlaying, loading]);

  // Обновляем функцию форматирования времени
  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    
    // Конвертируем миллисекунды в секунды если значение слишком большое
    if (timeInSeconds > 3600000) {
      timeInSeconds = timeInSeconds / 1000;
    }
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Функция для получения длительности трека
  const getTrackDuration = useCallback((track) => {
    if (!track) return 0;
    
    // Проверяем различные форматы длительности
    if (track.duration_ms) {
      return track.duration_ms / 1000; // Конвертируем миллисекунды в секунды
    }
    if (track.duration) {
      // Если длительность уже в секундах
      return typeof track.duration === 'number' ? track.duration : 0;
    }
    return 0;
  }, []);

  const handleProgressClick = useCallback((e) => {
    if (!audioRef.current || !progressRef.current || loading || isBuffering) return;
    
    const progressBar = progressRef.current;
    const rect = progressBar.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = Math.max(0, Math.min(1, x / width));
    const newTime = percentage * audioRef.current.duration;
    
    try {
      audioRef.current.currentTime = newTime;
      setProgress(newTime);
    } catch (error) {
      console.error('Ошибка при перемотке:', error);
      setError('Не удалось выполнить перемотку. Попробуйте позже.');
    }
  }, [loading, isBuffering]);

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !audioRef.current.muted;
      audioRef.current.muted = newMuted;
      setIsMuted(newMuted);
    }
  };

  // Функция для добавления/удаления трека из любимых
  const toggleFavorite = useCallback(async (trackId) => {
    try {
      setLoading(true);
      const isFavorite = favoriteTracksIds.has(trackId);
      
      if (isFavorite) {
        await ytmusicService.removeFromFavorites(trackId);
        setFavoriteTracksIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(trackId);
          return newSet;
        });
      } else {
        await ytmusicService.addToFavorites(trackId);
        setFavoriteTracksIds(prev => new Set([...prev, trackId]));
      }
    } catch (error) {
      setError('Ошибка при обновлении избранного');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [favoriteTracksIds]);

  // Функция для проверки, является ли трек любимым
  const checkIsFavorite = useCallback(async (trackId) => {
    try {
      const isFavorite = await ytmusicService.checkIsFavorite(trackId);
      if (isFavorite) {
        setFavoriteTracksIds(prev => new Set([...prev, trackId]));
      }
      return isFavorite;
    } catch (error) {
      console.error('Ошибка проверки избранного:', error);
      return false;
    }
  }, []);

  // Добавляем эффект для загрузки состояния любимых треков при монтировании
  useEffect(() => {
    const loadFavoriteStates = async () => {
      try {
        const favorites = await ytmusicService.getFavoriteTracks();
        const favoriteIds = new Set(favorites.map(track => track.id));
        setFavoriteTracksIds(favoriteIds);
      } catch (error) {
        console.error('Ошибка загрузки состояний избранного:', error);
      }
    };

    loadFavoriteStates();
  }, []);

  // Обновляем функцию рендеринга списка треков
  const renderTrackList = useCallback((tracks, title) => (
    <div className="track-list">
      <h2>{title}</h2>
      {tracks.length === 0 ? (
        <div className="empty-list-message">
          <span className="empty-icon">💔</span>
          <p>Список пуст</p>
          {title === 'Любимые треки' && (
            <p className="empty-description">
              Нажмите на сердечко рядом с треком, чтобы добавить его в избранное
            </p>
          )}
        </div>
      ) : (
        tracks.map((track, index) => (
          <div 
            key={track.id} 
            className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
          >
            <span className="track-number">{index + 1}</span>
            <div className="track-main" onClick={() => !loading && handleTrackSelect(track, tracks)}>
              <img 
                src={track.album?.images[0]?.url || '/default-album.png'} 
                alt={track.name} 
                className="track-image"
                onError={(e) => {
                  e.target.src = '/default-album.png';
                }}
              />
              <div className="track-info">
                <h3>{track.name}</h3>
                <p>{track.artists.map(artist => artist.name).join(', ')}</p>
              </div>
            </div>
            <span className="track-duration">
              {formatTime(getTrackDuration(track))}
            </span>
            {currentTrack?.id === track.id ? (
              <div className="track-status">
                {loading ? (
                  <i className="fas fa-spinner fa-spin"></i>
                ) : isPlaying ? (
                  <i className="fas fa-volume-up"></i>
                ) : (
                  <i className="fas fa-pause"></i>
                )}
              </div>
            ) : (
              <button 
                className={`favorite-button ${favoriteTracksIds.has(track.id) ? 'active' : ''}`}
                onClick={() => toggleFavorite(track.id)}
                disabled={loading}
              >
                <i className={`fas ${favoriteTracksIds.has(track.id) ? 'fa-heart' : 'fa-heart'}`}></i>
              </button>
            )}
          </div>
        ))
      )}
    </div>
  ), [currentTrack, loading, isPlaying, handleTrackSelect, favoriteTracksIds, toggleFavorite, formatTime, getTrackDuration]);

  // Компонент для отображения ошибок
  const ErrorMessage = ({ message }) => (
    <div className="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>{message}</span>
    </div>
  );

  // Добавляем приветственное сообщение
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Доброе утро';
    if (hour >= 12 && hour < 18) return 'Добрый день';
    if (hour >= 18 && hour < 23) return 'Добрый вечер';
    return 'Доброй ночи';
  };

  // Функция для воспроизведения случайного плейлиста
  const playRandomPlaylist = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Получаем случайный трек из рекомендаций
      if (recommendations.length > 0) {
        const randomIndex = Math.floor(Math.random() * recommendations.length);
        await handleTrackSelect(recommendations[randomIndex]);
      } else {
        // Если рекомендации пусты, загружаем новые
        await loadRecommendations();
      }
    } catch (error) {
      setError('Не удалось воспроизвести случайный плейлист');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [recommendations, handleTrackSelect]);

  // Функция для загрузки любимых треков
  const loadFavoriteTracks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Здесь будет запрос к API для получения любимых треков
      const response = await ytmusicService.getFavoriteTracks();
      setSearchResults(response);
      setFavoriteTracksCount(response.length);
    } catch (error) {
      setError('Не удалось загрузить любимые треки');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Функция для загрузки новых релизов
  const loadNewReleases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Здесь будет запрос к API для получения новых релизов
      const response = await ytmusicService.getNewReleases();
      setSearchResults(response);
    } catch (error) {
      setError('Не удалось загрузить новые релизы');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Обработчик клавиатуры
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch(e.code) {
        case 'Space':
          e.preventDefault();
          if (currentTrack) togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (currentTrack && currentPlaylist.length > 1) playPreviousTrack();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (currentTrack && currentPlaylist.length > 1) playNextTrack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentTrack, currentPlaylist, togglePlay, playPreviousTrack, playNextTrack]);

  // Add this new component function before the renderTrackList function
  const renderTrackCards = useCallback((tracks, title) => (
    <div className="track-list">
      <h2>{title}</h2>
      {tracks.length === 0 ? (
        <div className="empty-list-message">
          <span className="empty-icon">💔</span>
          <p>Список пуст</p>
          {title === 'Любимые треки' && (
            <p className="empty-description">
              Нажмите на сердечко рядом с треком, чтобы добавить его в избранное
            </p>
          )}
        </div>
      ) : (
        <div className="tracks-grid">
          {tracks.map(track => (
            <div 
              key={track.id} 
              className={`track-card ${currentTrack?.id === track.id ? 'active' : ''}`}
            >
              <div className="track-card-image-container">
                <img 
                  src={track.album?.images[0]?.url || '/default-album.png'} 
                  alt={track.name} 
                  className="track-card-image"
                  onError={(e) => {
                    e.target.src = '/default-album.png';
                  }}
                />
                <div className="track-card-overlay" onClick={() => !loading && handleTrackSelect(track, tracks)}>
                  <div className="track-card-play">
                    {currentTrack?.id === track.id && isPlaying ? (
                      <i className="fas fa-pause"></i>
                    ) : (
                      <i className="fas fa-play"></i>
                    )}
                  </div>
                </div>
                <button 
                  className="track-card-favorite"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(track.id);
                  }}
                  disabled={loading}
                >
                  {favoriteTracksIds.has(track.id) ? '❤️' : '🤍'}
                </button>
              </div>
              <div className="track-card-content">
                <h3 className="track-card-title">{track.name}</h3>
                <p className="track-card-artist">
                  {track.artists.map(artist => artist.name).join(', ')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  ), [currentTrack, loading, isPlaying, handleTrackSelect, favoriteTracksIds, toggleFavorite]);

  // Обновим функцию fetchArtistInfo
  const fetchArtistInfo = useCallback(async (trackData) => {
    if (!trackData?.artists?.length) return;
    
    try {
      const artistName = trackData.artists[0].name;
      
      // Пытаемся получить информацию по имени исполнителя
      try {
        const artistData = await ytmusicService.getArtistByName(artistName);
        if (artistData) {
          setArtistInfo({
            id: artistData.id,
            name: artistData.name,
            image: artistData.image,
            followers: artistData.followers,
            description: artistData.description
          });
          return;
        }
      } catch (error) {
        console.log('Не удалось получить информацию по имени исполнителя, используем резервные данные');
      }
      
      // Если не удалось получить по имени, создаем базовую информацию
      setArtistInfo({
        name: artistName,
        image: null,
        followers: "более 1 000 000 слушателей",
        description: "Исполнитель из коллекции YouTube Music. Музыка исполнителя — это переосмысление сложившихся традиций, смешанных с современными тенденциями."
      });
    } catch (error) {
      console.error("Ошибка при получении информации об исполнителе:", error);
      setArtistInfo(null);
    }
  }, []);

  // Обновим useEffect для вызова fetchArtistInfo
  useEffect(() => {
    if (currentTrack?.artists?.length > 0) {
      fetchArtistInfo(currentTrack);
      
      // Скроллим боковую панель вверх при смене трека
      const sidebarElement = document.querySelector('.sidebar-right');
      if (sidebarElement) {
        sidebarElement.scrollTop = 0;
      }
    }
  }, [currentTrack, fetchArtistInfo]);

  // Добавим функцию для получения следующего трека
  const getNextTrack = useCallback(() => {
    if (!currentPlaylist.length || currentTrackIndex === -1) return null;
    const nextIndex = (currentTrackIndex + 1) % currentPlaylist.length;
    return currentPlaylist[nextIndex];
  }, [currentPlaylist, currentTrackIndex]);

  if (!serverStatus) {
    return (
      <div className="app">
        <div className="error-screen">
          <h1>Сервер недоступен</h1>
          <p>Пожалуйста, проверьте подключение и перезагрузите страницу</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app ${isDarkTheme ? 'dark' : 'light'}`}>
      <header className="app-header">
        <div className="header-navigation">
          <div className="header-left">
            <div className="app-logo">
              <span className="logo-icon">🎵</span>
              <span className="logo-text">YTMusic</span>
            </div>
          </div>

          <div className="search-container">
            <form onSubmit={handleSearch} className="search-form">
              <div className="search-input-wrapper">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Что хотите послушать?"
                  className="search-input"
                  disabled={loading}
                />
              </div>
            </form>
          </div>

          <div className="header-right">
            <button 
              className="theme-toggle" 
              onClick={toggleTheme}
              title={isDarkTheme ? "Включить светлую тему" : "Включить темную тему"}
            >
              {isDarkTheme ? '☀️' : '🌙'}
            </button>
            <button className="install-button">
              Установить приложение
            </button>
            <button className="profile-button">
              <span className="profile-icon">👤</span>
            </button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="greeting-section">
          <div className="greeting-content">
            <div className="greeting-header">
              <div className="greeting-title-group">
                <h1 className="greeting-title">{getGreeting()}</h1>
                <div className="greeting-weather">
                  <span className="weather-icon">☀️</span>
                  <span className="weather-temp">+23°C</span>
                </div>
              </div>
              <div className="greeting-time-wrapper">
                <div className="greeting-date">
                  {new Date().toLocaleDateString('ru-RU', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div className="greeting-time">
                  {new Date().toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
            
            <div className="greeting-message">
              <p className="greeting-subtitle">Добро пожаловать в YouTube Music Player</p>
              <p className="greeting-description">Откройте для себя новую музыку и наслаждайтесь любимыми треками</p>
            </div>

            <div className="greeting-stats">
              <div className="stat-item">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon">🎵</span>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{recommendations.length}</span>
                  <span className="stat-label">Рекомендаций</span>
                </div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon">🎧</span>
                </div>
                <div className="stat-content">
                  <span className="stat-value">{searchResults?.length || 0}</span>
                  <span className="stat-label">Найдено треков</span>
                </div>
              </div>
              <div className="stat-divider"></div>
              <div className="stat-item">
                <div className="stat-icon-wrapper">
                  <span className="stat-icon">🔥</span>
                </div>
                <div className="stat-content">
                  <span className="stat-value">24</span>
                  <span className="stat-label">Популярных</span>
                </div>
              </div>
            </div>

            <div className="quick-actions">
              <button 
                className="action-button" 
                onClick={playRandomPlaylist}
                disabled={loading || recommendations.length === 0}
              >
                <span className="action-icon">▶️</span>
                <span>Случайный трек</span>
              </button>
              <button 
                className="action-button"
                onClick={loadFavoriteTracks}
                disabled={loading}
              >
                <span className="action-icon">❤️</span>
                <span>Любимые треки</span>
              </button>
              <button 
                className="action-button"
                onClick={loadNewReleases}
                disabled={loading}
              >
                <span className="action-icon">🎵</span>
                <span>Новые релизы</span>
              </button>
            </div>
          </div>
          
          <div className="greeting-decoration">
            <div className="decoration-circles">
              <div className="circle circle-1"></div>
              <div className="circle circle-2"></div>
              <div className="circle circle-3"></div>
            </div>
            <div className="decoration-waves">
              <div className="wave wave-1"></div>
              <div className="wave wave-2"></div>
            </div>
          </div>
        </div>

        {error && <ErrorMessage message={error} />}
        
        {loading && <div className="loading">Загрузка...</div>}
        
        {!loading && (
          <>
            <div className="view-toggle-container">
              <div className="view-toggle">
                <button 
                  className={`view-toggle-button ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className="fas fa-list"></i>
                  Список
                </button>
                <button 
                  className={`view-toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => setViewMode('grid')}
                >
                  <i className="fas fa-th"></i>
                  Плитка
                </button>
              </div>
            </div>

            {searchResults && searchResults.length > 0 ? (
              viewMode === 'list' 
                ? renderTrackList(searchResults, 'Результаты поиска')
                : renderTrackCards(searchResults, 'Результаты поиска')
            ) : searchResults !== null && (
              viewMode === 'list'
                ? renderTrackList([], 'Любимые треки')
                : renderTrackCards([], 'Любимые треки')
            )}
            
            {!searchResults?.length && recommendations.length > 0 && (
              viewMode === 'list'
                ? renderTrackList(recommendations, 'Рекомендации')
                : renderTrackCards(recommendations, 'Рекомендации')
            )}
          </>
        )}
      </main>

      {currentTrack && (
        <div className="player">
          <div className="player-controls">
            <button 
              className="control-button shuffle"
              onClick={() => {/* TODO: добавить перемешивание */}}
              disabled={!currentPlaylist.length}
              title="Перемешать"
            >
              <i className="fas fa-random"></i>
            </button>

            <button 
              className="control-button"
              onClick={playPreviousTrack}
              disabled={!currentPlaylist.length || currentTrackIndex === -1}
              title="Предыдущий трек"
            >
              <i className="fas fa-step-backward"></i>
            </button>
            
            <button 
              className="control-button play-pause" 
              onClick={togglePlay}
              disabled={loading || !currentTrack}
              title={isPlaying ? "Пауза" : "Воспроизвести"}
            >
              {loading ? (
                <i className="fas fa-spinner fa-spin"></i>
              ) : isPlaying ? (
                <i className="fas fa-pause"></i>
              ) : (
                <i className="fas fa-play"></i>
              )}
            </button>
            
            <button 
              className="control-button"
              onClick={playNextTrack}
              disabled={!currentPlaylist.length || currentTrackIndex === -1}
              title="Следующий трек"
            >
              <i className="fas fa-step-forward"></i>
            </button>

            <button 
              className="control-button repeat"
              onClick={() => {/* TODO: добавить повтор */}}
              disabled={!currentTrack}
              title="Повторить"
            >
              <i className="fas fa-redo"></i>
            </button>
          </div>
          
          <div className="spotify-player-content">
            <div className="player-left">
              <img 
                src={currentTrack.album?.images[0]?.url || '/default-album.png'} 
                alt={currentTrack.name}
                className="current-track-image"
                onError={(e) => {
                  e.target.src = '/default-album.png';
                }}
              />
              <div className="current-track-info">
                <h3>{currentTrack.name}</h3>
                <p>{currentTrack.artists.map(artist => artist.name).join(', ')}</p>
              </div>
            </div>

            <div className="player-center">
              <div className="progress-container">
                <span className="time-display">{formatTime(progress)}</span>
                <div 
                  className="progress-bar" 
                  ref={progressRef}
                  onClick={handleProgressClick}
                >
                  <div 
                    className="progress-fill" 
                    style={{ 
                      width: `${duration > 0 ? (progress / duration) * 100 : 0}%` 
                    }}
                  />
                </div>
                <span className="time-display">{formatTime(duration)}</span>
              </div>
            </div>

            <div className="player-right">
              <div className="volume-control">
                <button onClick={toggleMute} className="volume-button">
                  {isMuted ? (
                    <i className="fas fa-volume-mute"></i>
                  ) : volume > 0.5 ? (
                    <i className="fas fa-volume-up"></i>
                  ) : volume > 0 ? (
                    <i className="fas fa-volume-down"></i>
                  ) : (
                    <i className="fas fa-volume-off"></i>
                  )}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="volume-slider"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar-right">
        {/* Превью текущего трека */}
        <section className="current-track-preview">
          <div className="preview-header">
            <h3 className="preview-title">
              <i className="fas fa-music preview-title-icon"></i>
              Сейчас играет
            </h3>
          </div>
          <div className="preview-content">
            {currentTrack ? (
              <div className="preview-track">
                <div className="preview-track-image-container">
                  {currentTrack.album?.images?.[0]?.url ? (
                    <img 
                      src={currentTrack.album.images[0].url} 
                      alt={currentTrack.name} 
                      className="preview-track-image"
                    />
                  ) : (
                    <div className="preview-track-placeholder">
                      <i className="fas fa-music"></i>
                    </div>
                  )}
                </div>
                <div className="preview-track-info">
                  <h4 className="preview-track-name">{currentTrack.name}</h4>
                  <p className="preview-track-artist">
                    {currentTrack.artists.map(artist => artist.name).join(', ')}
                  </p>
                  <div className="preview-actions">
                    <button 
                      className={`preview-action-button favorite ${favoriteTracksIds.has(currentTrack.id) ? 'active' : ''}`}
                      onClick={() => toggleFavorite(currentTrack.id)}
                      title={favoriteTracksIds.has(currentTrack.id) ? 'Удалить из избранного' : 'Добавить в избранное'}
                    >
                      <i className={favoriteTracksIds.has(currentTrack.id) ? 'fas fa-heart' : 'far fa-heart'}></i>
                    </button>
                    <button 
                      className="preview-action-button"
                      title="Поделиться"
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>
                    <button 
                      className="preview-action-button"
                      title="Добавить в плейлист"
                    >
                      <i className="fas fa-plus"></i>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="preview-track">
                <div className="preview-track-image-container">
                  <div className="preview-track-placeholder">
                    <i className="fas fa-music"></i>
                  </div>
                </div>
                <div className="preview-track-info">
                  <p className="preview-track-placeholder-text">Выберите песню для воспроизведения</p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Информация об исполнителе */}
        <section className="artist-info">
          <div className="artist-header">
            {artistInfo && artistInfo.image ? (
              <img 
                src={artistInfo.image} 
                alt={artistInfo.name} 
                className="artist-image" 
              />
            ) : (
              <div className="artist-placeholder">
                <i className="fas fa-user"></i>
              </div>
            )}
            <h3 className="artist-name">{artistInfo ? artistInfo.name : 'Исполнитель'}</h3>
          </div>
          <div className="artist-followers">
            <i className="fas fa-users"></i>
            <span>{artistInfo ? artistInfo.followers : '0 слушателей'}</span>
          </div>
          <p className="artist-details">
            {artistInfo ? 
              artistInfo.description.split('\n\n').map((paragraph, index) => (
                <span key={index}>
                  {paragraph}
                  {index < artistInfo.description.split('\n\n').length - 1 && <br />}
                </span>
              )) 
              : 'Выберите песню, чтобы узнать больше об исполнителе.'}
          </p>
        </section>

        {/* Следующий трек */}
        <section className="next-track">
          <div className="next-track-header">
            <h3 className="next-track-title">
              <i className="fas fa-stream next-track-icon"></i>
              <span>Далее в очереди</span>
            </h3>
          </div>
          {getNextTrack() ? (
            <div 
              className="next-track-content"
              onClick={() => handleTrackSelect(getNextTrack(), currentPlaylist)}
            >
              {getNextTrack().album?.images?.[0]?.url ? (
                <img 
                  src={getNextTrack().album.images[0].url} 
                  alt={getNextTrack().name} 
                  className="next-track-image"
                />
              ) : (
                <div className="next-track-placeholder-icon">
                  <i className="fas fa-music"></i>
                </div>
              )}
              <div className="next-track-info">
                <h4 className="next-track-name">{getNextTrack().name}</h4>
                <p className="next-track-artist">
                  {getNextTrack().artists.map(artist => artist.name).join(', ')}
                </p>
              </div>
              <span className="next-track-duration">
                {getNextTrack().duration ? formatTime(getNextTrack().duration) : "0:00"}
              </span>
            </div>
          ) : (
            <div className="next-track-placeholder">
              <div className="next-track-placeholder-icon">
                <i className="fas fa-music"></i>
              </div>
              <span className="next-track-placeholder-text">Нет треков в очереди</span>
            </div>
          )}
        </section>
      </aside>

      <audio
        ref={audioRef}
        preload="metadata"
        onLoadStart={() => {
          setIsBuffering(true);
          setError(null);
        }}
        onLoadedMetadata={(e) => {
          const duration = e.target.duration;
          if (!isNaN(duration) && duration > 0) {
            setDuration(duration);
          }
        }}
        onCanPlayThrough={() => {
          setIsBuffering(false);
          if (isPlaying && audioRef.current?.paused) {
            audioRef.current.play().catch(error => {
              console.error('Ошибка возобновления воспроизведения:', error);
              setError('Не удалось возобновить воспроизведение');
              setIsPlaying(false);
            });
          }
        }}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
          setError(null);
        }}
        onTimeUpdate={(e) => {
          const currentTime = e.target.currentTime;
          if (!isNaN(currentTime)) {
            setProgress(currentTime);
          }
        }}
        onError={(e) => {
          const error = e.target.error;
          console.error('Ошибка аудио элемента:', error);
          let errorMessage = 'Ошибка воспроизведения';
          
          if (error) {
            switch (error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                errorMessage = 'Воспроизведение прервано';
                break;
              case MediaError.MEDIA_ERR_NETWORK:
                errorMessage = 'Ошибка сети при загрузке';
                break;
              case MediaError.MEDIA_ERR_DECODE:
                errorMessage = 'Ошибка декодирования аудио';
                break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                errorMessage = 'Формат аудио не поддерживается';
                break;
              default:
                errorMessage = `Ошибка воспроизведения: ${error.message || 'неизвестная ошибка'}`;
            }
          }
          
          setError(errorMessage);
          setIsPlaying(false);
          setLoading(false);
          setIsBuffering(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setProgress(0);
          if (currentPlaylist.length > 1) {
            playNextTrack();
          } else {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = '';
            }
          }
        }}
        onWaiting={() => setIsBuffering(true)}
        onStalled={() => setIsBuffering(true)}
      />

      {(loading || isBuffering) && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
}

export default App;