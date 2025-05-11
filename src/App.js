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

  const handleTrackSelect = useCallback(async (track) => {
    try {
      setLoading(true);
      setError(null);
      setIsBuffering(true);

      const trackData = await ytmusicService.getTrack(track.id);
      
      if (!trackData) {
        throw new Error('Не удалось получить данные трека');
      }

      // Проверяем готовность трека
      const checkResponse = await fetch(`http://localhost:5000/api/check/${track.id}`);
      const checkData = await checkResponse.json();
      
      if (!checkData.ready) {
        throw new Error('Трек не готов к воспроизведению');
      }

      // Создаем аудио URL для стриминга
      const audioUrl = `http://localhost:5000/api/play/${track.id}`;
      console.log('Аудио URL:', audioUrl);

      try {
        // Останавливаем текущий трек
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          setIsPlaying(false);
        }

        // Создаем промис для проверки загрузки аудио
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

          // Устанавливаем прямой URL для стриминга
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
  }, [isPlaying]);

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

  const formatTime = (timeInSeconds) => {
    if (!timeInSeconds || isNaN(timeInSeconds)) return '0:00';
    
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

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

  // Компонент для отображения ошибок
  const ErrorMessage = ({ message }) => (
    <div className="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <span>{message}</span>
    </div>
  );

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
        {error && <ErrorMessage message={error} />}
        
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
              <div className="player-controls">
                <div className="progress-container">
                  <div className="time-display" title="Текущее время">
                    {formatTime(progress)}
                  </div>
                  <div 
                    className="progress-bar" 
                    ref={progressRef}
                    onClick={handleProgressClick}
                    style={{ 
                      cursor: loading || isBuffering ? 'not-allowed' : 'pointer',
                      opacity: loading || isBuffering ? 0.6 : 1
                    }}
                  >
                    <div 
                      className="progress-fill" 
                      style={{ 
                        width: `${duration > 0 ? (progress / duration) * 100 : 0}%`,
                        transition: isBuffering ? 'none' : 'width 0.1s linear'
                      }}
                    />
                  </div>
                  <div className="time-display" title="Общая длительность">
                    {formatTime(duration)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

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
            const duration = e.target.duration;
            if (!isNaN(currentTime)) {
              setProgress(currentTime);
            }
            if (!isNaN(duration) && duration > 0) {
              setDuration(duration);
            }
          }}
          onError={(e) => {
            const error = e.target.error;
            if (error) {
              console.error('Ошибка аудио элемента:', error);
              if (!isPlaying) {
                let errorMessage = 'Ошибка воспроизведения';
                switch (error.code) {
                  case 1:
                    errorMessage = 'Загрузка прервана';
                    break;
                  case 2:
                    errorMessage = 'Ошибка сети';
                    break;
                  case 3:
                    errorMessage = 'Ошибка декодирования';
                    break;
                  case 4:
                    errorMessage = 'Формат не поддерживается';
                    break;
                }
                setError(`${errorMessage}. Попробуйте другой трек.`);
              }
            }
            setIsPlaying(false);
            setLoading(false);
            setIsBuffering(false);
          }}
          onEnded={() => {
            setIsPlaying(false);
            setProgress(0);
            // Очищаем при размонтировании компонента
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.src = '';
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onStalled={() => setIsBuffering(true)}
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
