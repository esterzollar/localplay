import { useState, useEffect, useRef } from 'react';
import { client } from '../api/client';
import { useFavourites } from '../hooks/useFavourites';
import { LikeIcon, HeartIcon, HeartFilledIcon, VolumeHighIcon, VolumeMutedIcon, PlayIcon, PauseIcon } from './Icons';

export default function ShortsPage() {
  const [shorts, setShorts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem('localplay_shorts_muted') === 'true';
  });
  
  const containerRef = useRef(null);
  const cardRefs = useRef([]);
  const videoRefs = useRef([]);

  // Fetch Shorts on mount
  useEffect(() => {
    client.getShorts()
      .then(data => {
        setShorts(data || []);
      })
      .catch(err => {
        console.error('Failed to fetch shorts:', err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Update localStorage for mute preference
  useEffect(() => {
    localStorage.setItem('localplay_shorts_muted', isMuted);
    videoRefs.current.forEach(v => {
      if (v) v.muted = isMuted;
    });
  }, [isMuted]);

  // Set up IntersectionObserver to detect which card is active
  useEffect(() => {
    if (shorts.length === 0) return;
    
    const observerOptions = {
      root: containerRef.current,
      rootMargin: '0px',
      threshold: 0.6, // Must be 60% visible to count as active
    };

    const observerCallback = (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const index = parseInt(entry.target.dataset.index, 10);
          setActiveIndex(index);
        }
      });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    
    // Observe all card elements
    const currentCards = cardRefs.current;
    currentCards.forEach(card => {
      if (card) observer.observe(card);
    });

    return () => {
      currentCards.forEach(card => {
        if (card) observer.unobserve(card);
      });
    };
  }, [shorts]);

  // Play active video, pause others
  useEffect(() => {
    videoRefs.current.forEach((video, idx) => {
      if (!video) return;
      if (idx === activeIndex) {
        video.muted = isMuted;
        video.currentTime = 0;
        video.play().catch(err => {
          console.warn('Autoplay blocked on short:', err);
        });
      } else {
        video.pause();
      }
    });
  }, [activeIndex, shorts, isMuted]);

  // Keyboard navigation (ArrowUp/ArrowDown, space, M)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (shorts.length === 0) return;
      const activeTag = document.activeElement?.tagName;
      const targetTag = e.target?.tagName;
      if (
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || document.activeElement?.isContentEditable ||
        targetTag === 'INPUT' || targetTag === 'TEXTAREA' || e.target?.isContentEditable
      ) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (activeIndex < shorts.length - 1) {
            const nextIdx = activeIndex + 1;
            cardRefs.current[nextIdx]?.scrollIntoView({ behavior: 'smooth' });
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (activeIndex > 0) {
            const prevIdx = activeIndex - 1;
            cardRefs.current[prevIdx]?.scrollIntoView({ behavior: 'smooth' });
          }
          break;
        case ' ':
          e.preventDefault();
          {
            const activeVideo = videoRefs.current[activeIndex];
            if (activeVideo) {
              if (activeVideo.paused) {
                activeVideo.play().catch(() => {});
              } else {
                activeVideo.pause();
              }
            }
          }
          break;
        case 'm':
        case 'M':
          e.preventDefault();
          setIsMuted(prev => !prev);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, shorts, isMuted]);

  if (loading) return <div style={S.message}>Loading Shorts…</div>;
  if (error) return <div style={S.message}>Failed to load Shorts.</div>;
  if (shorts.length === 0) return <div style={S.message}>No vertical videos found in library.</div>;

  return (
    <div
      ref={containerRef}
      style={S.scrollContainer}
    >
      {shorts.map((short, index) => (
        <ShortCard
          key={short.id}
          index={index}
          short={short}
          isActive={index === activeIndex}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(m => !m)}
          cardRef={el => cardRefs.current[index] = el}
          videoRef={el => videoRefs.current[index] = el}
        />
      ))}
    </div>
  );
}

