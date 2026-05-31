import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import { DashboardIcon } from './Icons';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function fmtBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function fmtDurationHrs(secs) {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${m}m`;
}

function fmtDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function formatViews(views) {
  if (!views) return '0 views';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
  if (views >= 1_000)     return (views / 1_000).toFixed(1)     + 'K views';
  return `${views.toLocaleString()} views`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  if (/^\d{8}$/.test(dateStr)) {
    const y = dateStr.slice(0, 4), m = dateStr.slice(4, 6), d = dateStr.slice(6, 8);
    return new Date(`${y}-${m}-${d}`).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
  return dateStr;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeSpotlight, setActiveSpotlight] = useState(null);

  useEffect(() => {
    client.getStats()
      .then(setStats)
      .catch((err) => {
        console.error('Failed to load stats', err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={styles.message}>Loading dashboard…</div>;
  if (error || !stats) return <div style={styles.message}>Error loading library statistics.</div>;

  const totalChannels = stats.by_channel ? stats.by_channel.length : 0;

  // Define spotlight cards configuration
  const spotlights = [
    { key: 'longest', label: 'Longest Video', data: stats.longest_video, icon: '⏳' },
    { key: 'shortest', label: 'Shortest Video', data: stats.shortest_video, icon: '⚡' },
    { key: 'largest', label: 'Largest File', data: stats.largest_video, icon: '💾' },
    { key: 'smallest', label: 'Smallest File', data: stats.smallest_video, icon: '🎈' },
    { key: 'oldest', label: 'Oldest Upload', data: stats.oldest_video, icon: '📜' },
    { key: 'most_viewed', label: 'Most Viewed', data: stats.most_viewed, icon: '🔥' }
  ].filter(s => s.data);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.headerIcon}>
            <DashboardIcon width={28} height={28} />
          </div>
          <div>
            <h1 style={styles.title}>Library Dashboard</h1>
            <p style={styles.subtitle}>Insights and analytics for your downloaded media archive</p>
          </div>
        </div>
      </div>

      {/* Row 1: Stat Cards */}
      <div style={styles.gridStats}>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #1e1b4b, #0f172a)' }}>
          <span style={styles.statLabel}>Total Videos</span>
          <span style={styles.statVal}>{stats.total_videos}</span>
          <div style={styles.statSub}>Downloaded locally</div>
        </div>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #311042, #0f172a)' }}>
          <span style={styles.statLabel}>Total Playtime</span>
          <span style={styles.statVal}>{fmtDurationHrs(stats.total_duration_seconds)}</span>
          <div style={styles.statSub}>{stats.total_duration_seconds.toLocaleString()} total secs</div>
        </div>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #064e3b, #0f172a)' }}>
          <span style={styles.statLabel}>Disk Size</span>
          <span style={styles.statVal}>{fmtBytes(stats.total_size_bytes)}</span>
          <div style={styles.statSub}>Occupied disk space</div>
        </div>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #7c2d12, #0f172a)' }}>
          <span style={styles.statLabel}>This Week</span>
          <span style={styles.statVal}>+{stats.videos_this_week}</span>
          <div style={styles.statSub}>Videos added last 7d</div>
        </div>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #115e59, #0f172a)' }}>
          <span style={styles.statLabel}>This Month</span>
          <span style={styles.statVal}>+{stats.videos_this_month}</span>
          <div style={styles.statSub}>Videos added last 30d</div>
        </div>
        <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
          <span style={styles.statLabel}>Subscribed Channels</span>
          <span style={styles.statVal}>{totalChannels}</span>
          <div style={styles.statSub}>With cached content</div>
        </div>
      </div>

      {/* Row 2: Spotlights */}
      {spotlights.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={styles.sectionTitle}>Library Highlights</h2>
          <div style={styles.spotlightRow}>
            {spotlights.map(s => (
              <div
                key={s.key}
                style={styles.spotlightCard}
                className="dashboard-spotlight-card"
                onClick={() => setActiveSpotlight(s)}
              >
                <div style={styles.spotlightIcon}>{s.icon}</div>
                <div style={styles.spotlightMeta}>
                  <span style={styles.spotlightLabel}>{s.label}</span>
                  <span style={styles.spotlightTitle} title={s.data.title}>{s.data.title}</span>
                  <span style={styles.spotlightChannel}>{s.data.channel}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Row 3: Charts and Lists */}
      <div style={styles.bottomSection}>
        {/* Top Channels Chart */}
        <div style={styles.chartPanel}>
          <h2 style={styles.sectionTitle}>Videos by Channel</h2>
          {stats.by_channel && stats.by_channel.length > 0 ? (
            <div style={styles.chartList}>
              {stats.by_channel.slice(0, 5).map((ch, idx) => {
                const maxCount = stats.by_channel[0]?.count || 1;
                const percent = (ch.count / maxCount) * 100;
                return (
                  <div key={idx} style={styles.chartRow}>
                    <div
                      style={styles.chartChannelName}
                      onClick={() => navigate(`/channel/${encodeURIComponent(ch.name)}`)}
                      title={ch.name}
                    >
                      {ch.name}
                    </div>
                    <div style={styles.chartBarContainer}>
                      <div
                        style={{
                          ...styles.chartBar,
                          width: `${percent}%`,
                          backgroundColor: styles.chartColors[idx % styles.chartColors.length]
                        }}
                      />
                      <span style={styles.chartCount}>{ch.count} {ch.count === 1 ? 'vid' : 'vids'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={styles.emptyChart}>No channel data available.</div>
          )}
        </div>

        {/* Recent Downloads */}
        <div style={styles.recentPanel}>
          <h2 style={styles.sectionTitle}>Recent Downloads</h2>
          {stats.recent_downloads && stats.recent_downloads.length > 0 ? (
            <div style={styles.recentList}>
              {stats.recent_downloads.slice(0, 5).map((v, i) => (
                <div
                  key={v.id}
                  className="recent-item-hover"
                  style={styles.recentItem}
                  onClick={() => navigate(`/watch/${v.id}`)}
                >
                  <div style={styles.recentThumbWrap}>
                    <img
                      src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                      alt={v.title}
                      style={styles.recentThumb}
                    />
                  </div>
                  <div style={styles.recentInfo}>
                    <div style={styles.recentTitle} title={v.title}>{v.title}</div>
                    <div style={styles.recentChannel}>{v.channel}</div>
                    <div style={styles.recentMeta}>
                      {fmtDuration(v.duration)} • {fmtBytes(v.file_size)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={styles.emptyChart}>No recent downloads.</div>
          )}
        </div>
      </div>

      {/* Spotlight Popup Modal */}
      {activeSpotlight && (
        <div style={styles.modalOverlay} onClick={() => setActiveSpotlight(null)}>
          <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalHighlightLabel}>{activeSpotlight.label}</h3>
            
            <div style={styles.modalMediaWrapper}>
              <img
                src={activeSpotlight.data.thumbnail_path ? `/media/${activeSpotlight.data.thumbnail_path}` : ''}
                alt={activeSpotlight.data.title}
                style={styles.modalThumb}
              />
              <span style={styles.modalDuration}>{fmtDuration(activeSpotlight.data.duration)}</span>
            </div>

            <h2 style={styles.modalTitle}>{activeSpotlight.data.title}</h2>
            <p style={styles.modalChannel}>{activeSpotlight.data.channel}</p>

            <div style={styles.modalGrid}>
              <div style={styles.modalGridItem}>
                <span style={styles.modalGridLabel}>Upload Date</span>
                <span style={styles.modalGridValue}>{formatDate(activeSpotlight.data.upload_date)}</span>
              </div>
              {activeSpotlight.data.view_count !== undefined && (
                <div style={styles.modalGridItem}>
                  <span style={styles.modalGridLabel}>Original Views</span>
                  <span style={styles.modalGridValue}>{formatViews(activeSpotlight.data.view_count)}</span>
                </div>
              )}
              {activeSpotlight.data.file_size !== undefined && (
                <div style={styles.modalGridItem}>
                  <span style={styles.modalGridLabel}>File Size</span>
                  <span style={styles.modalGridValue}>{fmtBytes(activeSpotlight.data.file_size)}</span>
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              <button
                style={styles.modalPlayBtn}
                onClick={() => {
                  setActiveSpotlight(null);
                  navigate(`/watch/${activeSpotlight.data.id}`);
                }}
              >
                ▶ Watch Now
              </button>
              <button
                style={styles.modalCloseBtn}
                onClick={() => setActiveSpotlight(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '24px 32px 48px',
    maxWidth: '1600px',
    margin: '0 auto',
  },
  header: {
    marginBottom: 32,
    borderBottom: '1px solid var(--yt-border)',
    paddingBottom: 24,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--yt-red)',
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
  },
  subtitle: {
    fontSize: 14,
    color: 'var(--yt-text-secondary)',
    marginTop: 2,
  },
  gridStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
  },
  statCard: {
    borderRadius: 16,
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.03)',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.8px',
  },
  statVal: {
    fontSize: 32,
    fontWeight: 700,
    color: '#fff',
    marginTop: 8,
    lineHeight: '38px',
  },
  statSub: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--yt-text-primary)',
    marginBottom: 16,
  },
  spotlightRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 16,
  },
  spotlightCard: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 14,
    cursor: 'pointer',
    alignItems: 'center',
    transition: 'transform 0.15s, background-color 0.15s, border-color 0.15s',
  },
  spotlightIcon: {
    fontSize: 28,
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spotlightMeta: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  spotlightLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--yt-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  spotlightTitle: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  spotlightChannel: {
    fontSize: 12,
    color: 'var(--yt-text-secondary)',
    marginTop: 2,
  },
  bottomSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: 24,
    marginTop: 32,
  },
  chartPanel: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 16,
    padding: 24,
  },
  recentPanel: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 16,
    padding: 24,
  },
  chartList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    marginTop: 8,
  },
  chartRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  chartChannelName: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    cursor: 'pointer',
    width: 'fit-content',
  },
  chartBarContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  chartBar: {
    height: 12,
    borderRadius: 6,
    minWidth: 4,
    transition: 'width 0.6s ease',
  },
  chartCount: {
    fontSize: 12,
    color: 'var(--yt-text-secondary)',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  chartColors: [
    '#3ea6ff',
    '#ff4e45',
    '#10b981',
    '#a855f7',
    '#f59e0b'
  ],
  emptyChart: {
    padding: '40px 0',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: 14,
  },
  recentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  recentItem: {
    display: 'flex',
    gap: 12,
    cursor: 'pointer',
    borderRadius: 8,
    padding: 6,
    transition: 'background-color 0.1s',
  },
  recentThumbWrap: {
    width: 90,
    aspectRatio: '16/9',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#000',
    flexShrink: 0,
  },
  recentThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  recentInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--yt-text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recentChannel: {
    fontSize: 11,
    color: 'var(--yt-text-secondary)',
    marginTop: 2,
  },
  recentMeta: {
    fontSize: 11,
    color: 'var(--yt-text-secondary)',
    marginTop: 2,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    animation: 'fadeIn 0.15s ease',
  },
  modalContent: {
    backgroundColor: '#1f1f1f',
    border: '1px solid #333',
    borderRadius: 16,
    padding: 24,
    width: 450,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    animation: 'slideUp 0.18s ease',
    boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
  },
  modalHighlightLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--yt-blue)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: 4,
  },
  modalMediaWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  modalThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  modalDuration: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
    color: '#fff',
    fontSize: 11,
    padding: '2px 4px',
    borderRadius: 2,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#fff',
    lineHeight: '22px',
    marginTop: 4,
  },
  modalChannel: {
    fontSize: 13,
    color: 'var(--yt-text-secondary)',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 12,
    borderTop: '1px solid #333',
    borderBottom: '1px solid #333',
    padding: '12px 0',
    marginTop: 6,
  },
  modalGridItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  modalGridLabel: {
    fontSize: 10,
    color: 'var(--yt-text-secondary)',
    textTransform: 'uppercase',
  },
  modalGridValue: {
    fontSize: 12,
    color: '#fff',
    fontWeight: 500,
  },
  modalActions: {
    display: 'flex',
    gap: 12,
    marginTop: 12,
  },
  modalPlayBtn: {
    flex: 1,
    backgroundColor: 'var(--yt-blue)',
    color: '#0f0f0f',
    padding: '10px',
    borderRadius: 20,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  modalCloseBtn: {
    padding: '10px 20px',
    border: '1px solid #444',
    borderRadius: 20,
    color: 'var(--yt-text-secondary)',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'border-color 0.15s, color 0.15s',
  },
  message: {
    padding: '80px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  }
};
