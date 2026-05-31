import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMiniPlayer } from '../context/MiniPlayerContext';
import { PlayIcon, PauseIcon, VolumeHighIcon, VolumeMutedIcon } from './Icons';

export default function MiniPlayer() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    activeVideo,
    currentTime,
    isPlaying,
    isMuted,
    volume,
    miniPlayerActive,
    setCurrentTime,
    setIsPlaying,
    setIsMuted,
    setVolume,
    setMiniPlayerActive,
    closeMiniPlayer
  } = useMiniPlayer();

  const videoRef = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [localPlaying, setLocalPlaying] = useState(isPlaying);
  const [localMuted, setLocalMuted] = useState(isMuted);

  const isWatchPage = location.pathname.startsWith('/watch/');

  // Sync initial state
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !miniPlayerActive || isWatchPage) return;

    video.currentTime = currentTime;
    video.volume = volume;
    video.muted = isMuted;

    if (isPlaying) {
      video.play().catch(err => {
        console.warn('Autoplay block on miniplayer', err);
        setLocalPlaying(false);
        setIsPlaying(false);
      });
    } else {
      video.pause();
    }
  }, [activeVideo, miniPlayerActive, isWatchPage]);

  // Sync state changes from context
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isWatchPage) return;

    if (isPlaying && video.paused) {
      video.play().catch(() => {});
      setLocalPlaying(true);
    } else if (!isPlaying && !video.paused) {
      video.pause();
      setLocalPlaying(false);
    }
  }, [isPlaying]);

  if (!miniPlayerActive || isWatchPage || !activeVideo) return null;

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setLocalPlaying(true);
      setIsPlaying(true);
    } else {
      video.pause();
      setLocalPlaying(false);
      setIsPlaying(false);
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setLocalMuted(video.muted);
    setIsMuted(video.muted);
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
  };

  const handleExpand = (e) => {
    e.stopPropagation();
    setMiniPlayerActive(false);
    navigate(`/watch/${activeVideo.id}`);
  };

  return (
    <div
      style={styles.container}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Video Container */}
      <div style={styles.videoWrap}>
        <video
          ref={videoRef}
          src={`/api/stream/${activeVideo.id}`}
          onClick={togglePlay}
          onTimeUpdate={handleTimeUpdate}
          onPause={() => {
            setLocalPlaying(false);
            setIsPlaying(false);
          }}
          onPlay={() => {
            setLocalPlaying(true);
            setIsPlaying(true);
          }}
          style={styles.video}
          crossOrigin="anonymous"
        />

        {/* Hover Overlay Controls */}
        <div style={{
          ...styles.overlay,
          opacity: hovered ? 1 : 0
        }}>
          {/* Close & Expand top bar */}
          <div style={styles.topBar}>
            <button
              onClick={handleExpand}
              style={styles.actionBtn}
              title="Expand player"
              aria-label="Expand player"
            >
              ⛶
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeMiniPlayer();
              }}
              style={styles.actionBtn}
              title="Close player"
              aria-label="Close player"
            >
              ✕
            </button>
          </div>

          {/* Center Play/Pause */}
          <div style={styles.centerPlay} onClick={togglePlay}>
            <button
              style={styles.playBtn}
              aria-label={localPlaying ? 'Pause' : 'Play'}
              title={localPlaying ? 'Pause' : 'Play'}
            >
              {localPlaying ? <PauseIcon width={24} height={24} /> : <PlayIcon width={24} height={24} />}
            </button>
          </div>

          {/* Bottom Mute & Title */}
          <div style={styles.bottomBar}>
            <div style={styles.meta}>
              <div style={styles.title} title={activeVideo.title}>{activeVideo.title}</div>
              <div style={styles.channel}>{activeVideo.channel}</div>
            </div>
            <button
              onClick={toggleMute}
              style={styles.muteBtn}
              aria-label={localMuted ? 'Unmute' : 'Mute'}
              title={localMuted ? 'Unmute' : 'Mute'}
            >
              {localMuted ? <VolumeMutedIcon width={18} height={18} /> : <VolumeHighIcon width={18} height={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    width: 320,
    aspectRatio: '16/9',
    zIndex: 12955,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'rgba(33, 33, 33, 0.85)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(12px)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
    transition: 'transform 0.2s ease-in-out',
    animation: 'fadeIn 0.2s ease-in-out',
  },
  videoWrap: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    cursor: 'pointer',
    display: 'block',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    transition: 'opacity 0.2s ease',
    pointerEvents: 'none',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 8,
    pointerEvents: 'auto',
  },
  actionBtn: {
    color: '#fff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    border: 'none',
    width: 28,
    height: 28,
    borderRadius: '50%',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  centerPlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'auto',
    cursor: 'pointer',
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  bottomBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)',
    pointerEvents: 'auto',
  },
  meta: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  title: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  channel: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 2,
  },
  muteBtn: {
    color: '#fff',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
};
