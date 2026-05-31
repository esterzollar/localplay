import React from 'react';
import VideoCard from './VideoCard';

export default function VideoGrid({ videos, loading, error, onDelete }) {
  if (error) return <div style={styles.message}>Error loading videos.</div>;

  if (loading) {
    return (
      <div style={styles.grid}>
        {[...Array(12)].map((_, i) => (
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
    );
  }

  if (!videos || videos.length === 0) {
    return <div style={styles.message}>No videos found.</div>;
  }

  return (
    <div style={styles.grid}>
      {videos.map(v => <VideoCard key={v.id} video={v} onDelete={onDelete} />)}
    </div>
  );
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '40px 16px',
    padding: '24px 24px 48px',
  },
  message: {
    padding: '80px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  },
  // Skeleton
  skeletonCard: { display: 'flex', flexDirection: 'column', gap: '12px' },
  skeletonThumb: { width: '100%', aspectRatio: '16/9', borderRadius: '12px' },
  skeletonRow: { display: 'flex', gap: '12px', padding: '0 4px' },
  skeletonAvatar: { width: 36, height: 36, borderRadius: '50%', flexShrink: 0 },
  skeletonTexts: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', paddingTop: 2 },
  skeletonTitle: { width: '85%', height: 14, borderRadius: 4 },
  skeletonMeta:  { width: '55%', height: 12, borderRadius: 4 },
};
