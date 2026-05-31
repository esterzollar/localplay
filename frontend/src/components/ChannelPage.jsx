import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { client } from '../api/client';
import VideoCard from './VideoCard';
import { SearchIcon } from './Icons';

/* ── Helpers ──────────────────────────────────────── */
function colorFromName(name = '') {
  // Deterministic hue from channel name for avatar bg
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 60%, 38%)`;
}

function bannerGradient(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const h1 = Math.abs(hash) % 360;
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1},55%,22%) 0%, hsl(${h2},55%,16%) 100%)`;
}

const SORT_OPTIONS = [
  { value: 'date',   label: 'Latest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'views',  label: 'Most viewed' },
];

/* ── Component ────────────────────────────────────── */
export default function ChannelPage() {
  const { name }              = useParams();
  const channelName           = decodeURIComponent(name);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate              = useNavigate();

  const [videos,   setVideos]   = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [sort,     setSort]     = useState(searchParams.get('sort') || 'date');
  const [query,    setQuery]    = useState(searchParams.get('q')    || '');
  const [inputVal, setInputVal] = useState(searchParams.get('q')    || '');
  const [focused,  setFocused]  = useState(false);
  const inputRef               = useRef(null);

  /* fetch whenever sort / query changes */
  useEffect(() => {
    setLoading(true);
    client
      .getChannelVideos(channelName, { q: query, sort })
      .then(setVideos)
      .catch(() => setVideos([]))
      .finally(() => setLoading(false));

    // keep URL in sync
    const params = {};
    if (sort !== 'date') params.sort = sort;
    if (query)           params.q    = query;
    setSearchParams(params, { replace: true });
  }, [channelName, query, sort]);

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(inputVal.trim());
  };

  const clearSearch = () => {
    setInputVal('');
    setQuery('');
    inputRef.current?.focus();
  };

  const initial  = (channelName || 'C').charAt(0).toUpperCase();
  const bg       = colorFromName(channelName);
  const banner   = bannerGradient(channelName);
  const total    = videos ? videos.length : 0;

  return (
    <div style={styles.page}>
      {/* ── Banner ── */}
      <div style={{ ...styles.banner, background: banner }} />

      {/* ── Channel header ── */}
      <div style={styles.header}>
        <div style={{ ...styles.channelAvatar, backgroundColor: bg }}>
          {initial}
        </div>
        <div style={styles.channelInfo}>
          <h1 style={styles.channelName}>{channelName}</h1>
          <p style={styles.channelMeta}>
            {loading ? '…' : `${total} video${total !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ── Tabs / controls bar ── */}
      <div style={styles.controlsBar}>
        {/* Sort tabs */}
        <div style={styles.tabs}>
          {SORT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              style={{
                ...styles.tab,
                ...(sort === opt.value ? styles.tabActive : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* In-channel search */}
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <div style={{
            ...styles.searchBox,
            borderColor: focused ? '#1c62b9' : 'var(--yt-border)',
            boxShadow: focused ? 'inset 0 1px 2px rgba(0,0,0,0.3)' : 'none',
          }}>
            <SearchIcon style={{ color: 'var(--yt-text-secondary)', flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="search"
              placeholder={`Search in ${channelName}`}
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={styles.searchInput}
              id="channel-search-input"
              autoComplete="off"
            />
            {inputVal && (
              <button
                type="button"
                onClick={clearSearch}
                style={styles.clearBtn}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
          <button
            type="submit"
            style={styles.searchBtn}
            aria-label="Search channel"
          >
            <SearchIcon />
          </button>
        </form>
      </div>

      {/* ── Divider ── */}
      <hr style={styles.divider} />

      {/* ── Active search banner ── */}
      {query && (
        <div style={styles.searchBanner}>
          <span style={styles.searchBannerText}>
            {loading ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} for`}
            {!loading && <strong style={{ color: 'var(--yt-text-primary)' }}> "{query}"</strong>}
          </span>
          <button onClick={clearSearch} style={styles.clearAllBtn}>
            Clear search
          </button>
        </div>
      )}

      {/* ── Video grid ── */}
      {loading ? (
        <div style={styles.grid}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={styles.skeletonCard}>
              <div className="skeleton" style={styles.skeletonThumb} />
              <div style={styles.skeletonRow}>
                <div className="skeleton" style={styles.skeletonAvatar} />
                <div style={styles.skeletonTexts}>
                  <div className="skeleton" style={styles.skeletonTitle} />
                  <div className="skeleton" style={styles.skeletonMeta} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !videos || videos.length === 0 ? (
        <div style={styles.empty}>
          {query
            ? `No videos in this channel match "${query}".`
            : 'No videos from this channel yet.'}
        </div>
      ) : (
        <div style={styles.grid}>
          {videos.map(v => <VideoCard key={v.id} video={v} />)}
        </div>
      )}
    </div>
  );
}

