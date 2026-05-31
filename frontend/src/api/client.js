import axios from 'axios';
const api = axios.create({ baseURL: '/api' });

export const client = {
  // Videos
  getVideos:            async (sort = 'date') => (await api.get(`/videos?sort=${sort}`)).data,
  getLatestVideos:      async () => (await api.get('/videos/latest')).data,
  getVideo:             async (id) => (await api.get(`/videos/${id}`)).data,
  getSimilarVideos:     async (id) => (await api.get(`/videos/${id}/similar`)).data,
  deleteVideo:          async (id, deleteFiles = false) =>
    api.delete(`/videos/${id}`, { params: { delete_files: deleteFiles } }),

  // Channels
  getChannels:          async () => (await api.get('/videos/channels')).data,
  getChannelVideos:     async (name, { q = '', sort = 'date' } = {}) =>
    (await api.get(`/videos/channel/${encodeURIComponent(name)}`, { params: { q, sort } })).data,

  // Playlists
  getPlaylists:         async () => (await api.get('/playlists')).data,
  getPlaylist:          async (id) => (await api.get(`/playlists/${id}`)).data,
  createPlaylist:       async (title) => (await api.post('/playlists', { title })).data,
  renamePlaylist:       async (id, title) => (await api.put(`/playlists/${id}`, { title })).data,
  deletePlaylist:       async (id) => api.delete(`/playlists/${id}`),
  addVideoToPlaylist:   async (playlistId, videoId) =>
    (await api.post(`/playlists/${playlistId}/videos`, { video_id: videoId })).data,
  removeVideoFromPlaylist: async (playlistId, videoId) =>
    (await api.delete(`/playlists/${playlistId}/videos/${videoId}`)).data,

  // Search
  searchVideos:         async (query) => (await api.get(`/search?q=${encodeURIComponent(query)}`)).data,

  // Downloads
  getVideoInfo:         async (url) =>
    (await api.get('/download/info', { params: { url } })).data,
  startDownload:        async (url, quality = 'best', captions = false) =>
    (await api.post('/download/start', { url, quality, captions })).data,
  getDownloadProgress:  async () => (await api.get('/download/progress')).data,
  getDownloadHistory:   async () => (await api.get('/download/history')).data,
  // Stats (dashboard)
  getStats:             async () => (await api.get('/stats')).data,

  // Tags
  getTags:              async () => (await api.get('/tags')).data,
  getVideoTags:         async (id) => (await api.get(`/tags/video/${id}`)).data,

  // Settings
  getSettings:          async () => (await api.get('/settings')).data,
  updateSettings:       async (settings) => (await api.post('/settings', settings)).data,

  // Shorts
  getShorts:            async () => (await api.get('/videos/shorts')).data,

  // Study Notes
  getVideoNotes:        async (videoId) => (await api.get(`/notes/video/${videoId}`)).data,
  createVideoNote:      async (videoId, timestamp, content) => (await api.post(`/notes/video/${videoId}`, { timestamp, content })).data,
  deleteVideoNote:      async (noteId) => api.delete(`/notes/${noteId}`),

  // Vocabulary Spotlight
  getVocabulary:        async (videoId) => (await api.get(`/vocabulary/video/${videoId}`)).data,
  bookmarkWord:         async (wordId, videoId, timestamp) => (await api.post('/vocabulary/board', { word_id: wordId, video_id: videoId, timestamp })).data,
  getReviewQueue:       async () => (await api.get('/vocabulary/board/queue')).data,
  getBoardCards:        async () => (await api.get('/vocabulary/board/all')).data,
  reviewWord:           async (boardId, rating) => (await api.post(`/vocabulary/board/review/${boardId}`, { rating })).data,
  deleteBoardCard:      async (boardId) => api.delete(`/vocabulary/board/${boardId}`),


  // Algorithms: Interactions, Feedback, Auto-Chapters
  addInteraction:       async (videoId, eventType, timestamp, duration = 0.0) => (await api.post(`/videos/${videoId}/interactions`, { event_type: eventType, timestamp, duration })).data,
  submitFeedback:       async (videoId, rating) => (await api.post(`/videos/${videoId}/feedback`, { rating })),
  triggerAutoChapters:  async (videoId) => (await api.post(`/videos/${videoId}/auto-chapters`)).data,
};

