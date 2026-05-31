import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MenuIcon, SearchIcon, MicIcon, DownloadIcon, LocalPlayLogo, DashboardIcon, FavouriteIcon, SettingsIcon, BookIcon } from './Icons';


/* ── Web Speech API setup ──────────────────────────────────────────────── */
const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

export default function TopBar({ onToggleSidebar, onOpenDownload }) {
  const [query,        setQuery]        = useState('');
  const [searchFocused,setSearchFocused]= useState(false);
  const [micState,     setMicState]     = useState('idle'); // 'idle' | 'listening' | 'unsupported'
  const navigate   = useNavigate();
  const inputRef   = useRef(null);
  const recogRef   = useRef(null);

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
    };
    if (profileMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [profileMenuOpen]);

  /* ── Mic: initialize on mount ── */
  useEffect(() => {
    if (!SpeechRecognition) {
      setMicState('unsupported');
      return;
    }
    const recog = new SpeechRecognition();
    recog.continuous      = false;
    recog.interimResults  = true;
    recog.lang            = 'en-US';

    recog.onstart  = () => setMicState('listening');
    recog.onend    = () => setMicState('idle');
    recog.onerror  = () => setMicState('idle');

    recog.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join('');
      setQuery(transcript);
      // If final result → auto-search
      if (e.results[e.results.length - 1].isFinal) {
        setTimeout(() => {
          if (transcript.trim()) {
            navigate(`/search?q=${encodeURIComponent(transcript.trim())}`);
          }
        }, 300);
      }
    };

    recogRef.current = recog;
    return () => { recog.abort(); };
  }, [navigate]);

  const toggleMic = useCallback(() => {
    if (!recogRef.current) return;
    if (micState === 'listening') {
      recogRef.current.stop();
    } else {
      setQuery('');
      inputRef.current?.focus();
      recogRef.current.start();
    }
  }, [micState]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      inputRef.current?.blur();
    }
  };

  /* mic button appearance */
  const micActive = micState === 'listening';
  const micTitle  = micState === 'unsupported'
    ? 'Voice search not supported in this browser'
    : micActive ? 'Click to stop' : 'Search with your voice';

  return (
    <header style={styles.header}>
      {/* Left: hamburger + logo */}
      <div style={styles.left}>
        <button className="icon-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
          <MenuIcon />
        </button>
        <div style={styles.logo} onClick={() => navigate('/')} role="link" aria-label="LocalPlay Home">
          <LocalPlayLogo style={{ color: '#6366f1', width: 28, height: 28 }} />
          <span style={styles.logoText}>LocalPlay</span>
        </div>
      </div>

      {/* Center: search bar */}
      <div style={styles.center}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <div style={{
            ...styles.searchInputBox,
            borderColor: micActive
              ? '#ef4444'
              : searchFocused ? '#1c62b9' : 'var(--yt-border)',
            boxShadow: searchFocused ? 'inset 0 1px 2px rgba(0,0,0,0.3)' : 'none',
          }}>
            {(searchFocused || micActive) && (
              <SearchIcon style={{ color: 'var(--yt-text-secondary)', flexShrink: 0, marginLeft: 4 }} />
            )}
            <input
              ref={inputRef}
              type="search"
              placeholder={micActive ? '🎙 Listening…' : 'Search'}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                ...styles.searchInput,
                color: micActive ? '#ef4444' : 'var(--yt-text-primary)',
              }}
              autoComplete="off"
              id="topbar-search"
            />
          </div>
          <button
            type="submit"
            style={styles.searchButton}
            title="Search"
            aria-label="Search"
          >
            <SearchIcon />
          </button>
        </form>

        {/* Mic button */}
        <button
          className="icon-btn"
          title={micTitle}
          aria-label={micTitle}
          aria-pressed={micActive}
          onClick={toggleMic}
          disabled={micState === 'unsupported'}
          style={{
            ...styles.micBtn,
            color: micActive ? '#ef4444' : 'var(--yt-text-secondary)',
            backgroundColor: micActive ? 'rgba(239,68,68,0.12)' : 'transparent',
          }}
        >
          {micActive ? <MicActiveIcon /> : <MicIcon />}
          {/* Pulse ring when listening */}
          {micActive && <span style={styles.micPulse} />}
        </button>
      </div>

      {/* Right: download + avatar */}
      <div style={styles.right}>
        <button
          onClick={onOpenDownload}
          className="btn-pill"
          title="Download Media"
          id="topbar-download-btn"
        >
          <DownloadIcon width={20} height={20} />
          <span>Download</span>
        </button>
        
        {/* Profile Dropdown Menu */}
        <div style={{ position: 'relative' }} ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen(prev => !prev)}
            className="avatar"
            style={{
              width: 32,
              height: 32,
              fontSize: 13,
              cursor: 'pointer',
              border: '2px solid transparent',
              outline: 'none',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-color, #6366f1)',
              color: 'white',
              fontWeight: '700',
              boxSizing: 'border-box',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
            aria-label="User profile"
            aria-haspopup="true"
            aria-expanded={profileMenuOpen}
          >
            L
          </button>
          
          {profileMenuOpen && (
            <div style={styles.dropdownMenu}>
              <div style={styles.dropdownHeader}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent-color, #6366f1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 14,
                  color: 'white',
                  flexShrink: 0
                }}>
                  L
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: 13, color: 'var(--yt-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>LocalPlay User</div>
                  <div style={{ fontSize: 11, color: 'var(--yt-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>study@localplay.hub</div>
                </div>
              </div>
              
              <div style={styles.dropdownDivider} />
              
              <button className="dropdown-item" style={styles.dropdownItem} onClick={() => { setProfileMenuOpen(false); navigate('/dashboard'); }}>
                <DashboardIcon width={16} height={16} style={{ color: 'var(--yt-text-secondary)' }} />
                <span>Dashboard</span>
              </button>
              <button className="dropdown-item" style={styles.dropdownItem} onClick={() => { setProfileMenuOpen(false); navigate('/favourites'); }}>
                <FavouriteIcon width={16} height={16} style={{ color: 'var(--yt-text-secondary)' }} />
                <span>Favourites</span>
              </button>
              <button className="dropdown-item" style={styles.dropdownItem} onClick={() => { setProfileMenuOpen(false); navigate('/vocabulary'); }}>
                <BookIcon width={16} height={16} style={{ color: 'var(--yt-text-secondary)' }} />
                <span>Vocabulary</span>
              </button>
              <button className="dropdown-item" style={styles.dropdownItem} onClick={() => { setProfileMenuOpen(false); navigate('/settings'); }}>
                <SettingsIcon width={16} height={16} style={{ color: 'var(--yt-text-secondary)' }} />
                <span>Settings</span>
              </button>

            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/* ── Animated mic icon when active ─────────────────────────────────────── */
const MicActiveIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"/>
  </svg>
);

/* ── Styles ──────────────────────────────────────────────────────────────── */
const styles = {
  header: {
    position: 'fixed', top: 0, left: 0, right: 0,
    height: 'var(--topbar-height)',
    backgroundColor: 'var(--yt-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 16px',
    zIndex: 1000,
  },
  left: { display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 },
  logo: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', userSelect: 'none' },
  logoIcon: {
    backgroundColor: 'var(--yt-red)',
    width: '28px', height: '20px', borderRadius: '6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: '18px', fontWeight: '700', letterSpacing: '-0.5px', color: 'var(--yt-text-primary)' },
  center: { display: 'flex', alignItems: 'center', gap: '8px', flex: '0 1 640px', minWidth: 0 },
  searchForm: { display: 'flex', flex: 1, height: '40px' },
  searchInputBox: {
    flex: 1, backgroundColor: '#121212', border: '1px solid',
    borderRadius: '40px 0 0 40px', padding: '0 12px',
    display: 'flex', alignItems: 'center', gap: '8px',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  searchInput: {
    flex: 1, background: 'transparent', border: 'none',
    fontSize: '16px', outline: 'none', minWidth: 0,
    transition: 'color 0.15s',
  },
  searchButton: {
    width: '64px', flexShrink: 0, backgroundColor: '#222',
    border: '1px solid var(--yt-border)', borderLeft: 'none',
    borderRadius: '0 40px 40px 0', color: 'var(--yt-text-primary)',
    cursor: 'pointer',
  },
  micBtn: {
    position: 'relative',
    width: 40, height: 40, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'background-color 0.2s, color 0.2s',
    flexShrink: 0,
  },
  micPulse: {
    position: 'absolute',
    inset: -3,
    borderRadius: '50%',
    border: '2px solid #ef4444',
    animation: 'micPulse 1.2s ease-out infinite',
    pointerEvents: 'none',
  },
  right: { display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  dropdownMenu: {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    width: '180px',
    backgroundColor: '#0f0f15',
    border: '1px solid #222230',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
    padding: '6px 0',
    zIndex: 1010,
    display: 'flex',
    flexDirection: 'column',
  },
  dropdownHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 14px',
    gap: '10px',
  },
  dropdownDivider: {
    height: '1px',
    backgroundColor: '#222230',
    margin: '6px 0',
  },
  dropdownItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '8px 14px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--yt-text-primary)',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    width: '100%',
    fontFamily: 'inherit',
    transition: 'background-color 0.15s',
    gap: '10px',
  },
};
