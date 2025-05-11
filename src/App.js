import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ytmusicService } from './services/ytmusicService';
import './App.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [serverStatus, setServerStatus] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const audioRef = useRef(null);
  const progressRef = useRef(null);

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
      setCurrentTrack(null);
    };

    audio.addEventListener('error', handleError);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration);
    };

    const handleLoadStart = () => {
      setIsBuffering(true);
    };

    const handleCanPlay = () => {
      setIsBuffering(false);
    };

    const handleVolumeChange = () => {
      setVolume(audio.volume);
      setIsMuted(audio.muted);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('volumechange', handleVolumeChange);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('volumechange', handleVolumeChange);
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

  const handleTrackSelect = useCallback(async (track) => {
    try {
        setLoading(true);
        setError(null);

        // Останавливаем текущий трек
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.src = '';
            setIsPlaying(false);
        }

        const trackData = await ytmusicService.getTrack(track.id);
        
        // Создаем URL для потокового воспроизведения
        const audioUrl = `http://localhost:5000/api/play/${track.id}`;
        
        setCurrentTrack({ ...trackData, playUrl: audioUrl });
        
        if (audioRef.current) {
            // Настраиваем аудио элемент
            audioRef.current.src = audioUrl;
            
            // Устанавливаем обработчики событий
            const handleCanPlay = () => {
                console.log('Аудио готово к воспроизведению');
                audioRef.current.play()
                    .then(() => {
                        setIsPlaying(true);
                        setError(null);
                    })
                    .catch(error => {
                        console.error('Ошибка воспроизведения:', error);
                        setError('Не удалось начать воспроизведение. Попробуйте еще раз.');
                        setIsPlaying(false);
                    });
            };

            const handleWaiting = () => {
                console.log('Буферизация...');
                setLoading(true);
            };

            const handlePlaying = () => {
                console.log('Воспроизведение началось');
                setLoading(false);
            };

            const handleLoadStart = () => {
                console.log('Начало загрузки аудио');
                setLoading(true);
            };

            const handleProgress = () => {
                if (audioRef.current.buffered.length > 0) {
                    const bufferedEnd = audioRef.current.buffered.end(audioRef.current.buffered.length - 1);
                    const duration = audioRef.current.duration;
                    console.log(`Загружено ${Math.round((bufferedEnd / duration) * 100)}%`);
                }
            };

            audioRef.current.addEventListener('canplay', handleCanPlay);
            audioRef.current.addEventListener('waiting', handleWaiting);
            audioRef.current.addEventListener('playing', handlePlaying);
            audioRef.current.addEventListener('loadstart', handleLoadStart);
            audioRef.current.addEventListener('progress', handleProgress);

            // Загружаем аудио
            audioRef.current.load();

            // Очистка обработчиков
            return () => {
                if (audioRef.current) {
                    audioRef.current.removeEventListener('canplay', handleCanPlay);
                    audioRef.current.removeEventListener('waiting', handleWaiting);
                    audioRef.current.removeEventListener('playing', handlePlaying);
                    audioRef.current.removeEventListener('loadstart', handleLoadStart);
                    audioRef.current.removeEventListener('progress', handleProgress);
                }
            };
        }
    } catch (error) {
        console.error('Ошибка воспроизведения трека:', error);
        setError('Ошибка воспроизведения трека: ' + (error.message || 'Неизвестная ошибка'));
        setIsPlaying(false);
    } finally {
        setLoading(false);
    }
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

  const formatTime = (time) => {
    if (!time) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (!audioRef.current || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;
    const percentage = x / width;
    const newTime = percentage * audioRef.current.duration;
    
    audioRef.current.currentTime = newTime;
    setProgress(newTime);
  };

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

  const renderTrackList = useCallback((tracks, title) => (
    <div className="track-list">
      <h2>{title}</h2>
      {tracks.map(track => (
        <div 
          key={track.id} 
          className={`track-item ${currentTrack?.id === track.id ? 'active' : ''}`}
          onClick={() => !loading && handleTrackSelect(track)}
        >
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
          {currentTrack?.id === track.id && (
            <div className="track-status">
              {loading ? '⌛' : (isPlaying ? '▶' : '⏸')}
            </div>
          )}
        </div>
      ))}
    </div>
  ), [currentTrack, loading, isPlaying, handleTrackSelect]);

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
    <div className="app">
      <header className="app-header">
        <h1>YouTube Music Player</h1>
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск треков..."
            className="search-input"
            disabled={loading}
          />
          <button type="submit" className="search-button" disabled={loading}>
            {loading ? 'Поиск...' : 'Поиск'}
          </button>
        </form>
      </header>

      <main className="main-content">
        {error && (
          <div className="error-message" onClick={() => setError(null)}>
            {error}
            <span className="error-close">×</span>
          </div>
        )}
        
        {loading && <div className="loading">Загрузка...</div>}
        
        {searchResults.length > 0 && renderTrackList(searchResults, 'Результаты поиска')}
        
        {!searchResults.length && recommendations.length > 0 && 
          renderTrackList(recommendations, 'Рекомендации')}

        {currentTrack && (
          <div className="player">
            <div className="player-content">
              <div className="current-track">
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
                <div className="player-controls">
                  <button 
                    className="play-button"
                    onClick={togglePlay}
                    disabled={loading || isBuffering}
                  >
                    {isBuffering ? '⌛' : (isPlaying ? '⏸' : '▶')}
                  </button>
                  <div className="volume-control">
                    <button onClick={toggleMute}>
                      {isMuted ? '🔇' : volume > 0.5 ? '🔊' : volume > 0 ? '🔉' : '🔈'}
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
              <div 
                className="progress-bar" 
                ref={progressRef}
                onClick={handleProgressClick}
              >
                <div 
                  className="progress-bar-fill" 
                  style={{ width: `${(progress / duration) * 100}%` }}
                />
                <div className="progress-bar-hover" />
              </div>
              <div className="time-info">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          </div>
        )}

        <audio
          ref={audioRef}
          onError={(e) => {
            console.error('Ошибка аудио элемента:', e.target.error);
            setError('Ошибка воспроизведения. Попробуйте другой трек.');
            setIsPlaying(false);
            setLoading(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTrack(null);
          }}
          preload="auto"
        />
      </main>

      {(loading || isBuffering) && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
        </div>
      )}
    </div>
  );
}

export default App;
