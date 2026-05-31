import React, { useState, useEffect, useRef } from 'react';
import { client } from '../api/client';
import { SearchIcon } from './Icons';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function formatDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

/* ── Component ────────────────────────────────────────────────────────── */
export default function PlaylistMaker({ onClose, onCreated }) {
  const [step,       setStep]       = useState('name');  // 'name' | 'videos'
  const [title,      setTitle]      = useState('');
  const [playlist,   setPlaylist]   = useState(null);
  const [allVideos,  setAllVideos]  = useState([]);
  const [selected,   setSelected]   = useState([]);   // [{id, title, channel, thumbnail_path, duration}]
  const [query,      setQuery]      = useState('');
  const [creating,   setCreating]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const inputRef = useRef(null);

  /* Load all videos once */
  useEffect(() => {
    client.getVideos('date').then(setAllVideos).catch(console.error);
  }, []);

  /* Focus title input */
  useEffect(() => {
    if (step === 'name') setTimeout(() => inputRef.current?.focus(), 50);
  }, [step]);

  const filtered = allVideos.filter(v => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      v.title?.toLowerCase().includes(q) ||
      v.channel?.toLowerCase().includes(q)
    );
  });

  const isSelected = (id) => selected.some(v => v.id === id);

  const toggle = (video) => {
    if (isSelected(video.id)) {
      setSelected(s => s.filter(v => v.id !== video.id));
    } else {
      setSelected(s => [...s, video]);
    }
  };

  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...selected];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setSelected(next);
  };
  const moveDown = (i) => {
    if (i === selected.length - 1) return;
    const next = [...selected];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    setSelected(next);
  };
  const removeSelected = (id) => setSelected(s => s.filter(v => v.id !== id));

  /* Step 1: Create the playlist */
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError('');
    try {
      const pl = await client.createPlaylist(title.trim());
      setPlaylist(pl);
      setStep('videos');
    } catch (err) {
      setError('Failed to create playlist.');
    } finally {
      setCreating(false);
    }
  };

  /* Step 2: Save video selections */
  const handleSave = async () => {
    if (!playlist) return;
    setSaving(true);
    setError('');
    try {
      for (const v of selected) {
        await client.addVideoToPlaylist(playlist.id, v.id);
      }
      onCreated?.(playlist);
      onClose();
    } catch (err) {
      setError('Some videos could not be added.');
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.dialog} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>
            {step === 'name' ? '📋 New Playlist' : `Add Videos — ${playlist?.title}`}
          </h2>
          <button onClick={onClose} style={styles.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* ══ Step 1: Name ══ */}
        {step === 'name' && (
          <div style={styles.body}>
            <p style={styles.hint}>Give your playlist a name to get started.</p>
            <form onSubmit={handleCreate} style={styles.nameForm}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Playlist name…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={styles.nameInput}
                maxLength={100}
                id="playlist-name-input"
                required
              />
              {error && <div style={styles.error}>{error}</div>}
              <button
                type="submit"
                style={{ ...styles.primaryBtn, opacity: creating ? 0.6 : 1 }}
                disabled={creating || !title.trim()}
              >
                {creating ? 'Creating…' : 'Create & Add Videos →'}
              </button>
            </form>
          </div>
        )}

        {/* ══ Step 2: Video picker ══ */}
        {step === 'videos' && (
          <div style={styles.twoCol}>
            {/* Left: search + video list */}
            <div style={styles.picker}>
              <div style={styles.searchRow}>
                <SearchIcon style={{ color: 'var(--yt-text-secondary)', flexShrink: 0 }} />
                <input
                  type="search"
                  placeholder="Search videos…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  style={styles.searchInput}
                  id="playlist-video-search"
                  autoComplete="off"
                />
              </div>
              <div style={styles.videoList}>
                {filtered.length === 0 ? (
                  <div style={styles.empty}>No videos found.</div>
                ) : filtered.map(v => (
                  <div
                    key={v.id}
                    style={{
                      ...styles.videoRow,
                      backgroundColor: isSelected(v.id) ? 'rgba(62,166,255,0.12)' : 'transparent',
                    }}
                    onClick={() => toggle(v)}
                  >
                    {/* Checkbox */}
                    <div style={{
                      ...styles.checkbox,
                      backgroundColor: isSelected(v.id) ? 'var(--yt-blue)' : 'transparent',
                      borderColor: isSelected(v.id) ? 'var(--yt-blue)' : '#555',
                    }}>
                      {isSelected(v.id) && <span style={styles.checkmark}>✓</span>}
                    </div>
                    {/* Thumbnail */}
                    <div style={styles.videoThumbWrap}>
                      <img
                        src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                        alt=""
                        style={styles.videoThumb}
                        loading="lazy"
                      />
                      {v.duration && (
                        <span style={styles.videoDuration}>{formatDuration(v.duration)}</span>
                      )}
                    </div>
                    {/* Info */}
                    <div style={styles.videoInfo}>
                      <div style={styles.videoTitle}>{v.title}</div>
                      <div style={styles.videoChannel}>{v.channel}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: queue */}
            <div style={styles.queue}>
              <div style={styles.queueHeader}>
                Selected ({selected.length})
              </div>
              {selected.length === 0 ? (
                <div style={styles.empty}>Click videos on the left to add them.</div>
              ) : (
                <div style={styles.queueList}>
                  {selected.map((v, i) => (
                    <div key={v.id} style={styles.queueItem}>
                      <span style={styles.queueIdx}>{i + 1}</span>
                      <img
                        src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                        alt=""
                        style={styles.queueThumb}
                        loading="lazy"
                      />
                      <span style={styles.queueTitle}>{v.title}</span>
                      <div style={styles.queueBtns}>
                        <button onClick={() => moveUp(i)}   style={styles.orderBtn} title="Move up"   disabled={i === 0}>▲</button>
                        <button onClick={() => moveDown(i)} style={styles.orderBtn} title="Move down" disabled={i === selected.length - 1}>▼</button>
                        <button onClick={() => removeSelected(v.id)} style={{ ...styles.orderBtn, color: '#ef4444' }} title="Remove">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {error && <div style={{ ...styles.error, marginTop: 8 }}>{error}</div>}

              <button
                onClick={handleSave}
                style={{ ...styles.primaryBtn, marginTop: 'auto', opacity: saving ? 0.6 : 1 }}
                disabled={saving || selected.length === 0}
              >
                {saving ? 'Saving…' : `Save Playlist (${selected.length} videos)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────── */
const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    backdropFilter: 'blur(6px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
  },
  dialog: {
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: 20,
    width: 860,
    maxWidth: '96vw',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 60px rgba(0,0,0,0.7)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    margin: 0,
  },
  closeBtn: {
    width: 32, height: 32,
    borderRadius: '50%',
    color: 'var(--yt-text-secondary)',
    fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    background: 'transparent',
    border: 'none',
  },
  body: {
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  hint: {
    fontSize: 14,
    color: 'var(--yt-text-secondary)',
    margin: 0,
  },
  nameForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  nameInput: {
    padding: '13px 18px',
    backgroundColor: '#121212',
    border: '1px solid #333',
    borderRadius: 12,
    color: 'var(--yt-text-primary)',
    fontSize: 16,
    outline: 'none',
    fontFamily: 'inherit',
    width: '100%',
    boxSizing: 'border-box',
  },
  error: {
    color: '#ef4444',
    fontSize: 13,
    padding: '8px 12px',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    border: '1px solid rgba(239,68,68,0.2)',
  },
  primaryBtn: {
    padding: '13px',
    backgroundColor: 'var(--yt-blue)',
    color: '#0f0f0f',
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'opacity 0.2s',
  },
  /* Two-column layout */
  twoCol: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  picker: {
    flex: '0 0 56%',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #2a2a2a',
    overflow: 'hidden',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  searchInput: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--yt-text-primary)',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
  },
  videoList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  videoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1,
  },
  videoThumbWrap: {
    position: 'relative',
    width: 80,
    aspectRatio: '16/9',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#272727',
    flexShrink: 0,
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  videoDuration: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.85)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 4px',
    borderRadius: 3,
  },
  videoInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  videoTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  videoChannel: {
    fontSize: 11,
    color: 'var(--yt-text-secondary)',
  },
  /* Queue */
  queue: {
    flex: '0 0 44%',
    display: 'flex',
    flexDirection: 'column',
    padding: '12px 16px',
    gap: 10,
    overflow: 'hidden',
  },
  queueHeader: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--yt-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    flexShrink: 0,
  },
  queueList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#222',
    borderRadius: 8,
    padding: '6px 8px',
  },
  queueIdx: {
    fontSize: 12,
    fontWeight: 700,
    color: 'var(--yt-text-secondary)',
    width: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  queueThumb: {
    width: 48,
    aspectRatio: '16/9',
    borderRadius: 4,
    objectFit: 'cover',
    flexShrink: 0,
  },
  queueTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  queueBtns: {
    display: 'flex',
    gap: 2,
    flexShrink: 0,
  },
  orderBtn: {
    width: 24,
    height: 24,
    borderRadius: 4,
    fontSize: 11,
    color: 'var(--yt-text-secondary)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.1s, color 0.1s',
  },
  empty: {
    padding: '24px 0',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: 13,
  },
};
