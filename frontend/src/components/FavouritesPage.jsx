import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useFavourites } from '../hooks/useFavourites';
import { client } from '../api/client';
import { HeartFilledIcon } from './Icons';

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function FavouritesPage() {
  const navigate = useNavigate();

  // Fix: use ?? [] so null (before first fetch) is handled correctly
  const { data: allVideosRaw, loading } = useAutoRefresh(client.getLatestVideos, 30_000);
  const allVideos = allVideosRaw ?? [];
  const { favourites, isFav, toggleFav } = useFavourites();

  const favVideos = useMemo(
    () => allVideos.filter(v => isFav(v.id)),
    [allVideos, favourites]
  );

  // ── Loading skeleton ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={S.page}>
        <div style={S.header}>
          <HeartFilledIcon style={{ width: 32, height: 32, color: '#ef4444' }} />
          <div>
            <h1 style={S.title}>Favourites</h1>
            <p style={S.subtitle}>Loading…</p>
          </div>
        </div>
        <div style={S.grid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 12 }} />
              <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div className="skeleton" style={{ width: '85%', height: 14, borderRadius: 4 }} />
                <div className="skeleton" style={{ width: '50%', height: 12, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Empty state ─────────────────────────────────────────────────────────
  if (favVideos.length === 0) {
    return (
      <div style={S.emptyWrap}>
        {/* Glowing heart */}
        <div style={S.emptyIconRing}>
          <HeartFilledIcon style={{ width: 44, height: 44, color: '#ef4444' }} />
        </div>
        <h2 style={S.emptyTitle}>No favourites yet</h2>
        <p style={S.emptyHint}>
          Hit <span style={S.heartChip}>♥ Favourite</span> on any video to save it here.
        </p>
        <button style={S.browseBtn} onClick={() => navigate('/')}>
          Browse videos
        </button>
      </div>
    );
  }

  // ── Favourites grid ─────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <HeartFilledIcon style={{ width: 32, height: 32, color: '#ef4444' }} />
        <div>
          <h1 style={S.title}>Favourites</h1>
          <p style={S.subtitle}>{favVideos.length} video{favVideos.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Grid */}
      <div style={S.grid}>
        {favVideos.map(v => (
          <div key={v.id} style={S.card}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            {/* Thumbnail */}
            <div style={S.thumbWrap} onClick={() => navigate(`/watch/${v.id}`)}>
              <img
                src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                alt={v.title}
                style={S.thumb}
                loading="lazy"
              />
              {v.duration && <span style={S.duration}>{formatDuration(v.duration)}</span>}
            </div>

            {/* Info row */}
            <div style={S.info}>
              <div style={S.infoText} onClick={() => navigate(`/watch/${v.id}`)}>
                <p style={S.videoTitle} title={v.title}>{v.title}</p>
                <p style={S.videoChannel}
                   onClick={e => { e.stopPropagation(); navigate(`/channel/${encodeURIComponent(v.channel)}`); }}>
                  {v.channel}
                </p>
              </div>

              {/* Remove from favourites */}
              <button
                style={S.heartBtn}
                onClick={() => toggleFav(v.id)}
                title="Remove from favourites"
                aria-label="Remove from favourites"
                onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.15)'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <HeartFilledIcon style={{ width: 18, height: 18 }} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const S = {
  page: {
    padding: '32px 24px 48px',
    maxWidth: 1600,
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--yt-text-secondary)',
    margin: '4px 0 0',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'var(--yt-surface)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  thumbWrap: {
    position: 'relative',
    aspectRatio: '16/9',
    backgroundColor: '#1a1a1a',
    cursor: 'pointer',
    overflow: 'hidden',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
    transition: 'transform 0.2s',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    padding: '2px 5px',
    borderRadius: 4,
  },
  info: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '10px 12px 12px',
  },
  infoText: {
    flex: 1,
    minWidth: 0,
    cursor: 'pointer',
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    margin: '0 0 4px',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    lineHeight: '20px',
  },
  videoChannel: {
    fontSize: 12,
    color: 'var(--yt-text-secondary)',
    margin: 0,
    cursor: 'pointer',
  },
  heartBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ef4444',
    flexShrink: 0,
    transition: 'background 0.15s',
  },

  // ── Empty state ────────────────────────────────────────────────────────
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '65vh',
    gap: 16,
    textAlign: 'center',
    padding: '0 24px',
  },
  emptyIconRing: {
    width: 96,
    height: 96,
    borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    border: '2px solid rgba(239,68,68,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    margin: 0,
  },
  emptyHint: {
    fontSize: 15,
    color: 'var(--yt-text-secondary)',
    margin: 0,
    lineHeight: 1.6,
  },
  heartChip: {
    display: 'inline-block',
    backgroundColor: 'rgba(239,68,68,0.15)',
    color: '#ef4444',
    borderRadius: 6,
    padding: '1px 8px',
    fontWeight: 600,
    fontSize: 13,
  },
  browseBtn: {
    marginTop: 8,
    padding: '10px 28px',
    borderRadius: 20,
    backgroundColor: 'var(--yt-text-primary)',
    color: 'var(--yt-bg)',
    border: 'none',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
};
