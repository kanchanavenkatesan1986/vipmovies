import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlayerControls from './PlayerControls';
import PlayerGestureHandler from './PlayerGestureHandler';
import PlayerSettingsModal from './PlayerSettingsModal';
import PlayerStatsModal from './PlayerStatsModal';
import ResumeDialog from './ResumeDialog';
import UpNextOverlay from './UpNextOverlay';
import PlayerErrorOverlay from './PlayerErrorOverlay';
import {
  getAspectRatioStyle,
  mediaSessionEngine,
  pipEngine,
  playerStorage,
  screenEngine
} from './playerUtils';
import './player.css';

export default function AdvancedVideoPlayer({
  movie,
  initialQuality = 'auto',
  nextMovie = null,
  onPlayNextMovie,
  onBack,
  autoPlay = true,
  pageMode = false
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const progressSaveThrottleRef = useRef(null);

  // ─── SETTINGS & USER PREFERENCES ───
  const [settings, setSettings] = useState(() => playerStorage.getSettings());
  const [currentQuality, setCurrentQuality] = useState(initialQuality || settings.quality || 'auto');
  const [playbackRate, setPlaybackRate] = useState(settings.playbackRate || 1.0);
  const [aspectRatio, setAspectRatio] = useState(settings.aspectRatio || 'fit');
  const [volume, setVolume] = useState(settings.volume !== undefined ? settings.volume : 1.0);
  const [muted, setMuted] = useState(settings.muted || false);
  const [brightness, setBrightness] = useState(100);

  // ─── PLAYER STATE ───
  const [playerState, setPlayerState] = useState('LOADING'); // 'IDLE' | 'LOADING' | 'PLAYING' | 'PAUSED' | 'BUFFERING' | 'ERROR' | 'ENDED'
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedRanges, setBufferedRanges] = useState([]);
  const [isControlsVisible, setIsControlsVisible] = useState(true);

  // ─── VIEWPORT & ORIENTATION MODES (Player rotation only, NO device lock) ───
  const [isHorizontalMode, setIsHorizontalMode] = useState(false); // 90deg in-page rotated player
  const [isFullscreen, setIsFullscreen] = useState(false); // Fullscreen DOM API
  const [isTheatreMode, setIsTheatreMode] = useState(settings.theatreMode || false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [error, setError] = useState(null);

  // ─── MODALS & DIALOGS ───
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [resumePrompt, setResumePrompt] = useState(null);
  const [showUpNext, setShowUpNext] = useState(false);

  // ─── 1. RESOLVE AVAILABLE VIDEO SOURCES ───
  const availableSources = useMemo(() => {
    if (!movie) return [];
    const sources = [];

    if (movie.p1080 && movie.p1080.trim() !== '#' && movie.p1080.trim() !== '') {
      sources.push({ id: '1080p', label: '1080p Full HD', badge: 'FHD', url: movie.p1080.trim() });
    }
    if (movie.p720 && movie.p720.trim() !== '#' && movie.p720.trim() !== '') {
      sources.push({ id: '720p', label: '720p HD', badge: 'HD', url: movie.p720.trim() });
    }
    const p360_460 = movie.p460 || movie.p360;
    if (p360_460 && p360_460.trim() !== '#' && p360_460.trim() !== '') {
      sources.push({ id: '460p', label: '460p Standard', badge: 'SD', url: p360_460.trim() });
    }
    if (movie.videoUrl && movie.videoUrl.trim() !== '#' && !sources.some(s => s.url === movie.videoUrl.trim())) {
      sources.push({ id: 'source', label: 'Source Quality', badge: 'HD', url: movie.videoUrl.trim() });
    }

    return sources;
  }, [movie]);

  const activeVideoUrl = useMemo(() => {
    if (availableSources.length === 0) return '';
    if (currentQuality !== 'auto') {
      const match = availableSources.find(s => s.id === currentQuality);
      if (match) return match.url;
    }
    return availableSources[0]?.url || '';
  }, [availableSources, currentQuality]);

  // ─── 2. RESOLVE SUBTITLES ───
  const subtitles = useMemo(() => {
    if (!movie) return [];
    const tracks = [];
    if (movie.subtitleUrl) {
      tracks.push({ id: 'tam', label: 'Tamil', src: movie.subtitleUrl, srclang: 'ta' });
    }
    if (movie.subtitleEn) {
      tracks.push({ id: 'eng', label: 'English', src: movie.subtitleEn, srclang: 'en' });
    }
    return tracks;
  }, [movie]);

  // ─── 3. RESUME POSITION CHECK ───
  useEffect(() => {
    if (!movie) return;
    const movieId = movie.id || movie.movieId;
    const saved = playerStorage.getProgress(movieId);

    if (saved && saved.currentTime > 15 && saved.duration > 0 && (saved.duration - saved.currentTime) > 30) {
      setResumePrompt({
        savedTime: saved.currentTime,
        duration: saved.duration
      });
    } else {
      setResumePrompt(null);
    }
  }, [movie]);

  // ─── 4. CONTROLS AUTO-HIDE TIMER ───
  const resetControlsTimer = useCallback(() => {
    setIsControlsVisible(true);
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }

    if (playerState === 'PLAYING' && !isSettingsOpen && !isStatsOpen) {
      const timeout = (settings.controlsTimeoutSeconds || 3.5) * 1000;
      hideControlsTimeoutRef.current = setTimeout(() => {
        setIsControlsVisible(false);
      }, timeout);
    }
  }, [playerState, isSettingsOpen, isStatsOpen, settings.controlsTimeoutSeconds]);

  const handleMouseMove = () => {
    resetControlsTimer();
  };

  // ─── 5. VIDEO ELEMENT EVENT HANDLERS ───
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;

    setCurrentTime(curr);
    if (dur > 0 && dur !== duration) {
      setDuration(dur);
    }

    // Buffered calculation
    const buf = videoRef.current.buffered;
    const ranges = [];
    for (let i = 0; i < buf.length; i++) {
      ranges.push({ start: buf.start(i), end: buf.end(i) });
    }
    setBufferedRanges(ranges);

    // Up Next Check (Last 20 seconds)
    if (nextMovie && dur > 60 && (dur - curr) <= 20 && !showUpNext) {
      setShowUpNext(true);
    }

    // Save Progress Throttled
    if (!progressSaveThrottleRef.current && movie) {
      progressSaveThrottleRef.current = setTimeout(() => {
        progressSaveThrottleRef.current = null;
        if (videoRef.current && settings.rememberPosition) {
          playerStorage.saveProgress(movie.id || movie.movieId, {
            currentTime: videoRef.current.currentTime,
            duration: videoRef.current.duration,
            quality: currentQuality,
            playbackRate: videoRef.current.playbackRate
          });
        }
      }, 4000);
    }

    mediaSessionEngine.updatePositionState(videoRef.current);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration || 0);
    videoRef.current.volume = muted ? 0 : volume;
    videoRef.current.playbackRate = playbackRate;
    setPlayerState('PAUSED');
    setError(null);

    if (autoPlay && !resumePrompt) {
      videoRef.current.play().then(() => {
        setPlayerState('PLAYING');
      }).catch(() => {
        setPlayerState('PAUSED');
      });
    }
  };

  const handlePlay = () => {
    setPlayerState('PLAYING');
    setError(null);
    resetControlsTimer();
  };

  const handlePause = () => {
    setPlayerState('PAUSED');
    setIsControlsVisible(true);
    if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
  };

  const handleWaiting = () => {
    setPlayerState('BUFFERING');
  };

  const handlePlaying = () => {
    setPlayerState('PLAYING');
    resetControlsTimer();
  };

  const handleEnded = () => {
    setPlayerState('ENDED');
    setIsControlsVisible(true);
    if (nextMovie && onPlayNextMovie) {
      onPlayNextMovie();
    }
  };

  const handleError = () => {
    if (!activeVideoUrl) {
      setError(new Error('No video stream source found for this movie.'));
      setPlayerState('ERROR');
      return;
    }
    const mediaErr = videoRef.current?.error;
    let msg = 'Failed to load video stream.';
    if (mediaErr) {
      if (mediaErr.code === 2) msg = 'Network error while loading video stream.';
      else if (mediaErr.code === 3) msg = 'Error decoding video format.';
      else if (mediaErr.code === 4) msg = 'Video format or audio codec not supported by this browser.';
    }
    setError(new Error(msg));
    setPlayerState('ERROR');
  };

  // ─── 6. PLAYBACK CONTROLS API ───
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch(handleError);
    } else {
      videoRef.current.pause();
    }
  }, []);

  const seekTo = useCallback((time) => {
    if (!videoRef.current || isNaN(time)) return;
    const target = Math.max(0, Math.min(time, duration || 100000));
    videoRef.current.currentTime = target;
    setCurrentTime(target);
  }, [duration]);

  const seekRelative = useCallback((deltaSeconds) => {
    if (!videoRef.current) return;
    seekTo(videoRef.current.currentTime + deltaSeconds);
  }, [seekTo]);

  const changeVolume = (newVol) => {
    const clamped = Math.max(0, Math.min(newVol, 1));
    setVolume(clamped);
    setMuted(clamped === 0);
    if (videoRef.current) {
      videoRef.current.volume = clamped;
      videoRef.current.muted = clamped === 0;
    }
    playerStorage.saveSettings({ volume: clamped, muted: clamped === 0 });
  };

  const toggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }
    playerStorage.saveSettings({ muted: nextMuted });
  };

  const changeQuality = (newQuality) => {
    if (newQuality === currentQuality) return;
    const savedTime = videoRef.current ? videoRef.current.currentTime : currentTime;
    const wasPlaying = videoRef.current ? !videoRef.current.paused : false;

    setCurrentQuality(newQuality);
    playerStorage.saveSettings({ quality: newQuality });

    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = savedTime;
        if (wasPlaying) {
          videoRef.current.play().catch(() => {});
        }
      }
    }, 100);
  };

  const changeSpeed = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    playerStorage.saveSettings({ playbackRate: rate });
  };

  const handleTemporarySpeed = (speed) => {
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const handleRestoreSpeed = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  };

  // ─── 7. HORIZONTAL & FULLSCREEN HANDLERS ───
  // Rotate ONLY player container 90deg, phone stays portrait
  const toggleHorizontal = () => {
    setIsHorizontalMode(prev => !prev);
    setIsControlsVisible(true);
    resetControlsTimer();
  };

  // Native Fullscreen on DOM element only (no device orientation lock)
  const toggleFullscreen = async () => {
    if (containerRef.current) {
      await screenEngine.toggleFullscreen(containerRef.current);
      setIsFullscreen(screenEngine.isFullscreen());
    }
  };

  const toggleTheatre = () => {
    const next = !isTheatreMode;
    setIsTheatreMode(next);
    playerStorage.saveSettings({ theatreMode: next });
  };

  const togglePip = async () => {
    if (!videoRef.current) return;
    const active = await pipEngine.togglePip(videoRef.current);
    setIsPipActive(active);
  };

  // Track native fullscreen change
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(screenEngine.isFullscreen());
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  // ─── 8. BACK ACTION IN STRICT PRIORITY ORDER ───
  const handleSmartBack = useCallback(() => {
    // 1. If settings/stats modal open -> close modal
    if (isSettingsOpen) {
      setIsSettingsOpen(false);
      return;
    }
    if (isStatsOpen) {
      setIsStatsOpen(false);
      return;
    }
    // 2. If in fullscreen -> exit fullscreen
    if (isFullscreen) {
      screenEngine.exitFullscreen();
      setIsFullscreen(false);
      return;
    }
    // 3. If in horizontal mode -> exit horizontal mode
    if (isHorizontalMode) {
      setIsHorizontalMode(false);
      return;
    }
    // 4. Otherwise -> navigate back
    if (onBack) {
      onBack();
    }
  }, [isSettingsOpen, isStatsOpen, isFullscreen, isHorizontalMode, onBack]);

  // ─── 9. KEYBOARD SHORTCUTS ───
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
        return;
      }

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekRelative(e.shiftKey ? -10 : -5);
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekRelative(e.shiftKey ? 10 : 5);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(volume + 0.1, 1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(volume - 0.1, 0));
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          toggleMute();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          toggleHorizontal();
          break;
        case 't':
        case 'T':
          e.preventDefault();
          toggleTheatre();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePip();
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          setIsSettingsOpen(!isSettingsOpen);
          break;
        case 'Escape':
          e.preventDefault();
          handleSmartBack();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, seekRelative, volume, toggleMute, isSettingsOpen, handleSmartBack]);

  // ─── 10. MEDIA SESSION API BINDING ───
  useEffect(() => {
    mediaSessionEngine.bindMovie(movie, {
      onPlay: togglePlay,
      onPause: togglePlay,
      onSeekRel: seekRelative,
      onNext: onPlayNextMovie
    });
  }, [movie, togglePlay, seekRelative, onPlayNextMovie]);

  // ─── 11. ONLINE / OFFLINE NETWORK DETECTION ───
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      if (playerState === 'ERROR' && videoRef.current) {
        videoRef.current.load();
      }
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [playerState]);

  const aspectStyle = getAspectRatioStyle(aspectRatio);

  return (
    <div
      ref={containerRef}
      className={[
        'vip-advanced-player-container',
        isHorizontalMode ? 'vip-player-horizontal' : '',
        pageMode && !isHorizontalMode ? 'page-mode' : '',
        !pageMode && !isHorizontalMode && isTheatreMode ? 'theatre-mode' : '',
        isFullscreen ? 'fullscreen-mode' : '',
        brightness < 100 ? 'brightness-filtered' : ''
      ].filter(Boolean).join(' ')}
      style={{ '--player-brightness': brightness / 100 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (playerState === 'PLAYING' && !isSettingsOpen && !isStatsOpen) {
          setIsControlsVisible(false);
        }
      }}
    >
      {/* ── GESTURE ENGINE LAYER ── */}
      <PlayerGestureHandler
        containerRef={containerRef}
        onToggleControls={() => setIsControlsVisible(!isControlsVisible)}
        onSeekRel={seekRelative}
        onSeekTo={seekTo}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onVolumeChange={changeVolume}
        brightness={brightness}
        onBrightnessChange={setBrightness}
        onSpeedTemporary={handleTemporarySpeed}
        onSpeedRestore={handleRestoreSpeed}
        onTogglePlay={togglePlay}
        isRotated90={isHorizontalMode}
      >
        {/* Native HTML5 Video Element */}
        <video
          ref={videoRef}
          className="vip-html5-video"
          src={activeVideoUrl || undefined}
          poster={movie?.image ? `/src/images/${(movie.type || 'tamil').toLowerCase()}/${movie.year || '2026'}/${movie.image}` : undefined}
          preload="metadata"
          playsInline
          style={aspectStyle}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={handlePlay}
          onPause={handlePause}
          onWaiting={handleWaiting}
          onPlaying={handlePlaying}
          onEnded={handleEnded}
          onError={handleError}
        >
          {subtitles.map((sub) => (
            <track
              key={sub.id}
              kind="subtitles"
              label={sub.label}
              src={sub.src}
              srcLang={sub.srclang}
              default={settings.subtitleTrack === sub.id}
            />
          ))}
          Your browser does not support HTML5 video playback.
        </video>
      </PlayerGestureHandler>

      {/* ── CUSTOM CONTROLS OVERLAY ── */}
      <PlayerControls
        movie={movie}
        isVisible={isControlsVisible}
        isPlaying={playerState === 'PLAYING'}
        isBuffering={playerState === 'BUFFERING'}
        currentTime={currentTime}
        duration={duration}
        bufferedRanges={bufferedRanges}
        volume={volume}
        muted={muted}
        playbackRate={playbackRate}
        currentQuality={currentQuality}
        currentSubtitle={settings.subtitleTrack}
        isTheatreMode={isTheatreMode}
        isFullscreen={isFullscreen}
        isHorizontalMode={isHorizontalMode}
        isPipSupported={pipEngine.isSupported()}
        isPipActive={isPipActive}
        onTogglePlay={togglePlay}
        onSeek={seekTo}
        onSeekStart={() => {}}
        onSeekEnd={() => {}}
        onSeekRel={seekRelative}
        onVolumeChange={changeVolume}
        onToggleMute={toggleMute}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleTheatre={toggleTheatre}
        onToggleFullscreen={toggleFullscreen}
        onToggleHorizontal={toggleHorizontal}
        onTogglePip={togglePip}
        onBack={handleSmartBack}
      />

      {/* ── RESUME DIALOG ── */}
      <ResumeDialog
        isOpen={Boolean(resumePrompt)}
        savedTime={resumePrompt?.savedTime || 0}
        duration={resumePrompt?.duration || 0}
        movieTitle={movie?.title}
        onResume={() => {
          if (videoRef.current && resumePrompt) {
            videoRef.current.currentTime = resumePrompt.savedTime;
            videoRef.current.play().catch(() => {});
          }
          setResumePrompt(null);
        }}
        onStartOver={() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(() => {});
          }
          setResumePrompt(null);
        }}
      />

      {/* ── UP NEXT 10s COUNTDOWN ── */}
      <UpNextOverlay
        isOpen={showUpNext && Boolean(nextMovie)}
        nextMovie={nextMovie}
        onPlayNext={() => {
          setShowUpNext(false);
          if (onPlayNextMovie) onPlayNextMovie();
        }}
        onCancel={() => setShowUpNext(false)}
      />

      {/* ── ERROR & END STATE OVERLAYS ── */}
      <PlayerErrorOverlay
        error={error}
        isOffline={isOffline}
        isEnded={playerState === 'ENDED'}
        movie={movie}
        onRetry={() => {
          if (videoRef.current) {
            setError(null);
            setPlayerState('LOADING');
            videoRef.current.load();
            videoRef.current.play().catch(handleError);
          }
        }}
        onChangeQuality={() => setIsSettingsOpen(true)}
        onReplay={() => {
          if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play().catch(handleError);
          }
        }}
        onBackToDetails={handleSmartBack}
      />

      {/* ── FLOATING SETTINGS MODAL ── */}
      <PlayerSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(updated) => {
          const next = playerStorage.saveSettings(updated);
          setSettings(next);
        }}
        availableQualities={availableSources}
        currentQuality={currentQuality}
        onSelectQuality={changeQuality}
        playbackRate={playbackRate}
        onSelectSpeed={changeSpeed}
        aspectRatio={aspectRatio}
        onSelectAspectRatio={(ar) => {
          setAspectRatio(ar);
          playerStorage.saveSettings({ aspectRatio: ar });
        }}
        subtitles={subtitles}
        currentSubtitle={settings.subtitleTrack}
        onSelectSubtitle={(trackId) => {
          const next = playerStorage.saveSettings({ subtitleTrack: trackId });
          setSettings(next);
        }}
        onOpenStats={() => setIsStatsOpen(true)}
      />

      {/* ── TECHNICAL STATS OVERLAY ── */}
      <PlayerStatsModal
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={{
          videoWidth: videoRef.current?.videoWidth,
          videoHeight: videoRef.current?.videoHeight,
          quality: currentQuality,
          bufferSeconds: bufferedRanges.length > 0 ? (bufferedRanges[0].end - currentTime) : 0,
          playbackRate,
          currentTime,
          duration,
          state: playerState,
          sourceHost: activeVideoUrl ? new URL(activeVideoUrl, window.location.href).hostname : 'Cloudflare R2'
        }}
      />
    </div>
  );
}
