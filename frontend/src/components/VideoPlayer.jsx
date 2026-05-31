import React, { useRef, useState, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  PlayIcon, PauseIcon, FullscreenIcon,
  VolumeHighIcon, VolumeMutedIcon,
} from './Icons';
import { saveRawProgress, clearRawProgress, getRawProgress } from '../hooks/useWatchProgress';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import { client } from '../api/client';


/* ── CC icon ──────────────────────────────────────────────────────────── */
const CcIcon = ({ active, ...props }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24" {...props}>
    <path d={
      active
        ? "M19 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a2 2 0 01-2 2H7a2 2 0 01-2-2v-3a2 2 0 012-2h2a2 2 0 012 2v1zm7 0h-1.5v-.5h-2v3h2V13H18v1a2 2 0 01-2 2h-2a2 2 0 01-2-2v-3a2 2 0 012-2h2a2 2 0 012 2v1z"
        : "M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 1.1-.9 2-2 2h-2c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v1z"
    } />
  </svg>
);

/* ── Miniplayer icon ─────────────────────────────────────────────────── */
const MiniplayerIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M19 11h-8v6h8v-6zm4 8V5c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 0H3V5h18v14z" />
  </svg>
);

/* ── Pip icon ────────────────────────────────────────────────────────── */
const PipIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-10-7h9v6h-9v-6z" />
  </svg>
);

/* ── Music icon ──────────────────────────────────────────────────────── */
const MusicIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h6V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
  </svg>
);

