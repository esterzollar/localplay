import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SaveToPlaylistPopup from './SaveToPlaylistPopup';
import { TrashIcon } from './Icons';
import { client } from '../api/client';
import { getRawProgress } from '../hooks/useWatchProgress';

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatViews(views) {
  if (!views) return 'No views';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
  if (views >= 1_000)     return (views / 1_000).toFixed(1)     + 'K views';
  return views + ' views';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{8}$/.test(dateStr)) {
    const y = dateStr.slice(0,4), m = dateStr.slice(4,6), d = dateStr.slice(6,8);
    return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
  }
  return dateStr;
}

/* ── Delete Modal ───────────────────────────────────────────────────────────── */
function DeleteModal({ title, onCancel, onKeep, onDisk }) {
  return (
    <div style={dm.backdrop} onClick={onCancel}>
      <div style={dm.modal} onClick={e => e.stopPropagation()}>
        <div style={dm.iconRing}>
          <TrashIcon style={{ width: 28, height: 28, color: '#ef4444' }} />
        </div>
        <h2 style={dm.title}>Remove video?</h2>
        <p style={dm.msg} title={title}>
          <strong style={{ color: 'var(--yt-text-primary)' }}>"{title.length > 60 ? title.slice(0, 60) + '…' : title}"</strong>
        </p>

        <div style={dm.options}>
          {/* Keep files */}
          <button style={dm.optionBtn} onClick={onKeep}>
            <span style={dm.optionIcon}>📚</span>
            <div style={dm.optionText}>
              <span style={dm.optionLabel}>Remove from library</span>
              <span style={dm.optionHint}>Keep the video file on disk</span>
            </div>
          </button>

          {/* Delete from disk */}
          <button style={{ ...dm.optionBtn, ...dm.optionDanger }} onClick={onDisk}>
            <span style={dm.optionIcon}>🗑</span>
            <div style={dm.optionText}>
              <span style={dm.optionLabel}>Delete from disk</span>
              <span style={dm.optionHint}>Permanently removes all files</span>
            </div>
          </button>
        </div>

        <button style={dm.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

const dm = {
  backdrop: {
    position: 'fixed', inset: 0, zIndex: 9000,
    backgroundColor: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(6px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    animation: 'fadeIn 0.15s ease',
  },
  modal: {
    backgroundColor: '#1c1c1c',
    border: '1px solid #333',
    borderRadius: 20,
    padding: '32px 28px 24px',
    width: 380,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 14,
    animation: 'slideUp 0.18s ease',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  iconRing: {
    width: 64, height: 64, borderRadius: '50%',
    background: 'rgba(239,68,68,0.1)',
    border: '2px solid rgba(239,68,68,0.3)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 18, fontWeight: 700,
    color: 'var(--yt-text-primary)', margin: 0, textAlign: 'center',
  },
  msg: {
    fontSize: 13, color: 'var(--yt-text-secondary)',
    margin: 0, textAlign: 'center', lineHeight: 1.5,
  },
  options: {
    display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4,
  },
  optionBtn: {
    display: 'flex', alignItems: 'center', gap: 14,
    padding: '14px 16px',
    backgroundColor: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderRadius: 12,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    color: 'var(--yt-text-primary)',
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s',
  },
  optionDanger: {
    borderColor: 'rgba(239,68,68,0.25)',
    backgroundColor: 'rgba(239,68,68,0.06)',
  },
  optionIcon: { fontSize: 22, flexShrink: 0 },
  optionText: { display: 'flex', flexDirection: 'column', gap: 2 },
  optionLabel: { fontSize: 14, fontWeight: 600 },
  optionHint: { fontSize: 12, color: 'var(--yt-text-secondary)' },
  cancelBtn: {
    marginTop: 4,
    padding: '9px 28px',
    backgroundColor: 'transparent',
    border: '1px solid #444',
    borderRadius: 20,
    color: 'var(--yt-text-secondary)',
    fontSize: 13, fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};

/* ── Component ──────────────────────────────────────────────────────────────── */
export default function VideoCard({ video, onDelete }) {
  const navigate    = useNavigate();
  const saveRef     = useRef(null);
  const initial     = (video.channel || 'C').charAt(0).toUpperCase();

  const [hovered,     setHovered]     = useState(false);
  const [popupOpen,   setPopupOpen]   = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);

  const progressSecs = getRawProgress(video.id);
  const percent = video.duration && progressSecs > 10 ? (progressSecs / video.duration) * 100 : 0;

  let tagsList = [];
  try {
    if (video.tags) tagsList = JSON.parse(video.tags) || [];
  } catch {}
  let catsList = [];
  try {
    if (video.categories) catsList = JSON.parse(video.categories) || [];
  } catch {}
  const allTags = [...tagsList, ...catsList];

  const goToChannel = (e) => {
    e.stopPropagation();
    if (video.channel) navigate(`/channel/${encodeURIComponent(video.channel)}`);
  };

  const openSavePopup = (e) => {
    e.stopPropagation();
    setPopupOpen(true);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    setDeleteModal(true);
  };

  const doDelete = async (deleteFiles) => {
    setDeleteModal(false);
    try {
      await client.deleteVideo(video.id, deleteFiles);
      onDelete?.(video.id);
    } catch (err) {
      console.error('Delete failed', err);
    }
  };


  return (
    <>
      <div
        className="video-card"
        onClick={() => navigate(`/watch/${video.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); }}
        role="article"
        aria-label={video.title}
        style={{ position: 'relative' }}
      >
        {/* ── Thumbnail ── */}
        <div className="video-card-thumb-wrapper">
          <img
            src={video.thumbnail_path ? `/media/${video.thumbnail_path}` : ''}
            alt={video.title}
            className="video-card-thumb"
            loading="lazy"
          />
          {video.file_path ? (
            <span className="video-card-duration">{formatDuration(video.duration)}</span>
          ) : (
            <span style={{
              position: 'absolute', bottom: 8, right: 8,
              backgroundColor: 'rgba(200,50,50,0.9)', color: 'white',
              padding: '2px 6px', borderRadius: 4,
              fontSize: 11, fontWeight: 600, letterSpacing: '0.3px',
            }}>FILE MISSING</span>
          )}

          {/* Watch progress bar */}
          {percent > 0 && (
            <div style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              zIndex: 10,
            }}>
              <div style={{
                height: '100%',
                width: `${percent}%`,
                backgroundColor: 'var(--yt-red)',
              }} />
            </div>
          )}

          {/* ── YouTube-style hover overlay ── */}
          <div style={{
            ...styles.hoverOverlay,
            opacity: hovered ? 1 : 0,
            pointerEvents: hovered ? 'auto' : 'none',
          }}>
            {/* Delete button */}
            <button
              className="card-delete-btn"
              style={{ ...styles.saveBtn, ...styles.deleteBtn }}
              onClick={handleDeleteClick}
              aria-label="Delete video"
              title="Remove from library"
            >
              <TrashIcon style={{ width: 14, height: 14 }} />
            </button>

            {/* Save to playlist button */}
            <button
              ref={saveRef}
              style={styles.saveBtn}
              onClick={openSavePopup}
              aria-label="Save to playlist"
              title="Save to playlist"
            >
              <SaveIcon />
              <span style={styles.saveBtnLabel}>Save</span>
            </button>
          </div>
        </div>

        {/* ── Meta ── */}
        <div style={styles.details}>
          <div
            className="avatar"
            style={{ ...styles.avatar, cursor: 'pointer' }}
            onClick={goToChannel}
            title={video.channel}
          >{initial}</div>
          <div style={styles.info}>
            <p className="video-card-title" title={video.title}>{video.title}</p>
            {allTags.length > 0 && (
              <div className="tag-chips-container" style={{
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                marginTop: 2,
                marginBottom: hovered ? 4 : 0,
                opacity: hovered ? 1 : 0,
                height: hovered ? 'auto' : 0,
                overflow: 'hidden',
                transition: 'opacity 0.2s, height 0.2s, margin-bottom 0.2s',
              }}>
                {allTags.slice(0, 3).map((t, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: 10,
                      color: 'var(--yt-blue)',
                      backgroundColor: 'rgba(62, 166, 255, 0.12)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <p
              className="video-card-channel"
              onClick={goToChannel}
              style={{ cursor: 'pointer' }}
            >{video.channel}</p>
            <p className="video-card-meta">
              {formatViews(video.view_count)}&thinsp;•&thinsp;{formatDate(video.upload_date)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Save popup (portal-ish, rendered at root level) ── */}
      {popupOpen && (
        <SaveToPlaylistPopup
          video={video}
          anchorRef={saveRef}
          onClose={() => setPopupOpen(false)}
        />
      )}

      {deleteModal && (
        <DeleteModal
          title={video.title}
          onCancel={() => setDeleteModal(false)}
          onKeep={() => doDelete(false)}
          onDisk={() => doDelete(true)}
        />
      )}
    </>
  );
}

/* ── Save icon ──────────────────────────────────────────────────────────────── */
const SaveIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
    <path d="M22 13h-4v4h-2v-4h-4v-2h4V7h2v4h4v2zm-8-6H2v1h12V7zM2 12h8v-1H2v1zm0 4h8v-1H2v1z"/>
  </svg>
);

/* ── Styles ──────────────────────────────────────────────────────────────────── */
const styles = {
  details: {
    display: 'flex',
    gap: '12px',
    padding: '0 4px',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 36,
    height: 36,
    fontSize: 14,
    marginTop: 2,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  /* Hover overlay — bottom strip of the thumbnail */
  hoverOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '28px 8px 8px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, transparent 100%)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    gap: 6,
    transition: 'opacity 0.18s ease',
    borderRadius: '0 0 10px 10px',
  },
  saveBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '5px 10px',
    backgroundColor: 'rgba(0,0,0,0.75)',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 20,
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    backdropFilter: 'blur(4px)',
    transition: 'background-color 0.15s',
    flexShrink: 0,
  },
  saveBtnLabel: {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.2px',
  },
  deleteBtn: {
    padding: '5px 8px',
    color: '#ff6b6b',
    borderColor: 'rgba(255,107,107,0.3)',
  },
};
