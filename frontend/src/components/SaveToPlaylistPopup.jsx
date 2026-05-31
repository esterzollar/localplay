/**
 * SaveToPlaylistPopup
 * Small popup anchored near the trigger button, lists all playlists with
 * checkboxes. Can also create a new playlist inline.
 *
 * YouTube UX:
 *  - Clicking "Save" on a hovered card opens this
 *  - Each playlist row shows a checkbox (checked if video is already in it)
 *  - Clicking a checkbox immediately adds/removes (API call)
 *  - "+ New playlist" at the bottom expands an inline name input
 */

import React, { useEffect, useRef, useState } from 'react';
import { client } from '../api/client';

export default function SaveToPlaylistPopup({ video, anchorRef, onClose }) {
  const popupRef = useRef(null);
  const [playlists,    setPlaylists]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [added,        setAdded]        = useState({});      // {playlistId: true/false}
  const [busy,         setBusy]         = useState({});      // {playlistId: true} while toggling
  const [creating,     setCreating]     = useState(false);   // show new-playlist form
  const [newTitle,     setNewTitle]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [pos,          setPos]          = useState({ top: 0, left: 0 });

  /* Position popup below/beside the anchor */
  useEffect(() => {
    if (!anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const POPUP_W = 260;
    const POPUP_H = 320;
    let top  = rect.bottom + 6;
    let left = rect.left;
    // keep inside viewport
    if (left + POPUP_W > window.innerWidth - 12) left = window.innerWidth - POPUP_W - 12;
    if (top + POPUP_H > window.innerHeight - 12) top = rect.top - POPUP_H - 6;
    setPos({ top, left });
  }, [anchorRef]);

  /* Click-outside to close */
  useEffect(() => {
    const onPointerDown = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [onClose, anchorRef]);

  /* Load playlists */
  useEffect(() => {
    client.getPlaylists()
      .then(pls => {
        setPlaylists(pls);
        // pre-check which playlists this video is in
        const state = {};
        pls.forEach(pl => {
          const inList = pl.videos?.some(v => v.id === video.id);
          if (inList) state[pl.id] = true;
        });
        setAdded(state);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [video.id]);

  /* Toggle add/remove */
  const toggle = async (pl) => {
    if (busy[pl.id]) return;
    setBusy(b => ({ ...b, [pl.id]: true }));
    try {
      if (added[pl.id]) {
        await client.removeVideoFromPlaylist(pl.id, video.id);
        setAdded(a => ({ ...a, [pl.id]: false }));
      } else {
        await client.addVideoToPlaylist(pl.id, video.id);
        setAdded(a => ({ ...a, [pl.id]: true }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(b => ({ ...b, [pl.id]: false }));
    }
  };

  /* Create new playlist and immediately add video */
  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const pl = await client.createPlaylist(newTitle.trim());
      await client.addVideoToPlaylist(pl.id, video.id);
      setPlaylists(p => [...p, pl]);
      setAdded(a => ({ ...a, [pl.id]: true }));
      setNewTitle('');
      setCreating(false);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={popupRef}
      style={{ ...S.popup, top: pos.top, left: pos.left }}
      onPointerDown={e => e.stopPropagation()}  // don't bubble to close handler
    >
      {/* Header */}
      <div style={S.popupHeader}>Save to playlist</div>

      {/* Playlist list */}
      <div style={S.list}>
        {loading ? (
          <div style={S.hint}>Loading…</div>
        ) : playlists.length === 0 && !creating ? (
          <div style={S.hint}>No playlists yet.</div>
        ) : (
          playlists.map(pl => (
            <label key={pl.id} style={{ ...S.row, opacity: busy[pl.id] ? 0.5 : 1 }}>
              <div
                style={{
                  ...S.checkbox,
                  backgroundColor: added[pl.id] ? 'var(--yt-blue)' : 'transparent',
                  borderColor: added[pl.id] ? 'var(--yt-blue)' : '#555',
                }}
                onClick={() => toggle(pl)}
              >
                {added[pl.id] && <span style={S.check}>✓</span>}
              </div>
              <span
                style={S.rowLabel}
                onClick={() => toggle(pl)}
              >
                {pl.title}
              </span>
              {added[pl.id] && (
                <span style={S.rowBadge}>✓</span>
              )}
            </label>
          ))
        )}
      </div>

      <div style={S.divider} />

      {/* New playlist section */}
      {!creating ? (
        <button style={S.newBtn} onClick={() => setCreating(true)}>
          <span style={S.newBtnIcon}>＋</span>
          New playlist
        </button>
      ) : (
        <form onSubmit={handleCreate} style={S.newForm}>
          <input
            autoFocus
            type="text"
            placeholder="Playlist name…"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            style={S.newInput}
            maxLength={80}
          />
          <div style={S.newFormBtns}>
            <button type="button" style={S.cancelBtn} onClick={() => { setCreating(false); setNewTitle(''); }}>
              Cancel
            </button>
            <button type="submit" style={{ ...S.createBtn, opacity: saving ? 0.6 : 1 }} disabled={saving || !newTitle.trim()}>
              {saving ? '…' : 'Create'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const S = {
  popup: {
    position: 'fixed',
    zIndex: 3000,
    width: 260,
    backgroundColor: '#282828',
    border: '1px solid #3a3a3a',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
  },
  popupHeader: {
    padding: '12px 16px 8px',
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    borderBottom: '1px solid #333',
  },
  list: {
    maxHeight: 200,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s',
    cursor: 'pointer',
  },
  check: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 700,
    lineHeight: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    color: 'var(--yt-text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
  },
  rowBadge: {
    fontSize: 11,
    color: 'var(--yt-blue)',
    flexShrink: 0,
  },
  hint: {
    padding: '12px 16px',
    fontSize: 13,
    color: 'var(--yt-text-secondary)',
  },
  divider: {
    borderTop: '1px solid #333',
    margin: '4px 0',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-primary)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
    width: '100%',
    textAlign: 'left',
    transition: 'background 0.1s',
  },
  newBtnIcon: {
    width: 18,
    height: 18,
    borderRadius: 4,
    border: '2px solid #555',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    lineHeight: 1,
    flexShrink: 0,
  },
  newForm: {
    padding: '8px 12px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  newInput: {
    padding: '8px 10px',
    backgroundColor: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 8,
    color: 'var(--yt-text-primary)',
    fontSize: 13,
    outline: 'none',
    fontFamily: 'inherit',
  },
  newFormBtns: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 6,
  },
  cancelBtn: {
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 8,
    color: 'var(--yt-text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  createBtn: {
    padding: '6px 14px',
    backgroundColor: 'var(--yt-blue)',
    border: 'none',
    borderRadius: 8,
    color: '#0f0f0f',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
};
