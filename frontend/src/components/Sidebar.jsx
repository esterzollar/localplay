import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import { HomeIcon, HomeActiveIcon, PlaylistIcon, ChannelsIcon, HeartFilledIcon, TrashIcon, DashboardIcon, SettingsIcon, ShortsIcon, BookIcon } from './Icons';

import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useConfirm } from './ConfirmDialog';

function colorFromName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 38%)`;
}

export default function Sidebar({ isOpen, onNewPlaylist }) {
  const navigate = useNavigate();
  const { confirm } = useConfirm();

  const { data: playlistsRaw } = useAutoRefresh(client.getPlaylists, 4_000);
  const { data: channelsRaw  } = useAutoRefresh(client.getChannels,  10_000);
  const playlists = playlistsRaw ?? [];
  const channels  = channelsRaw  ?? [];

  const linkStyle = (isActive) => ({
    flexDirection: isOpen ? 'row' : 'column',
    padding: isOpen ? '0 12px' : '14px 4px',
    gap: isOpen ? '24px' : '4px',
    justifyContent: isOpen ? 'flex-start' : 'center',
    height: isOpen ? '40px' : 'auto',
    minHeight: isOpen ? '40px' : 'auto',
    backgroundColor: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
    fontWeight: isActive ? '500' : '400',
  });

  return (
    <aside style={{
      ...styles.sidebar,
      width: isOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)',
    }}>
      {/* ── Home ── */}
      <div style={styles.section}>
        <NavLink
          to="/"
          end
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          {({ isActive }) => (
            <>
              {isActive ? <HomeActiveIcon /> : <HomeIcon />}
              <span style={styles.label(isOpen)}>Home</span>
            </>
          )}
        </NavLink>
      </div>

      {/* ── Shorts ── */}
      <div style={styles.section}>
        <NavLink
          to="/shorts"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          <ShortsIcon style={{ width: 24, height: 24 }} />
          <span style={styles.label(isOpen)}>Shorts</span>
        </NavLink>
      </div>

      {/* ── Favourites ── */}
      <div style={styles.section}>
        <NavLink
          to="/favourites"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          <HeartFilledIcon style={{ width: 24, height: 24 }} />
          <span style={styles.label(isOpen)}>Favourites</span>
        </NavLink>
      </div>

      {/* ── Dashboard ── */}
      <div style={styles.section}>
        <NavLink
          to="/dashboard"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          <DashboardIcon style={{ width: 24, height: 24 }} />
          <span style={styles.label(isOpen)}>Dashboard</span>
        </NavLink>
      </div>

      {/* ── Vocabulary ── */}
      <div style={styles.section}>
        <NavLink
          to="/vocabulary"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          <BookIcon style={{ width: 24, height: 24 }} />
          <span style={styles.label(isOpen)}>Vocabulary</span>
        </NavLink>
      </div>

      <hr style={styles.divider} />


      {/* ── Channels ── */}
      {channels.length > 0 && (
        <>
          {isOpen && <p style={styles.sectionLabel}>Channels</p>}

          <div style={styles.section}>
            {channels.map(ch => {
              const initial = (ch.name || 'C').charAt(0).toUpperCase();
              const bg = colorFromName(ch.name);
              const path = `/channel/${encodeURIComponent(ch.name)}`;

              return (
                <NavLink
                  key={ch.name}
                  to={path}
                  className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                  style={({ isActive }) => linkStyle(isActive)}
                  title={ch.name}
                >
                  {/* Small channel avatar */}
                  <div style={{ ...styles.miniAvatar, backgroundColor: bg }}>
                    {initial}
                  </div>
                  {isOpen && (
                    <span style={{
                      fontSize: '14px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                    }}>
                      {ch.name}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>

          <hr style={styles.divider} />
        </>
      )}

      {/* ── Playlists ── */}
      <>
        {isOpen && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 8px 20px' }}>
            <p style={{ ...styles.sectionLabel, padding: 0, margin: 0 }}>Playlists</p>
            <button
              onClick={onNewPlaylist}
              style={styles.newPlaylistBtn}
              title="New Playlist"
              aria-label="New Playlist"
            >+</button>
          </div>
        )}
        {!isOpen && onNewPlaylist && (
          <div style={{ padding: '4px 8px' }}>
            <button
              onClick={onNewPlaylist}
              style={{ ...styles.newPlaylistBtn, width: '100%', borderRadius: 8, height: 36 }}
              title="New Playlist"
            >+</button>
          </div>
        )}
        <div style={styles.section}>
          {playlists.map(pl => (
            <div key={pl.id} style={styles.playlistRow}>
              <NavLink
                to={`/playlist/${pl.id}`}
                className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                style={({ isActive }) => ({ ...linkStyle(isActive), flex: 1, minWidth: 0 })}
                title={pl.title}
              >
                <PlaylistIcon style={{ flexShrink: 0 }} />
                <span style={{
                  fontSize: isOpen ? '14px' : '10px',
                  lineHeight: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: isOpen ? 'nowrap' : 'normal',
                  textAlign: isOpen ? 'left' : 'center',
                  maxWidth: '100%',
                }}>
                  {pl.title}
                </span>
              </NavLink>
              {isOpen && (
                <button
                  style={styles.deleteBtn}
                  title="Delete playlist"
                  aria-label={`Delete ${pl.title}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    const ok = await confirm({
                      title: 'Delete playlist?',
                      message: `"${pl.title}" will be permanently deleted.`,
                      confirmLabel: 'Delete',
                      danger: true,
                    });
                    if (!ok) return;
                    await client.deletePlaylist(pl.id).catch(console.error);
                  }}
                >
                  <TrashIcon style={{ width: 14, height: 14 }} />
                </button>
              )}
            </div>
          ))}
        </div>
      </>

      {/* ── Settings ── */}
      <hr style={styles.divider} />
      <div style={styles.section}>
        <NavLink
          to="/settings"
          className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          style={({ isActive }) => linkStyle(isActive)}
        >
          <SettingsIcon style={{ width: 24, height: 24 }} />
          <span style={styles.label(isOpen)}>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    position: 'fixed',
    top: 'var(--topbar-height)',
    bottom: 0,
    left: 0,
    backgroundColor: 'var(--yt-bg)',
    overflowY: 'auto',
    overflowX: 'hidden',
    transition: 'width 0.2s ease',
    paddingTop: '12px',
    paddingBottom: '24px',
    zIndex: 900,
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 8px',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid var(--yt-border)',
    margin: '12px 0',
  },
  sectionLabel: {
    padding: '4px 12px 8px 20px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--yt-text-primary)',
    letterSpacing: '0.1px',
    margin: 0,
  },
  label: (isOpen) => ({
    fontSize: isOpen ? '14px' : '10px',
    lineHeight: 1,
  }),
  miniAvatar: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: '700',
    color: '#fff',
    flexShrink: 0,
  },
  newPlaylistBtn: {
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'var(--yt-text-primary)',
    fontSize: '18px',
    lineHeight: '24px',
    textAlign: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.15s',
  },
  playlistRow: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  deleteBtn: {
    flexShrink: 0,
    width: 28,
    height: 28,
    borderRadius: 6,
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.15s, color 0.15s',
    marginRight: 4,
  },
};
