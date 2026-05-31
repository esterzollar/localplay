import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { client } from '../api/client';

function formatViews(views) {
  if (!views) return '0 views';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
  if (views >= 1_000)     return (views / 1_000).toFixed(1)     + 'K views';
  return `${views.toLocaleString()} views`;
}

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{8}$/.test(dateStr)) {
    const y = dateStr.slice(0, 4), mo = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
    return new Date(`${y}-${mo}-${d}`).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
  return dateStr;
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [videos, setVideos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) { setVideos([]); setLoading(false); return; }
    setLoading(true);
    client.searchVideos(query).then(setVideos).finally(() => setLoading(false));
  }, [query]);

  return (
    <div style={styles.page}>
      {/* ── Header ── */}
      <div style={styles.header}>
        {query && (
          <span style={styles.filterLabel}>
            About {loading ? '…' : (videos?.length ?? 0)} results for
            <span style={{ color: 'var(--yt-text-primary)', fontWeight: 500 }}> "{query}"</span>
          </span>
        )}
      </div>

      {/* ── Results ── */}
      {loading ? (
        <div style={styles.list}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={styles.skeletonRow}>
              <div className="skeleton" style={styles.skeletonThumb} />
              <div style={styles.skeletonInfo}>
                <div className="skeleton" style={styles.skeletonTitle} />
                <div className="skeleton" style={styles.skeletonMeta} />
                <div className="skeleton" style={styles.skeletonDesc} />
              </div>
            </div>
          ))}
        </div>
      ) : !videos || videos.length === 0 ? (
        <div style={styles.empty}>No results found for "{query}".</div>
      ) : (
        <div style={styles.list}>
          {videos.map(v => {
            const initial = (v.channel || 'C').charAt(0).toUpperCase();
            return (
              <div
                key={v.id}
                className="search-result-row"
                onClick={() => navigate(`/watch/${v.id}`)}
                role="article"
                aria-label={v.title}
              >
                {/* Thumbnail */}
                <div style={styles.thumbWrap}>
                  <img
                    src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                    alt={v.title}
                    style={styles.thumb}
                    loading="lazy"
                  />
                  <span style={styles.duration}>{formatDuration(v.duration)}</span>
                </div>

                {/* Info */}
                <div style={styles.info}>
                  <p style={styles.title} title={v.title}>{v.title}</p>
                  <p style={styles.meta}>{formatViews(v.view_count)}&nbsp;•&nbsp;{formatDate(v.upload_date)}</p>
                  <div style={styles.channelRow}>
                    <div
                      className="avatar"
                      style={{ ...styles.avatar, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/channel/${encodeURIComponent(v.channel)}`); }}
                    >{initial}</div>
                    <span
                      style={{ ...styles.channel, cursor: 'pointer' }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/channel/${encodeURIComponent(v.channel)}`); }}
                    >{v.channel}</span>
                  </div>
                  {v.description && (
                    <p style={styles.desc}>
                      {v.description.slice(0, 120)}{v.description.length > 120 ? '…' : ''}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: '16px 60px 48px',
    maxWidth: '1100px',
  },
  header: {
    paddingBottom: 12,
    borderBottom: '1px solid var(--yt-border)',
    marginBottom: 8,
  },
  filterLabel: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  empty: {
    padding: '60px 0',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  },
  thumbWrap: {
    position: 'relative',
    width: '360px',
    flexShrink: 0,
    aspectRatio: '16/9',
    borderRadius: '12px',
    overflow: 'hidden',
    backgroundColor: '#272727',
  },
  thumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  duration: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    background: 'rgba(0,0,0,0.85)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: '500',
    padding: '2px 5px',
    borderRadius: '3px',
  },
  info: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '4px 0',
  },
  title: {
    fontSize: '18px',
    fontWeight: '400',
    lineHeight: '26px',
    color: 'var(--yt-text-primary)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    margin: 0,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    margin: 0,
  },
  channelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  avatar: {
    width: 24,
    height: 24,
    fontSize: 10,
  },
  channel: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
  },
  desc: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    lineHeight: '18px',
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  // Skeletons
  skeletonRow: { display: 'flex', gap: '16px', padding: '8px 0' },
  skeletonThumb: { width: 360, aspectRatio: '16/9', borderRadius: 12, flexShrink: 0 },
  skeletonInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 },
  skeletonTitle: { width: '70%', height: 20, borderRadius: 4 },
  skeletonMeta:  { width: '40%', height: 12, borderRadius: 4 },
  skeletonDesc:  { width: '90%', height: 12, borderRadius: 4 },
};
