import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { client } from '../api/client';
import VideoPlayer from './VideoPlayer';
import PlaylistPanel from './PlaylistPanel';
import SaveToPlaylistPopup from './SaveToPlaylistPopup';
import { LikeIcon, TrashIcon, HeartIcon, HeartFilledIcon } from './Icons';
import { useFavourites } from '../hooks/useFavourites';

const SaveIconSm = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
    <path d="M22 13h-4v4h-2v-4h-4v-2h4V7h2v4h4v2zm-8-6H2v1h12V7zM2 12h8v-1H2v1zm0 4h8v-1H2v1z"/>
  </svg>
);

function formatViews(views) {
  if (!views) return '0 views';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M views';
  if (views >= 1_000)     return (views / 1_000).toFixed(1)     + 'K views';
  return `${views.toLocaleString()} views`;
}

function formatLikes(n) {
  if (!n) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1)     + 'K';
  return String(n);
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

function formatViewsCompact(views) {
  if (!views) return '0';
  if (views >= 1_000_000) return (views / 1_000_000).toFixed(1) + 'M';
  if (views >= 1_000)     return (views / 1_000).toFixed(1)     + 'K';
  return String(views);
}

function fmtTimestamp(sec) {
  if (!sec) return '0:00';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

export default function WatchPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const listId = searchParams.get('list');
  const navigate = useNavigate();

  const playerRef = useRef(null);
  const [video,        setVideo]        = useState(null);
  const [playlist,     setPlaylist]     = useState(null);
  const [similarVideos,setSimilarVideos]= useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const [liked,        setLiked]        = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [saveOpen,     setSaveOpen]     = useState(false);
  const saveRef = useRef(null);
  const { isFav, toggleFav } = useFavourites();

  const [sidebarTab, setSidebarTab] = useState('next'); // 'next' | 'notes' | 'vocab'
  const [notes, setNotes] = useState([]);
  const [noteContent, setNoteContent] = useState('');

  // Vocabulary Spotlight State
  const [vocabulary, setVocabulary] = useState([]);
  const [vocabLoading, setVocabLoading] = useState(false);

  // LCI & Chaptering State
  const [userRating, setUserRating] = useState(5);
  const [chapteringStarted, setChapteringStarted] = useState(false);

  useEffect(() => {
    setLoading(true);
    setExpanded(false);
    setLiked(false);
    client.getVideo(id)
      .then(setVideo)
      .catch(() => setError(true))
      .finally(() => setLoading(false));

    client.getSimilarVideos(id).then(setSimilarVideos).catch(console.error);

    if (listId) client.getPlaylist(listId).then(setPlaylist).catch(console.error);
    else setPlaylist(null);

    client.getVideoNotes(id)
      .then(setNotes)
      .catch(console.error);

    // Fetch subtitles vocabulary Spotlight
    setVocabLoading(true);
    client.getVocabulary(id)
      .then(setVocabulary)
      .catch(console.error)
      .finally(() => setVocabLoading(false));
  }, [id, listId]);

  const handleLciUpdate = (lciScore, lciSegmentWeights) => {
    setVideo(prev => prev ? {
      ...prev,
      lci_score: lciScore,
      lci_segment_weights: JSON.stringify(lciSegmentWeights)
    } : prev);
  };

  const handleToggleBookmark = async (word) => {
    try {
      if (word.is_bookmarked) {
        await client.deleteBoardCard(word.board_id);
        setVocabulary(prev => prev.map(w => w.word_id === word.word_id ? { ...w, is_bookmarked: false, board_id: null } : w));
      } else {
        const boardItem = await client.bookmarkWord(word.word_id, id, word.timestamp);
        setVocabulary(prev => prev.map(w => w.word_id === word.word_id ? { ...w, is_bookmarked: true, board_id: boardItem.id } : w));
      }
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
    }
  };

  const handleTriggerAutoChapters = async () => {
    try {
      setChapteringStarted(true);
      await client.triggerAutoChapters(id);
      
      // Poll backend for chapters completion (checks every 4 seconds)
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const v = await client.getVideo(id);
          if (v && v.chapters) {
            const ch = JSON.parse(v.chapters);
            if (ch && ch.length > 0) {
              setVideo(v);
              clearInterval(interval);
              setChapteringStarted(false);
            }
          }
        } catch {}
        if (attempts > 15) {
          clearInterval(interval);
          setChapteringStarted(false);
        }
      }, 4000);
    } catch (err) {
      console.error('Failed to start auto-chaptering:', err);
      setChapteringStarted(false);
    }
  };

  const handleSubmitDifficulty = async () => {
    try {
      const res = await client.submitFeedback(id, userRating);
      if (res) {
        setVideo(prev => prev ? {
          ...prev,
          lci_score: res.lci_score,
          lci_segment_weights: JSON.stringify(res.lci_segment_weights)
        } : prev);
      }
    } catch (err) {
      console.error('Failed to submit difficulty:', err);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteContent.trim()) return;

    const player = playerRef.current?.getVideoElement?.() || playerRef.current;
    const timestamp = player ? Math.floor(player.currentTime || 0) : 0;

    try {
      const newNote = await client.createVideoNote(id, timestamp, noteContent.trim());
      setNotes(prev => [...prev, newNote].sort((a, b) => a.timestamp - b.timestamp));
      setNoteContent('');

      // Send note_added interaction event to recalculate video complexity
      client.addInteraction(id, 'note_added', timestamp, 0)
        .then(res => {
          if (res) {
            setVideo(prev => prev ? {
              ...prev,
              lci_score: res.lci_score,
              lci_segment_weights: JSON.stringify(res.lci_segment_weights)
            } : prev);
          }
        })
        .catch(console.error);
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await client.deleteVideoNote(noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
    } catch (err) {
      console.error('Failed to delete note:', err);
    }
  };

  if (loading) return <div style={styles.message}>Loading…</div>;
  if (error || !video) return <div style={styles.message}>Video not found.</div>;

  const initial = (video.channel || 'C').charAt(0).toUpperCase();
  const likeCount = video.like_count || 1024;

  // Parse chapters
  let chapters = [];
  try { chapters = JSON.parse(video.chapters || '[]') || []; } catch {}

  // Parse LCI segment weights
  let lciWeights = [];
  try {
    if (video.lci_segment_weights) {
      lciWeights = JSON.parse(video.lci_segment_weights) || [];
    }
  } catch {}


  // Build subtitle URL: e.g. /media/ChannelName/VideoTitle.en.vtt
  const subtitleSrc = video.file_path
    ? `/media/${video.file_path.replace(/\.[^.]+$/, '.en.vtt')}`
    : null;

  const goToChannel = () => {
    if (video.channel) navigate(`/channel/${encodeURIComponent(video.channel)}`);
  };

  const handleVideoEnded = () => {
    if (playlist && playlist.videos) {
      const idx = playlist.videos.findIndex(v => v.id === parseInt(id, 10));
      if (idx !== -1 && idx < playlist.videos.length - 1) {
        const nextVideo = playlist.videos[idx + 1];
        navigate(`/watch/${nextVideo.id}?list=${playlist.id}`);
        return;
      }
    }

    if (similarVideos && similarVideos.length > 0) {
      const nextVideo = similarVideos[0];
      navigate(`/watch/${nextVideo.id}`);
    }
  };

  return (
    <div style={styles.page}>
      {/* ── Left/main column ── */}
      <div style={styles.main}>
        {/* Player */}
        <div style={styles.playerWrap}>
          <VideoPlayer
            ref={playerRef}
            videoId={video.id}
            videoTitle={video.title}
            videoChannel={video.channel}
            videoThumbnail={video.thumbnail_path}
            onVideoEnded={handleVideoEnded}
            onMiniPlayerTrigger={() => navigate('/')}
            src={`/api/stream/${video.id}`}
            poster={video.thumbnail_path ? `/media/${video.thumbnail_path}` : ''}
            subtitleSrc={subtitleSrc}
            chapters={chapters}
            onLciUpdate={handleLciUpdate}
            lciWeights={lciWeights}
          />

        </div>

        {/* Title */}
        <h1 style={styles.title}>{video.title}</h1>

        {/* Channel row + action pills */}
        <div style={styles.belowTitle}>
          {/* Channel info + favourite */}
          <div style={styles.channelRow}>
            <div
              style={{ ...styles.avatar, cursor: 'pointer' }}
              className="avatar"
              onClick={goToChannel}
              title={video.channel}
            >{initial}</div>
            <div style={styles.channelMeta}>
              <div
                style={{ ...styles.channelName, cursor: 'pointer' }}
                onClick={goToChannel}
              >{video.channel}</div>
            </div>
             {/* Favourite replaces Subscribe */}
            <button
              className={`subscribe-btn fav-btn ${isFav(video.id) ? 'fav-btn-active subscribed' : 'unsubscribed'}`}
              onClick={() => toggleFav(video.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              title={isFav(video.id) ? 'Remove from Favourites' : 'Add to Favourites'}
            >
              {isFav(video.id)
                ? <HeartFilledIcon width={16} height={16} />
                : <HeartIcon width={16} height={16} />}
              {isFav(video.id) ? 'Favourited' : 'Favourite'}
            </button>
          </div>

          {/* Action buttons */}
          <div style={styles.actions}>
            {/* Like pill */}
            <button
              className="btn-pill"
              onClick={() => setLiked(l => !l)}
              style={liked ? { backgroundColor: 'var(--yt-surface-active)' } : {}}
              aria-label="Like"
              title={liked ? 'Unlike' : 'Like'}
            >
              <LikeIcon width={18} height={18} />
              <span>{formatLikes(likeCount + (liked ? 1 : 0))}</span>
            </button>

            <button
              ref={saveRef}
              className="btn-pill"
              aria-label="Save to playlist"
              title="Save to playlist"
              onClick={() => setSaveOpen(o => !o)}
            >
              <SaveIconSm />
              <span>Save</span>
            </button>
          </div>
        </div>

        {saveOpen && (
          <SaveToPlaylistPopup
            video={video}
            anchorRef={saveRef}
            onClose={() => setSaveOpen(false)}
          />
        )}

        {/* Description box */}
        <div className="description-box" onClick={() => setExpanded(e => !e)}>
          <div style={styles.descMeta}>
            <span style={styles.descViews}>{formatViews(video.view_count)}</span>
            <span>&nbsp;&nbsp;{formatDate(video.upload_date)}</span>
          </div>
          <div style={{
            ...styles.descText,
            WebkitLineClamp: expanded ? 'unset' : 3,
            display: expanded ? 'block' : '-webkit-box',
          }}>
            {video.description || 'No description.'}
          </div>
          <span style={styles.showMore}>{expanded ? 'Show less' : 'Show more'}</span>
        </div>

        {/* Study Analytics Box */}
        <div style={styles.analyticsBox}>
          <div style={styles.analyticsHeader}>
            <span style={{ fontWeight: '600', fontSize: 14, color: 'var(--yt-text-primary)' }}>🧠 LocalPlay Study Analytics</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {chapters.length === 0 && (
                <button
                  onClick={handleTriggerAutoChapters}
                  disabled={chapteringStarted}
                  style={styles.chapterBtn}
                >
                  {chapteringStarted ? '⚙️ Chaptering...' : '✨ Auto-Detect Chapters'}
                </button>
              )}
            </div>
          </div>
          
          <div style={styles.analyticsGrid}>
            <div style={styles.analyticsItem}>
              <span style={styles.analyticsLabel}>Learning Complexity Index (LCI)</span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={styles.analyticsVal}>{video.lci_score !== null && video.lci_score !== undefined ? video.lci_score.toFixed(2) : '0.00'}</span>
                <span style={{
                  fontSize: 11,
                  fontWeight: '600',
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: !video.lci_score || video.lci_score < 3.0 ? 'rgba(16, 185, 129, 0.15)' : video.lci_score < 7.0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: !video.lci_score || video.lci_score < 3.0 ? '#10b981' : video.lci_score < 7.0 ? '#f59e0b' : '#ef4444'
                }}>
                  {!video.lci_score || video.lci_score < 3.0 ? 'Easy' : video.lci_score < 7.0 ? 'Medium' : 'Hard'}
                </span>
              </div>
              <span style={styles.analyticsSub}>Calculated from seeking frequency and pause durations</span>
            </div>

            <div style={styles.analyticsItem}>
              <span style={styles.analyticsLabel}>Rate Study Difficulty</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={userRating}
                  onChange={e => setUserRating(parseInt(e.target.value))}
                  style={{ accentColor: 'var(--accent-color, #6366f1)', cursor: 'pointer', flex: 1, height: 4 }}
                />
                <span style={{ fontSize: 14, fontWeight: '700', minWidth: 20 }}>{userRating}</span>
                <button
                  onClick={handleSubmitDifficulty}
                  className="note-submit-btn"
                  style={{ ...styles.noteSubmitBtn, alignSelf: 'center', padding: '4px 12px', fontSize: 12, margin: 0 }}
                >
                  Submit
                </button>
              </div>
              <span style={styles.analyticsSub}>Updates neural complexity weights based on your feedback</span>
            </div>
          </div>
        </div>


        {/* Chapters */}
        {chapters.length > 0 && (
          <div style={styles.chaptersBox}>
            <button
              style={styles.chaptersToggle}
              onClick={() => setChaptersOpen(o => !o)}
            >
              <span>📑 Chapters ({chapters.length})</span>
              <span style={{ fontSize: 12, color: 'var(--yt-text-secondary)' }}>
                {chaptersOpen ? '▲ Hide' : '▼ Show'}
              </span>
            </button>
            {chaptersOpen && (
              <div style={styles.chaptersList}>
                {chapters.map((ch, i) => {
                  const ts = (() => {
                    const t = ch.start_time || 0;
                    const h = Math.floor(t / 3600);
                    const m = Math.floor((t % 3600) / 60);
                    const s = Math.floor(t % 60);
                    return h > 0
                      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
                      : `${m}:${String(s).padStart(2,'0')}`;
                  })();
                  return (
                    <div
                      key={i}
                      className="chapter-item"
                      style={styles.chapterItem}
                      onClick={() => playerRef.current?.seekTo(ch.start_time)}
                    >
                      <span style={styles.chapterTs}>{ts}</span>
                      <span style={styles.chapterTitle}>{ch.title}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Right sidebar column ── */}
      <div style={styles.sidebar}>
        {playlist && (
          <div style={{ marginBottom: 8 }}>
            <PlaylistPanel playlist={playlist} currentVideoId={id} />
          </div>
        )}

        {/* Tab Selection */}
        <div style={styles.tabHeader}>
          <button
            onClick={() => setSidebarTab('next')}
            style={{
              ...styles.tabButton,
              borderBottom: sidebarTab === 'next' ? '2px solid var(--accent-color, #6366f1)' : '2px solid transparent',
              color: sidebarTab === 'next' ? 'var(--yt-text-primary)' : 'var(--yt-text-secondary)',
              fontWeight: sidebarTab === 'next' ? '600' : '400',
            }}
          >
            Up Next
          </button>
          <button
            onClick={() => setSidebarTab('notes')}
            style={{
              ...styles.tabButton,
              borderBottom: sidebarTab === 'notes' ? '2px solid var(--accent-color, #6366f1)' : '2px solid transparent',
              color: sidebarTab === 'notes' ? 'var(--yt-text-primary)' : 'var(--yt-text-secondary)',
              fontWeight: sidebarTab === 'notes' ? '600' : '400',
            }}
          >
            Study Notes
          </button>
          <button
            onClick={() => setSidebarTab('vocab')}
            style={{
              ...styles.tabButton,
              borderBottom: sidebarTab === 'vocab' ? '2px solid var(--accent-color, #6366f1)' : '2px solid transparent',
              color: sidebarTab === 'vocab' ? 'var(--yt-text-primary)' : 'var(--yt-text-secondary)',
              fontWeight: sidebarTab === 'vocab' ? '600' : '400',
            }}
          >
            Vocabulary Spotlight
          </button>
        </div>

        {sidebarTab === 'next' && (
          <div>
            <h3 style={styles.upNextHeading}>Up next</h3>
            <div style={styles.upNextList}>
              {similarVideos.map(v => {
                const ch = (v.channel || 'C').charAt(0).toUpperCase();
                return (
                  <div
                    key={v.id}
                    className="compact-card"
                    onClick={() => navigate(`/watch/${v.id}${listId ? `?list=${listId}` : ''}`)}
                    role="article"
                    aria-label={v.title}
                  >
                    <div style={styles.compactThumbWrap}>
                      <img
                        src={v.thumbnail_path ? `/media/${v.thumbnail_path}` : ''}
                        alt={v.title}
                        style={styles.compactThumb}
                        loading="lazy"
                      />
                    </div>
                    <div style={styles.compactInfo}>
                      <p
                        className="compact-card-title"
                        title={v.title}
                        style={styles.compactTitle}
                      >
                        {v.title}
                      </p>
                      <p style={styles.compactChannel}>{v.channel}</p>
                      <p style={styles.compactMeta}>
                        {formatViewsCompact(v.view_count)} views&nbsp;•&nbsp;{formatDate(v.upload_date)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {sidebarTab === 'notes' && (
          <div style={styles.notesPanel}>
            <form onSubmit={handleAddNote} style={styles.noteForm}>
              <textarea
                className="note-textarea"
                placeholder="Type a study note here..."
                value={noteContent}
                onChange={e => setNoteContent(e.target.value)}
                style={styles.noteInput}
                rows={3}
                required
              />
              <button type="submit" className="note-submit-btn" style={styles.noteSubmitBtn}>
                Add Note
              </button>
            </form>

            <div style={styles.notesList}>
              {notes.length === 0 ? (
                <div style={styles.emptyNotes}>
                  No notes taken yet. Write a note to bookmark key moments!
                </div>
              ) : (
                notes.map(note => (
                  <div key={note.id} style={styles.noteComment}>
                    <div style={styles.commentAvatar}>L</div>
                    <div style={styles.commentBody}>
                      <div style={styles.commentHeader}>
                        <span style={styles.commentAuthor}>LocalPlay User</span>
                        <button
                          onClick={() => playerRef.current?.seekTo(note.timestamp)}
                          className="note-timestamp-btn"
                          style={styles.noteTimestampBtn}
                          title={`Jump to ${fmtTimestamp(note.timestamp)}`}
                        >
                          {fmtTimestamp(note.timestamp)}
                        </button>
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="note-delete-btn"
                          style={styles.noteDeleteBtn}
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          ✕
                        </button>
                      </div>
                      <div style={styles.commentText}>{note.content}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {sidebarTab === 'vocab' && (
          <div style={styles.vocabPanel}>
            {vocabLoading ? (
              <div style={styles.emptyNotes}>Analyzing subtitles for rare words…</div>
            ) : vocabulary.length === 0 ? (
              <div style={{ padding: '20px 16px', color: 'var(--yt-text-secondary)' }}>
                <div style={{ fontStyle: 'italic', textAlign: 'center', marginBottom: 16, fontSize: 13 }}>
                  No rare vocabulary words found in subtitles. Ensure subtitles are downloaded and active.
                </div>
                <div style={{
                  backgroundColor: 'rgba(99, 102, 241, 0.08)',
                  border: '1px solid rgba(99, 102, 241, 0.2)',
                  borderRadius: 8,
                  padding: 14,
                  fontSize: 12,
                  lineHeight: '1.5'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--accent-color, #6366f1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    💬 Browser Live Captions Tip
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    If this video doesn't have subtitles, your browser can generate captions in real-time for you:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    <li style={{ marginBottom: 4 }}>
                      <strong>Chrome:</strong> Go to Settings &rarr; Accessibility &rarr; Turn on <strong>Live Caption</strong>.
                    </li>
                    <li style={{ marginBottom: 4 }}>
                      <strong>Firefox:</strong> Open Settings &rarr; General &rarr; Translation/Captions (or use an extension).
                    </li>
                    <li style={{ marginBottom: 0 }}>
                      <strong>Edge:</strong> Go to Settings &rarr; Accessibility &rarr; Captions &rarr; Enable <strong>Live Captions</strong>.
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div style={styles.vocabList}>
                {vocabulary.map(w => (
                  <div key={w.word_id} style={styles.vocabCard}>
                    <div style={styles.vocabCardHeader}>
                      <div>
                        <span style={styles.vocabWord}>{w.word}</span>
                        {w.phonetic && <span style={styles.vocabPhonetic}> /{w.phonetic}/</span>}
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => playerRef.current?.seekTo(w.timestamp)}
                          className="note-timestamp-btn"
                          style={styles.noteTimestampBtn}
                          title={`Jump to scene: ${fmtTimestamp(w.timestamp)}`}
                        >
                          🎬 {fmtTimestamp(w.timestamp)}
                        </button>
                        <button
                          onClick={() => handleToggleBookmark(w)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: w.is_bookmarked ? '#f59e0b' : 'var(--yt-text-secondary)',
                            fontSize: 18,
                            padding: '2px 4px',
                            transition: 'color 0.15s, transform 0.15s'
                          }}
                          title={w.is_bookmarked ? 'Remove from Study Board' : 'Save to Study Board'}
                        >
                          ★
                        </button>
                      </div>
                    </div>
                    <div style={styles.vocabDef}>{w.definition}</div>
                    {w.example_sentence && (
                      <div style={styles.vocabExample}>
                        <strong>Example:</strong> "{w.example_sentence}"
                      </div>
                    )}
                    {w.context_sentence && (
                      <div style={styles.vocabContext}>
                        <strong>Context:</strong> "...{w.context_sentence}..."
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

const styles = {
  page: {
    display: 'flex',
    gap: '24px',
    padding: '24px 24px 48px',
    maxWidth: '1750px',
    margin: '0 auto',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  main: {
    flex: '1 1 720px',
    minWidth: 0,
    maxWidth: '1280px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  playerWrap: {
    width: '100%',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
    lineHeight: '28px',
    color: 'var(--yt-text-primary)',
    marginTop: 4,
  },
  belowTitle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px',
  },
  channelRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
  },
  avatar: {
    width: 40,
    height: 40,
    fontSize: 16,
  },
  channelMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    marginRight: 8,
  },
  channelName: {
    fontSize: '16px',
    fontWeight: '500',
    color: 'var(--yt-text-primary)',
  },
  subCount: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
  },
  descMeta: {
    fontSize: '14px',
    fontWeight: '500',
    color: 'var(--yt-text-primary)',
    marginBottom: '8px',
  },
  descViews: {
    fontWeight: '600',
  },
  descText: {
    whiteSpace: 'pre-wrap',
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    fontSize: '14px',
    lineHeight: '20px',
    color: 'var(--yt-text-primary)',
  },
  showMore: {
    display: 'inline-block',
    marginTop: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--yt-text-primary)',
  },
  sidebar: {
    width: '402px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  upNextHeading: {
    fontSize: '16px',
    fontWeight: '500',
    marginBottom: '4px',
    color: 'var(--yt-text-primary)',
  },
  upNextList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  compactThumbWrap: {
    width: '168px',
    aspectRatio: '16/9',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#272727',
    flexShrink: 0,
  },
  compactThumb: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  compactInfo: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  compactTitle: {
    fontSize: '14px',
    fontWeight: '500',
    lineHeight: '18px',
    color: 'var(--yt-text-primary)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    margin: 0,
    transition: 'color 0.1s',
  },
  compactChannel: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    margin: 0,
  },
  compactMeta: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    margin: 0,
  },
  message: {
    padding: '80px 40px',
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '16px',
  },
  chaptersBox: {
    backgroundColor: '#272727',
    borderRadius: 12,
    overflow: 'hidden',
  },
  chaptersToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-primary)',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  chaptersList: {
    borderTop: '1px solid var(--yt-border)',
    maxHeight: 300,
    overflowY: 'auto',
  },
  chapterItem: {
    display: 'flex',
    gap: 12,
    padding: '10px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    alignItems: 'baseline',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  chapterTs: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--yt-blue)',
    flexShrink: 0,
    minWidth: 44,
  },
  chapterTitle: {
    fontSize: 13,
    color: 'var(--yt-text-primary)',
    flex: 1,
  },
  tabHeader: {
    display: 'flex',
    borderBottom: '1px solid var(--yt-border)',
    marginBottom: '12px',
    gap: '16px',
  },
  tabButton: {
    padding: '8px 12px 10px',
    fontSize: '14px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    fontFamily: 'inherit',
    transition: 'color 0.15s, border-bottom-color 0.15s',
    outline: 'none',
  },
  notesPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  noteForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    backgroundColor: 'var(--yt-surface)',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid var(--yt-border)',
  },
  noteInput: {
    width: '100%',
    backgroundColor: '#121212',
    border: '1px solid var(--yt-border)',
    borderRadius: '6px',
    padding: '8px 12px',
    color: 'var(--yt-text-primary)',
    fontSize: '13px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
  },
  noteSubmitBtn: {
    backgroundColor: 'var(--accent-color, #6366f1)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s, opacity 0.15s',
    alignSelf: 'flex-end',
  },
  notesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '400px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  emptyNotes: {
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: '13px',
    padding: '32px 16px',
    fontStyle: 'italic',
  },
  noteComment: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start',
    padding: '12px 0',
    borderBottom: '1px solid var(--yt-border)',
    position: 'relative',
  },
  commentAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'var(--accent-color, #6366f1)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '13px',
    flexShrink: 0,
  },
  commentBody: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    width: '100%',
  },
  commentAuthor: {
    fontWeight: '700',
    fontSize: '13px',
    color: 'var(--yt-text-primary)',
  },
  commentText: {
    fontSize: '13px',
    lineHeight: '1.4',
    color: 'var(--yt-text-primary)',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  noteTimestampBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: 'var(--accent-color, #6366f1)',
    border: '1px solid rgba(99, 102, 241, 0.25)',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'SF Mono, Courier, monospace',
    flexShrink: 0,
    transition: 'background-color 0.15s',
  },
  noteDeleteBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--yt-text-secondary)',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 6px',
    transition: 'color 0.15s',
    opacity: 0.7,
  },
  analyticsBox: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: '12px',
    padding: '16px 20px',
    marginTop: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  analyticsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--yt-border)',
    paddingBottom: '8px',
  },
  chapterBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    color: 'var(--accent-color, #6366f1)',
    borderRadius: '20px',
    padding: '6px 14px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
  },
  analyticsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
  },
  analyticsItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1 1 200px',
  },
  analyticsLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--yt-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  analyticsVal: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--yt-text-primary)',
  },
  analyticsSub: {
    fontSize: '11px',
    color: 'var(--yt-text-secondary)',
    lineHeight: '14px',
  },
  vocabPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  vocabList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '500px',
    overflowY: 'auto',
    paddingRight: '4px',
  },
  vocabCard: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  vocabCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vocabWord: {
    fontWeight: '700',
    fontSize: '14px',
    color: 'var(--yt-text-primary)',
    textTransform: 'capitalize',
  },
  vocabPhonetic: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    fontStyle: 'italic',
  },
  vocabDef: {
    fontSize: '13px',
    color: 'var(--yt-text-primary)',
    lineHeight: '1.4',
  },
  vocabExample: {
    fontSize: '12px',
    color: 'var(--yt-text-secondary)',
    fontStyle: 'italic',
  },
  vocabContext: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(0,0,0,0.2)',
    padding: '6px 8px',
    borderRadius: '4px',
    fontStyle: 'italic',
    lineHeight: '1.4',
    marginTop: '2px',
  },
};