/* ── Time format ──────────────────────────────────────────────────────── */
function fmtTime(t) {
  if (!t || isNaN(t)) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

/* ── Component ────────────────────────────────────────────────────────── */
const VideoPlayer = forwardRef(({ src, poster, subtitleSrc = null, chapters = [], videoId, videoTitle, videoChannel, videoThumbnail, onVideoEnded, onMiniPlayerTrigger, onLciUpdate, lciWeights = [] }, ref) => {

  const videoRef   = useRef(null);
  const hideTimer  = useRef(null);
  const lastSaveRef = useRef(0);
  const lastPlaybackRateRef = useRef(1.0);
  const pauseStartTimeRef = useRef(null);
  const lastTimeRef = useRef(0);


  const { activeVideo, currentTime: miniPlayerTime, closeMiniPlayer, startMiniPlayer } = useMiniPlayer();

  const [autoplay, setAutoplay] = useState(() => {
    return localStorage.getItem('localplay_autoplay') !== 'false';
  });

  const [isPlaying,    setIsPlaying]    = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [isMuted,      setIsMuted]      = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [ccOn,         setCcOn]         = useState(false);
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [resumeTime,   setResumeTime]   = useState(0);
  const [showResumeBanner, setShowResumeBanner] = useState(false);
  const [audioMode, setAudioMode] = useState(false);

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const animationRef = useRef(null);
  const canvasRef = useRef(null);

  useImperativeHandle(ref, () => ({
    seekTo(seconds) {
      const v = videoRef.current;
      if (v) {
        v.currentTime = seconds;
        v.play().catch(() => {});
      }
    },
    getVideoElement() {
      return videoRef.current;
    }
  }));

  const handleResume = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = resumeTime;
      v.play().catch(() => {});
    }
    setShowResumeBanner(false);
  }, [resumeTime]);

  const handleStartOver = useCallback(() => {
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
    if (videoId) {
      clearRawProgress(videoId);
    }
    setShowResumeBanner(false);
  }, [videoId]);

  /* Check if subtitle file exists */
  useEffect(() => {
    if (!subtitleSrc) { setHasSubtitles(false); return; }
    fetch(subtitleSrc, { method: 'HEAD' })
      .then(r => setHasSubtitles(r.ok))
      .catch(() => setHasSubtitles(false));
  }, [subtitleSrc]);

  /* Sync <track> visibility */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    for (const track of video.textTracks) {
      track.mode = (ccOn && hasSubtitles) ? 'showing' : 'hidden';
    }
  }, [ccOn, hasSubtitles]);

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  const togglePlay      = useCallback(() => {
    const v = videoRef.current;
    if (v) v.paused ? v.play() : v.pause();
  }, []);
  const toggleMute      = useCallback(() => {
    const v = videoRef.current;
    if (v) { v.muted = !v.muted; setIsMuted(v.muted); }
  }, []);
  const toggleFullscreen = useCallback(() => {
    const c = videoRef.current?.parentElement;
    if (!c) return;
    document.fullscreenElement ? document.exitFullscreen() : c.requestFullscreen();
  }, []);

  const handleSeek = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration;
  };

  const handleMiniPlayerTrigger = useCallback(() => {
    const v = videoRef.current;
    if (v && videoId && v.duration) {
      const videoObj = {
        id: videoId,
        title: videoTitle,
        channel: videoChannel,
        thumbnail_path: videoThumbnail,
        duration: v.duration
      };
      startMiniPlayer(videoObj, v.currentTime, !v.paused, v.muted, v.volume);
      if (onMiniPlayerTrigger) {
        onMiniPlayerTrigger();
      }
    }
  }, [videoId, videoTitle, videoChannel, videoThumbnail, startMiniPlayer, onMiniPlayerTrigger]);

  const toggleNativePiP = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await v.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Native PiP failed', err);
    }
  }, []);

  /* Web Audio Visualizer effect */
  useEffect(() => {
    if (!audioMode) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    let audioCtx = audioContextRef.current;
    let analyser = analyserRef.current;

    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128; // clean visualizer bar layout
      analyserRef.current = analyser;

      try {
        const source = audioCtx.createMediaElementSource(video);
        sourceRef.current = source;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
      } catch (err) {
        console.warn("Failed to init MediaElementSource:", err);
      }
    }

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvas.getContext('2d');

    const handlePlayResume = () => {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    };
    video.addEventListener('play', handlePlayResume);

    const draw = () => {
      if (!canvasRef.current) return;
      animationRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const barWidth = (width / bufferLength);
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * height * 0.8;
        const hue = (i / bufferLength) * 120 + 200; // custom blue-cyan gradient
        ctx.fillStyle = `hsla(${hue}, 85%, 60%, 0.85)`;
        ctx.shadowColor = `hsla(${hue}, 85%, 60%, 0.5)`;
        ctx.shadowBlur = 8;
        ctx.fillRect(x, height - barHeight, barWidth - 3, barHeight);
        ctx.shadowBlur = 0;
        x += barWidth;
      }
    };

    draw();

    return () => {
      video.removeEventListener('play', handlePlayResume);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [audioMode]);

  /* Keyboard shortcuts */
  useEffect(() => {
    const onKey = (e) => {
      const activeTag = document.activeElement?.tagName;
      const targetTag = e.target?.tagName;
      if (
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable ||
        targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable
      ) return;
      const v = videoRef.current;
      if (!v) return;
      switch (e.key.toLowerCase()) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'f': toggleFullscreen(); break;
        case 'm': toggleMute(); break;
        case 'c': if (hasSubtitles) setCcOn(x => !x); break;
        case 'i': e.preventDefault(); handleMiniPlayerTrigger(); break;
        case 'p': e.preventDefault(); toggleNativePiP(); break;
        case 'a': e.preventDefault(); setAudioMode(x => !x); break;
        case 'arrowright': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); break;
        case 'arrowleft':  e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'arrowup':    e.preventDefault(); { const nv = Math.min(1, v.volume + 0.05); v.volume = nv; setVolume(nv); setIsMuted(false); } break;
        case 'arrowdown':  e.preventDefault(); { const nv = Math.max(0, v.volume - 0.05); v.volume = nv; setVolume(nv); setIsMuted(nv === 0); } break;
        default: break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [togglePlay, toggleMute, toggleFullscreen, hasSubtitles, handleMiniPlayerTrigger, toggleNativePiP]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  useEffect(() => {
    localStorage.setItem('localplay_autoplay', autoplay);
  }, [autoplay]);

  useEffect(() => {
    if (activeVideo && String(activeVideo.id) === String(videoId)) {
      const savedTime = miniPlayerTime;
      closeMiniPlayer();
      const v = videoRef.current;
      if (v) {
        v.currentTime = savedTime;
      }
    }
  }, [videoId]);

  useEffect(() => {
    setShowResumeBanner(false);
    setResumeTime(0);
    lastSaveRef.current = 0;

    const saveOrTransition = () => {
      const v = videoRef.current;
      if (!v || !videoId || !v.duration) return;

      const isCompleted = v.currentTime / v.duration >= 0.95;
      const isSignificant = v.currentTime > 5;

      if (isCompleted) {
        clearRawProgress(videoId);
      } else if (isSignificant) {
        saveRawProgress(videoId, v.currentTime);
      }

      if (!v.paused && !v.ended && isSignificant && !isCompleted) {
        const videoObj = {
          id: videoId,
          title: videoTitle,
          channel: videoChannel,
          thumbnail_path: videoThumbnail,
          duration: v.duration
        };
        startMiniPlayer(videoObj, v.currentTime, true, v.muted, v.volume);
      }
    };

    const handleBeforeUnload = () => {
      const v = videoRef.current;
      if (v && videoId && v.duration) {
        if (v.currentTime / v.duration >= 0.95) {
          clearRawProgress(videoId);
        } else if (v.currentTime > 5) {
          saveRawProgress(videoId, v.currentTime);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      saveOrTransition();
    };
  }, [videoId, videoTitle, videoChannel, videoThumbnail]);

  return (
    <div
      className="video-player-container"
      onMouseMove={revealControls}
      onMouseLeave={() => { if (isPlaying) setShowControls(false); }}
      style={{ borderRadius: 12 }}
    >
      {showResumeBanner && (
        <div style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          backgroundColor: 'rgba(33, 33, 33, 0.95)',
          border: '1px solid var(--yt-border)',
          borderRadius: 8,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
          fontSize: 13,
          color: '#fff',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
        }}>
          <span>Resume from <strong>{fmtTime(resumeTime)}</strong>?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button 
              style={{
                backgroundColor: 'var(--yt-blue)',
                color: '#0f0f0f',
                fontWeight: 600,
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer'
              }}
              onClick={handleResume}
            >
              Resume
            </button>
            <button 
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                color: '#fff',
                fontWeight: 500,
                padding: '6px 12px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer'
              }}
              onClick={handleStartOver}
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {audioMode && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 48,
          background: 'radial-gradient(circle, #2a2a2a 0%, #0c0c0c 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 4,
          overflow: 'hidden',
          pointerEvents: 'none',
        }}>
          <canvas
            ref={canvasRef}
            width={640}
            height={360}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              opacity: 0.4,
              zIndex: 1,
            }}
          />

          <div
            style={{
              position: 'relative',
              width: 180,
              height: 180,
              borderRadius: '50%',
              backgroundColor: '#050505',
              border: '6px solid #1a1a1a',
              boxShadow: '0 8px 32px rgba(0,0,0,0.8), inset 0 0 10px rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              cursor: 'pointer',
              pointerEvents: 'auto',
            }}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className={`spin-slow ${isPlaying ? '' : 'spin-paused'}`}
          >
            <div style={{
              position: 'absolute',
              inset: 12,
              borderRadius: '50%',
              border: '1px double rgba(255,255,255,0.08)'
            }} />
            <div style={{
              position: 'absolute',
              inset: 24,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.05)'
            }} />
            <div style={{
              position: 'absolute',
              inset: 36,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)'
            }} />
            
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '3px solid #000',
              backgroundColor: '#333'
            }}>
              {videoThumbnail ? (
                <img
                  src={`/media/${videoThumbnail}`}
                  alt="Thumbnail"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                  🎵
                </div>
              )}
            </div>
            
            <div style={{
              position: 'absolute',
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: '#2a2a2a',
              border: '1px solid #000'
            }} />
          </div>

          <div style={{
            marginTop: 16,
            textAlign: 'center',
            zIndex: 3,
            padding: '0 20px',
            color: '#fff',
            textShadow: '0 2px 4px rgba(0,0,0,0.8)'
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {videoTitle}
            </div>
            <div style={{ fontSize: 13, color: 'var(--yt-text-secondary)', marginTop: 4 }}>
              {videoChannel}
            </div>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={src}
        poster={poster}
        style={{ width: '100%', height: '100%', cursor: 'pointer', display: 'block' }}
        onClick={togglePlay}
        onPlay={() => {
          setIsPlaying(true);
          scheduleHide();
          if (pauseStartTimeRef.current) {
            const elapsed = (Date.now() - pauseStartTimeRef.current) / 1000;
            pauseStartTimeRef.current = null;
            if (elapsed >= 5.0 && videoId) {
              client.addInteraction(videoId, 'video_paused', currentTime, elapsed)
                .then(res => {
                  if (onLciUpdate && res) onLciUpdate(res.lci_score, res.lci_segment_weights);
                })
                .catch(console.error);
            }
          }
        }}
        onPause={() => {
          setIsPlaying(false);
          setShowControls(true);
          clearTimeout(hideTimer.current);
          pauseStartTimeRef.current = Date.now();
          if (videoRef.current && videoId && videoRef.current.duration) {
            const v = videoRef.current;
            if (v.currentTime / v.duration >= 0.95) {
              clearRawProgress(videoId);
            } else if (v.currentTime > 5) {
              saveRawProgress(videoId, v.currentTime);
            }
          }
        }}
        onTimeUpdate={() => {
          const v = videoRef.current;
          if (!v) return;
          setCurrentTime(v.currentTime);
          setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
          
          if (Math.abs(v.currentTime - lastTimeRef.current) < 2.0) {
            lastTimeRef.current = v.currentTime;
          }
          
          if (videoId && v.duration) {
            const now = Date.now();
            if (now - lastSaveRef.current > 5000) {
              lastSaveRef.current = now;
              if (v.currentTime / v.duration >= 0.95) {
                clearRawProgress(videoId);
              } else {
                saveRawProgress(videoId, v.currentTime);
              }
            }
          }
        }}
        onRateChange={() => {
          const v = videoRef.current;
          if (v && videoId) {
            const rate = v.playbackRate;
            if (rate !== lastPlaybackRateRef.current) {
              lastPlaybackRateRef.current = rate;
              if (rate < 1.0) {
                client.addInteraction(videoId, 'speed_change', v.currentTime, rate)
                  .then(res => {
                    if (onLciUpdate && res) onLciUpdate(res.lci_score, res.lci_segment_weights);
                  })
                  .catch(console.error);
              }
            }
          }
        }}
        onSeeked={() => {
          const v = videoRef.current;
          if (v && videoId) {
            const diff = lastTimeRef.current - v.currentTime;
            if (diff > 2.0) {
              client.addInteraction(videoId, 'seek_backward', v.currentTime, diff)
                .then(res => {
                  if (onLciUpdate && res) onLciUpdate(res.lci_score, res.lci_segment_weights);
                })
                .catch(console.error);
            }
            lastTimeRef.current = v.currentTime;
          }
        }}
        onLoadedMetadata={() => {
          if (!videoRef.current) return;
          const dur = videoRef.current.duration;
          setDuration(dur);
          if (videoId) {
            const saved = getRawProgress(videoId);
            if (saved > 10 && saved < dur * 0.95) {
              setResumeTime(saved);
              setShowResumeBanner(true);
            }
          }
        }}
        onEnded={() => {
          if (videoId) {
            clearRawProgress(videoId);
          }
          if (autoplay && onVideoEnded) {
            onVideoEnded();
          }
        }}
        crossOrigin="anonymous"
      >
        {/* Subtitle track — hidden by default, toggled via JS */}
        {subtitleSrc && hasSubtitles && (
          <track
            kind="subtitles"
            src={subtitleSrc}
            srcLang="en"
            label="English"
            default={false}
          />
        )}
      </video>

      {/* Controls overlay */}
      <div
        className="player-controls-overlay"
        style={{ opacity: showControls ? 1 : 0, pointerEvents: showControls ? 'auto' : 'none' }}
      >
        {/* Seekbar */}
        <div className="player-seekbar-wrap" onClick={handleSeek} style={{ position: 'relative' }}>
          {lciWeights && lciWeights.length > 0 && (() => {
            const maxWeight = Math.max(...lciWeights, 1);
            const minWeight = Math.min(...lciWeights, maxWeight);
            const hasVariation = maxWeight > minWeight;
            if (!hasVariation) return null;
            return (
              <div style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                height: 18,
                display: 'flex',
                alignItems: 'flex-end',
                pointerEvents: 'none',
                marginBottom: 4,
                opacity: 0.75
              }}>
                {lciWeights.map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      flex: 1,
                      height: `${(w / maxWeight) * 100}%`,
                      backgroundColor: 'var(--accent-color, #6366f1)',
                      margin: '0 0.5px',
                      opacity: 0.1 + (w / maxWeight) * 0.8,
                      borderRadius: '1px 1px 0 0',
                      transition: 'height 0.3s ease, opacity 0.3s ease'
                    }}
                  />
                ))}
              </div>
            );
          })()}
          <div className="player-seekbar-track">
            <div className="player-seekbar-fill" style={{ width: `${progress}%` }} />
            <div className="player-seekbar-dot"  style={{ left: `${progress}%` }} />
          </div>

          {/* Chapter markers */}
          {chapters.map((ch, i) => {
            if (!duration) return null;
            const pct = (ch.start_time / duration) * 100;
            return (
              <div
                key={i}
                title={ch.title}
                onClick={(e) => {
                  e.stopPropagation();
                  const v = videoRef.current;
                  if (v) {
                    v.currentTime = ch.start_time;
                    v.play().catch(() => {});
                  }
                }}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  top: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 5,
                  height: 12,
                  backgroundColor: 'rgba(255,255,255,0.8)',
                  borderRadius: 1,
                  cursor: 'pointer',
                  zIndex: 3,
                }}
              />
            );
          })}
        </div>

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4 }}>
          {/* Left */}
          <div className="left-controls-wrapper" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="icon-btn"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              title={isPlaying ? 'Pause (space / k)' : 'Play (space / k)'}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              className="icon-btn"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted || volume === 0 ? 'Unmute (m)' : 'Mute (m)'}
            >
              {isMuted || volume === 0 ? <VolumeMutedIcon /> : <VolumeHighIcon />}
            </button>
            <input
              type="range"
              min="0" max="1" step="0.02"
              value={isMuted ? 0 : volume}
              onChange={e => {
                const vol = parseFloat(e.target.value);
                if (videoRef.current) videoRef.current.volume = vol;
                setVolume(vol);
                setIsMuted(vol === 0);
              }}
              className="player-volume-slider"
              aria-label="Volume"
              title="Volume"
            />
            <span style={{ color: '#fff', fontSize: 13, fontWeight: 500, marginLeft: 8, userSelect: 'none', whiteSpace: 'nowrap' }}>
              {fmtTime(currentTime)}&nbsp;/&nbsp;{fmtTime(duration)}
            </span>
            {(() => {
              if (!chapters || chapters.length === 0) return null;
              let currentChapter = '';
              for (const ch of chapters) {
                if (currentTime >= ch.start_time) {
                  currentChapter = ch.title;
                }
              }
              if (!currentChapter) return null;
              return (
                <span style={{
                  color: 'var(--yt-text-secondary)',
                  fontSize: 13,
                  marginLeft: 12,
                  fontStyle: 'italic',
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={`Current chapter: ${currentChapter}`}>
                  • {currentChapter}
                </span>
              );
            })()}
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
            <button
              onClick={() => setAutoplay(a => !a)}
              style={{
                background: 'none',
                border: 'none',
                position: 'relative',
                width: 38,
                height: 20,
                borderRadius: 10,
                backgroundColor: autoplay ? 'var(--yt-blue)' : 'rgba(255,255,255,0.3)',
                transition: 'background-color 0.2s',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'flex-start',
                padding: '0 2px',
                marginRight: 12,
                cursor: 'pointer',
              }}
              title={autoplay ? 'Autoplay is ON (click to disable)' : 'Autoplay is OFF (click to enable)'}
              aria-label="Toggle Autoplay"
            >
              <div style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                backgroundColor: autoplay ? '#0f0f0f' : '#fff',
                transform: autoplay ? 'translateX(18px)' : 'translateX(0px)',
                transition: 'transform 0.2s, background-color 0.2s',
              }} />
            </button>

            <button
              className="icon-btn"
              onClick={() => setAudioMode(a => !a)}
              aria-label="Audio Mode"
              title={audioMode ? 'Video Mode (a)' : 'Audio Mode (a)'}
              style={{ color: audioMode ? 'var(--yt-blue)' : 'white' }}
            >
              <MusicIcon />
            </button>

            {hasSubtitles && (
              <button
                className="icon-btn"
                onClick={() => setCcOn(x => !x)}
                aria-label={ccOn ? 'Disable captions' : 'Enable captions'}
                aria-pressed={ccOn}
                style={{ color: ccOn ? 'var(--yt-blue)' : 'white' }}
                title={ccOn ? 'CC: On (press C)' : 'CC: Off (press C)'}
              >
                <CcIcon active={ccOn} />
              </button>
            )}

            <button
              className="icon-btn"
              onClick={handleMiniPlayerTrigger}
              aria-label="Miniplayer"
              title="In-app Miniplayer (i)"
            >
              <MiniplayerIcon />
            </button>

            {document.pictureInPictureEnabled && (
              <button
                className="icon-btn"
                onClick={toggleNativePiP}
                aria-label="Desktop Picture-in-Picture"
                title="Desktop Picture-in-Picture (p)"
              >
                <PipIcon />
              </button>
            )}

            <button
              className="icon-btn"
              onClick={toggleFullscreen}
              aria-label="Fullscreen"
              title="Fullscreen (f)"
            >
              <FullscreenIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default VideoPlayer;
