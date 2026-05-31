import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import VideoGrid from './components/VideoGrid';
import WatchPage from './components/WatchPage';
import PlaylistPage from './components/PlaylistPage';
import SearchResults from './components/SearchResults';
import ChannelPage from './components/ChannelPage';
import DownloadDialog from './components/DownloadDialog';
import PlaylistMaker from './components/PlaylistMaker';
import FavouritesPage from './components/FavouritesPage';
import DashboardPage from './components/DashboardPage';
import { ConfirmProvider } from './components/ConfirmDialog';
import SettingsPage from './components/SettingsPage';
import ShortsPage from './components/ShortsPage';
import VocabularyPage from './components/VocabularyPage';

import { MiniPlayerProvider } from './context/MiniPlayerContext';
import MiniPlayer from './components/MiniPlayer';
import { client } from './api/client';
// global.css is imported in main.jsx

import { useAutoRefresh } from './hooks/useAutoRefresh';
import { useFavourites } from './hooks/useFavourites';

function Home() {
  const { data: videosRaw, loading } = useAutoRefresh(client.getLatestVideos, 30_000);
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const { isFav } = useFavourites();

  useEffect(() => {
    client.getTags()
      .then(setTags)
      .catch(console.error);
  }, [videosRaw]);

  const videos = (videosRaw ?? [])
    .filter(v => {
      if (deletedIds.has(v.id)) return false;
      if (selectedTag) {
        try {
          const vt = JSON.parse(v.tags || '[]');
          const vc = JSON.parse(v.categories || '[]');
          const allVTags = [...vt, ...vc].map(t => t.toLowerCase());
          return allVTags.includes(selectedTag.toLowerCase());
        } catch {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      const aFav = isFav(a.id);
      const bFav = isFav(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return 0;
    });

  const handleDelete = (id) => setDeletedIds(prev => new Set([...prev, id]));

  return (
    <div>
      {tags.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            padding: '16px 24px 8px',
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          className="tag-filter-bar"
        >
          <button
            onClick={() => setSelectedTag(null)}
            style={{
              backgroundColor: selectedTag === null ? 'var(--yt-text-primary)' : 'var(--yt-surface-hover)',
              color: selectedTag === null ? 'var(--yt-bg)' : 'var(--yt-text-primary)',
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background-color 0.15s, color 0.15s',
            }}
          >
            All
          </button>
          {tags.slice(0, 25).map(t => {
            const isSelected = selectedTag?.toLowerCase() === t.tag.toLowerCase();
            return (
              <button
                key={t.tag}
                onClick={() => setSelectedTag(isSelected ? null : t.tag)}
                style={{
                  backgroundColor: isSelected ? 'var(--yt-text-primary)' : 'var(--yt-surface-hover)',
                  color: isSelected ? 'var(--yt-bg)' : 'var(--yt-text-primary)',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'background-color 0.15s, color 0.15s',
                }}
              >
                {t.tag}
              </button>
            );
          })}
        </div>
      )}
      <VideoGrid videos={videos} loading={loading} onDelete={handleDelete} />
    </div>
  );
}

export default function App() {
  const [sidebarOpen,       setSidebarOpen]       = useState(true);
  const [downloadOpen,      setDownloadOpen]      = useState(false);
  const [playlistMakerOpen, setPlaylistMakerOpen] = useState(false);

  useEffect(() => {
    const amoled = localStorage.getItem('localplay_amoled') === 'true';
    if (amoled) {
      document.body.classList.add('amoled-theme');
    } else {
      document.body.classList.remove('amoled-theme');
    }
  }, []);

  return (
    <ConfirmProvider>
    <MiniPlayerProvider>
    <Router>
      <TopBar
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        onOpenDownload={() => setDownloadOpen(true)}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onNewPlaylist={() => setPlaylistMakerOpen(true)}
      />

      <main style={{
        marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed)',
        paddingTop: 'var(--topbar-height)',
        minHeight: '100vh',
        transition: 'margin-left 0.2s ease',
      }}>
        <Routes>
          <Route path="/"              element={<Home />} />
          <Route path="/watch/:id"     element={<WatchPage />} />
          <Route path="/playlist/:id"  element={<PlaylistPage />} />
          <Route path="/search"        element={<SearchResults />} />
          <Route path="/channel/:name" element={<ChannelPage />} />
          <Route path="/favourites"    element={<FavouritesPage />} />
          <Route path="/dashboard"     element={<DashboardPage />} />
          <Route path="/settings"      element={<SettingsPage />} />
          <Route path="/shorts"        element={<ShortsPage />} />
          <Route path="/vocabulary"    element={<VocabularyPage />} />

        </Routes>
      </main>

      {downloadOpen && (
        <DownloadDialog onClose={() => setDownloadOpen(false)} />
      )}

      {playlistMakerOpen && (
        <PlaylistMaker
          onClose={() => setPlaylistMakerOpen(false)}
          onCreated={() => setPlaylistMakerOpen(false)}
        />
      )}

      <MiniPlayer />
    </Router>
    </MiniPlayerProvider>
    </ConfirmProvider>
  );
}