/* ── Individual Shorts Card Component ─────────────────────────────────── */
function ShortCard({ index, short, isMuted, onToggleMute, cardRef, videoRef }) {
  const { isFav, toggleFav } = useFavourites();
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showPlayStateOverlay, setShowPlayStateOverlay] = useState(false);
  const overlayTimer = useRef(null);

  const localVideoRef = useRef(null);
  const scrubberRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const setVideoRefs = (el) => {
    localVideoRef.current = el;
    if (videoRef) {
      if (typeof videoRef === 'function') {
        videoRef(el);
      } else {
        videoRef.current = el;
      }
    }
  };

  const togglePlay = () => {
    const video = localVideoRef.current;
    if (!video) return;
    
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
    
    // Show brief feedback overlay icon
    setShowPlayStateOverlay(true);
    clearTimeout(overlayTimer.current);
    overlayTimer.current = setTimeout(() => {
      setShowPlayStateOverlay(false);
    }, 500);
  };

  const handleLike = (e) => {
    e.stopPropagation();
    setLiked(l => !l);
  };

  const handleFav = (e) => {
    e.stopPropagation();
    toggleFav(short.id);
  };

  const handleSeek = (clientX) => {
    const video = localVideoRef.current;
    if (!video || !duration || !scrubberRef.current) return;
    const rect = scrubberRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleSeek(e.clientX);
    
    const handleMouseMove = (moveEvent) => {
      handleSeek(moveEvent.clientX);
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStart = (e) => {
    e.stopPropagation();
    if (e.touches.length === 0) return;
    setIsDragging(true);
    handleSeek(e.touches[0].clientX);
    
    const handleTouchMove = (moveEvent) => {
      if (moveEvent.touches.length === 0) return;
      handleSeek(moveEvent.touches[0].clientX);
    };
    
    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <div
      ref={cardRef}
      data-index={index}
      style={S.card}
    >
      {/* Centered vertical video container (9:16 standard) */}
      <div 
        style={S.videoWrapper} 
        onClick={togglePlay}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        
        <video
          ref={setVideoRefs}
          src={`/api/stream/${short.id}`}
          loop
          muted={isMuted}
          crossOrigin="anonymous"
          style={S.video}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            if (!isDragging) {
              setCurrentTime(e.target.currentTime);
            }
          }}
          onLoadedMetadata={(e) => setDuration(e.target.duration)}
        />

        {/* Play/Pause state HUD flash or Permanent Play overlay when paused */}
        {!playing ? (
          <div style={S.playHudPermanent}>
            <PlayIcon width={36} height={36} />
          </div>
        ) : showPlayStateOverlay ? (
          <div style={S.playHud}>
            {playing ? <PlayIcon width={36} height={36} /> : <PauseIcon width={36} height={36} />}
          </div>
        ) : null}

        {/* Info overlay (bottom-left) */}
        <div style={S.infoOverlay}>
          <h3 style={S.author}>@{short.channel || 'LocalPlay'}</h3>
          <p style={S.videoTitle} title={short.title}>{short.title}</p>
        </div>

        {/* Floating actions overlay (bottom-right side) */}
        <div style={S.actionsOverlay}>
          
          {/* Like */}
          <div style={S.actionItem}>
            <button
              onClick={handleLike}
              style={{ ...S.actionCircle, backgroundColor: liked ? 'var(--yt-blue)' : 'rgba(0,0,0,0.6)' }}
              title={liked ? 'Unlike' : 'Like'}
            >
              <LikeIcon width={20} height={20} style={{ color: liked ? '#000' : '#fff' }} />
            </button>
            <span style={S.actionLabel}>{short.like_count ? (short.like_count + (liked ? 1 : 0)) : (liked ? 1 : 0)}</span>
          </div>

          {/* Favourite */}
          <div style={S.actionItem}>
            <button
              onClick={handleFav}
              style={{ ...S.actionCircle, backgroundColor: isFav(short.id) ? '#ef4444' : 'rgba(0,0,0,0.6)' }}
              title={isFav(short.id) ? 'Remove Favourites' : 'Add Favourites'}
            >
              {isFav(short.id) ? <HeartFilledIcon width={20} height={20} style={{ color: '#fff' }} /> : <HeartIcon width={20} height={20} />}
            </button>
            <span style={S.actionLabel}>Fav</span>
          </div>

          {/* Mute toggle */}
          <div style={S.actionItem}>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
              style={S.actionCircle}
              title={isMuted ? 'Unmute (m)' : 'Mute (m)'}
            >
              {isMuted ? <VolumeMutedIcon width={20} height={20} /> : <VolumeHighIcon width={20} height={20} />}
            </button>
            <span style={S.actionLabel}>{isMuted ? 'Muted' : 'Volume'}</span>
          </div>

        </div>

        {/* Custom Progress Scrubber at the bottom */}
        <div
          ref={scrubberRef}
          style={{
            ...S.scrubberContainer,
            height: (isHovered || isDragging) ? 12 : 4,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div style={{
            ...S.scrubberTrack,
            height: (isHovered || isDragging) ? 6 : 3,
          }}>
            <div style={{ 
              ...S.scrubberFill, 
              width: `${duration ? (currentTime / duration) * 100 : 0}%` 
            }} />
            {(isHovered || isDragging) && (
              <div style={{ 
                ...S.scrubberThumb, 
                left: `${duration ? (currentTime / duration) * 100 : 0}%` 
              }} />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────── Levant ────── */
const S = {
  scrollContainer: {
    height: 'calc(100vh - var(--topbar-height))',
    overflowY: 'scroll',
    scrollSnapType: 'y mandatory',
    backgroundColor: '#000000',
    scrollbarWidth: 'none', // Firefox
    msOverflowStyle: 'none', // IE/Edge
  },
  card: {
    height: 'calc(100vh - var(--topbar-height))',
    scrollSnapAlign: 'start',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 0',
    position: 'relative'
  },
  videoWrapper: {
    position: 'relative',
    height: '100%',
    aspectRatio: '9/16',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
    boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
    cursor: 'pointer'
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block'
  },
  playHud: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 68,
    height: 68,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
    animation: 'fadeInOut 0.5s ease-out'
  },
  playHudPermanent: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 68,
    height: 68,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    pointerEvents: 'none',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
  },
  infoOverlay: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    right: 72,
    zIndex: 5,
    pointerEvents: 'none',
    color: '#fff',
    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
  },
  author: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 6,
    margin: 0
  },
  videoTitle: {
    fontSize: 13,
    lineHeight: '18px',
    color: '#f1f1f1',
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical'
  },
  actionsOverlay: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    zIndex: 5,
    alignItems: 'center'
  },
  actionItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: '50%',
    backgroundColor: 'rgba(0,0,0,0.65)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
    transition: 'transform 0.15s, background-color 0.15s',
    '&:hover': {
      transform: 'scale(1.08)',
      backgroundColor: 'rgba(0,0,0,0.8)'
    }
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: '#fff',
    textShadow: '0 2px 4px rgba(0,0,0,0.8)'
  },
  message: {
    padding: '120px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000'
  },
  scrubberContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'flex-end',
    cursor: 'pointer',
    zIndex: 15,
    transition: 'height 0.15s ease',
  },
  scrubberTrack: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
    transition: 'height 0.15s ease',
    overflow: 'visible',
  },
  scrubberFill: {
    height: '100%',
    backgroundColor: 'var(--yt-red)',
    position: 'absolute',
    left: 0,
    top: 0,
  },
  scrubberThumb: {
    position: 'absolute',
    top: '50%',
    width: 12,
    height: 12,
    borderRadius: '50%',
    backgroundColor: 'var(--yt-red)',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    boxShadow: '0 0 4px rgba(0,0,0,0.5)',
  },
};
