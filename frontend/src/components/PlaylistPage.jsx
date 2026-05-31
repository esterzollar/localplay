import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import { PlayIcon } from './Icons';
import PlaylistPlaceholder from './PlaylistPlaceholder';

function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function PlaylistPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client.getPlaylist(id).then(setPlaylist).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={styles.message}>Loading...</div>;
  if (!playlist) return <div style={styles.message}>Playlist not found.</div>;

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.blurBg} />
        <div style={styles.sidebarContent}>
          <div style={styles.thumbContainer}>
            {playlist.thumbnail_path ? (
              <img src={`/media/${playlist.thumbnail_path}`} style={styles.thumb} alt="" />
            ) : (
              <PlaylistPlaceholder playlistId={playlist.id} title={playlist.title} />
            )}
          </div>
          <h1 style={styles.title}>{playlist.title}</h1>
          <p style={styles.channel}>{playlist.channel || 'LocalPlay'}</p>
          <p style={styles.meta}>{playlist.video_count || playlist.videos.length} videos</p>
          <div style={styles.actions}>
            <button style={styles.playAll} onClick={() => {
              if (playlist.videos.length > 0) {
                navigate(`/watch/${playlist.videos[0].id}?list=${playlist.id}`);
              }
            }}>
              <PlayIcon style={{ width: '20px', height: '20px', marginRight: '8px' }} />
              Play All
            </button>
          </div>
        </div>
      </div>
      
      <div style={styles.list}>
        {playlist.videos.map((v, index) => (
          <div key={v.id} style={styles.item} onClick={() => navigate(`/watch/${v.id}?list=${playlist.id}`)}>
            <div style={styles.index}>{index + 1}</div>
            <div style={styles.itemThumbContainer}>
              <img src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : 'placeholder.jpg'} style={styles.itemThumb} alt="" />
              <div style={styles.duration}>{formatDuration(v.duration)}</div>
            </div>
            <div style={styles.itemInfo}>
              <div style={styles.itemTitle}>{v.title}</div>
              <div style={styles.itemChannel}>{v.channel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', padding: '24px 60px', gap: '32px', maxWidth: '1600px', margin: '0 auto', flexWrap: 'wrap', justifyContent: 'center' },
  sidebar: { 
    width: '360px', 
    flexShrink: 0, 
    background: 'linear-gradient(to bottom, #2b2b2b, #121212)', 
    padding: '24px', 
    borderRadius: '16px', 
    position: 'sticky', 
    top: '80px', 
    height: 'max-content',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    border: '1px solid var(--yt-border)'
  },
  sidebarContent: { position: 'relative', zIndex: 2 },
  thumbContainer: { width: '100%', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px' },
  thumb: { width: '100%', height: '100%', objectFit: 'cover' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '16px', lineHeight: 1.2, color: 'var(--yt-text-primary)' },
  channel: { fontSize: '15px', fontWeight: '500', marginBottom: '4px', color: 'var(--yt-text-primary)' },
  meta: { fontSize: '13px', color: 'var(--yt-text-secondary)', marginBottom: '24px' },
  actions: { display: 'flex', gap: '8px' },
  playAll: { flex: 1, padding: '12px', backgroundColor: 'var(--yt-text-primary)', color: 'var(--yt-bg)', borderRadius: '24px', fontWeight: 'bold', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.2s' },
  list: { flex: 1, minWidth: '400px', display: 'flex', flexDirection: 'column', gap: '4px' },
  item: { display: 'flex', gap: '16px', padding: '8px 12px', borderRadius: '12px', cursor: 'pointer', alignItems: 'center', transition: 'background-color 0.2s' },
  index: { width: '24px', textAlign: 'center', color: 'var(--yt-text-secondary)', fontSize: '14px', fontWeight: '500' },
  itemThumbContainer: { position: 'relative', width: '160px', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#272727' },
  itemThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  duration: { position: 'absolute', bottom: '6px', right: '6px', backgroundColor: 'rgba(0,0,0,0.8)', color: 'white', padding: '2px 4px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: '15px', fontWeight: '500', marginBottom: '6px', color: 'var(--yt-text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
  itemChannel: { fontSize: '13px', color: 'var(--yt-text-secondary)' },
  message: { padding: '80px 40px', textAlign: 'center', color: 'var(--yt-text-secondary)', fontSize: '18px' }
};