/* ── Styles ───────────────────────────────────────── */
const styles = {
  page: {
    minHeight: '100vh',
  },
  /* Banner strip – 130px tall, full width */
  banner: {
    width: '100%',
    height: '130px',
  },
  /* Channel header row */
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px',
    padding: '20px 60px 16px',
    maxWidth: '1750px',
    margin: '0 auto',
  },
  channelAvatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    fontWeight: '700',
    color: '#fff',
    flexShrink: 0,
    border: '3px solid var(--yt-bg)',
    marginTop: '-32px',  // lift it over the banner bottom edge
    boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  },
  channelInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  channelName: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--yt-text-primary)',
    margin: 0,
    letterSpacing: '-0.3px',
  },
  channelMeta: {
    fontSize: '14px',
    color: 'var(--yt-text-secondary)',
    margin: 0,
  },
  /* Controls bar */
  controlsBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: '12px',
    padding: '0 60px 12px',
    maxWidth: '1750px',
    margin: '0 auto',
  },
  tabs: {
    display: 'flex',
    gap: '4px',
  },
  tab: {
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--yt-text-secondary)',
    cursor: 'pointer',
    transition: 'color 0.15s, background-color 0.15s',
    background: 'none',
    border: 'none',
  },
  tabActive: {
    color: 'var(--yt-text-primary)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  /* Search */
  searchForm: {
    display: 'flex',
    gap: 0,
    height: '38px',
    width: '340px',
    flexShrink: 0,
  },
  searchBox: {
    flex: 1,
    backgroundColor: '#121212',
    border: '1px solid',
    borderRadius: '40px 0 0 40px',
    padding: '0 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--yt-text-primary)',
    fontSize: '14px',
    outline: 'none',
    minWidth: 0,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-secondary)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '0 2px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
  },
  searchBtn: {
    width: '54px',
    flexShrink: 0,
    backgroundColor: '#222',
    border: '1px solid var(--yt-border)',
    borderLeft: 'none',
    borderRadius: '0 40px 40px 0',
    color: 'var(--yt-text-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--yt-border)',
    margin: '0 60px 8px',
  },
  /* Active search notice */
  searchBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 60px 0',
    maxWidth: '1750px',
    margin: '0 auto',
  },
  searchBannerText: {
    fontSize: '13px',
    color: 'var(--yt-text-secondary)',
  },
  clearAllBtn: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--yt-blue)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  /* Grid */
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '40px 16px',
    padding: '16px 60px 48px',
  },
  empty: {
    padding: '80px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  },
  /* Skeleton */
  skeletonCard:   { display: 'flex', flexDirection: 'column', gap: 12 },
  skeletonThumb:  { width: '100%', aspectRatio: '16/9', borderRadius: 12 },
  skeletonRow:    { display: 'flex', gap: 12, padding: '0 4px' },
  skeletonAvatar: { width: 36, height: 36, borderRadius: '50%', flexShrink: 0 },
  skeletonTexts:  { flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 },
  skeletonTitle:  { width: '85%', height: 14, borderRadius: 4 },
  skeletonMeta:   { width: '55%', height: 12, borderRadius: 4 },
};
