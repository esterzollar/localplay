import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function PlaylistPanel({ playlist, currentVideoId }) {
  const navigate = useNavigate();

  if (!playlist || !playlist.videos) return null;

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <h3 style={styles.title}>{playlist.title}</h3>
        <p style={styles.channel}>{playlist.channel || 'LocalPlay'} • {playlist.videos.length} videos</p>
      </div>
      <div style={styles.list}>
        {playlist.videos.map((v, index) => {
          const isActive = v.id === parseInt(currentVideoId, 10);
          return (
            <div 
              key={v.id} 
              style={{ 
                ...styles.item, 
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent' 
              }}
              onClick={() => navigate(`/watch/${v.id}?list=${playlist.id}`)}
            >
              <div style={{ 
                ...styles.index, 
                color: isActive ? 'var(--yt-blue)' : 'var(--yt-text-secondary)' 
              }}>
                {isActive ? '▶' : index + 1}
              </div>
              <div style={styles.thumbWrapper}>
                <img src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : 'placeholder.jpg'} alt={v.title} style={styles.thumbnail} />
              </div>
              <div style={styles.info}>
                <div style={styles.videoTitle} title={v.title}>{v.title}</div>
                <div style={styles.videoChannel}>{v.channel}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  panel: {
    width: '100%',
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    height: '400px',
    overflow: 'hidden'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid var(--yt-border)',
    backgroundColor: '#1f1f1f',
  },
  title: { fontSize: '16px', fontWeight: '700', color: 'var(--yt-text-primary)', marginBottom: '4px' },
  channel: { fontSize: '12px', color: 'var(--yt-text-secondary)' },
  list: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
  item: { display: 'flex', padding: '8px 12px', cursor: 'pointer', gap: '8px', alignItems: 'center', transition: 'background-color 0.2s' },
  index: { width: '24px', textAlign: 'center', fontSize: '12px', fontWeight: '500' },
  thumbWrapper: { width: '100px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#000' },
  thumbnail: { width: '100%', height: '100%', objectFit: 'cover' },
  info: { flex: 1, minWidth: 0 },
  videoTitle: { fontSize: '13px', fontWeight: '500', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'var(--yt-text-primary)' },
  videoChannel: { fontSize: '11px', color: 'var(--yt-text-secondary)', marginTop: '4px' }
};
