import { useState, useEffect } from 'react';
import { client } from '../api/client';

export default function SettingsPage() {
  const [quality, setQuality] = useState('best');
  const [cookies, setCookies] = useState('');
  const [amoled, setAmoled] = useState(() => {
    return localStorage.getItem('localplay_amoled') === 'true';
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Apply theme initial load
  useEffect(() => {
    if (amoled) {
      document.body.classList.add('amoled-theme');
    } else {
      document.body.classList.remove('amoled-theme');
    }
  }, [amoled]);

  const handleToggleAmoled = () => {
    setAmoled(prev => {
      const next = !prev;
      localStorage.setItem('localplay_amoled', String(next));
      return next;
    });
  };

  useEffect(() => {
    client.getSettings()
      .then(data => {
        setQuality(data.default_quality || 'best');
        setCookies(data.cookie_content || '');
      })
      .catch(err => {
        console.error('Failed to load settings', err);
        setError('Could not load settings from server.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      // Save backend settings
      await client.updateSettings({
        default_quality: quality,
        cookie_content: cookies
      });

      // Save theme setting locally
      localStorage.setItem('localplay_amoled', String(amoled));
      if (amoled) {
        document.body.classList.add('amoled-theme');
      } else {
        document.body.classList.remove('amoled-theme');
      }

      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleClearCookies = () => {
    setCookies('');
  };

  if (loading) {
    return <div style={S.loading}>Loading settings…</div>;
  }

  return (
    <div style={S.container}>
      <h1 style={S.title}>Settings</h1>
      
      <form onSubmit={handleSave} style={S.form}>
        
        {/* --- Download Quality Section --- */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>Preferences</h2>
          <div style={S.row}>
            <div style={S.infoCol}>
              <label style={S.label} htmlFor="default-quality">Default Download Quality</label>
              <div style={S.desc}>Pre-selected quality option when fetching new downloads.</div>
            </div>
            <div style={S.selectWrap}>
              <select
                id="default-quality"
                value={quality}
                onChange={e => setQuality(e.target.value)}
                style={S.select}
              >
                <option value="best">Best Available (1080p max)</option>
                <option value="1080p">1080p Full HD</option>
                <option value="720p">720p HD</option>
                <option value="480p">480p SD</option>
                <option value="360p">360p Low</option>
              </select>
              <span style={S.selectArrow}>▾</span>
            </div>
          </div>

          <div style={S.divider} />

          {/* --- Theme Toggle --- */}
          <div style={S.row}>
            <div style={S.infoCol}>
              <label style={S.label} htmlFor="amoled-toggle">AMOLED Black Theme</label>
              <div style={S.desc}>Use pure black background instead of default dark gray.</div>
            </div>
            <div style={S.toggleRow}>
              <button
                id="amoled-toggle"
                type="button"
                onClick={handleToggleAmoled}
                style={{
                  ...S.toggle,
                  background: amoled ? 'linear-gradient(135deg, #ff0055 0%, #ff5500 100%)' : 'rgba(255, 255, 255, 0.1)',
                  boxShadow: amoled ? '0 0 8px rgba(255, 0, 85, 0.3)' : 'none',
                }}
                aria-pressed={amoled}
              >
                <span style={{
                  ...S.thumb,
                  left: amoled ? 23 : 3,
                  backgroundColor: '#ffffff'
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* --- Cookies Section --- */}
        <div style={S.section}>
          <h2 style={S.sectionTitle}>YouTube Authentication (Cookies)</h2>
          <p style={S.descBlock}>
            Pasting Netscape format cookies allows <strong>yt-dlp</strong> to authenticate and bypass restrictions for:
            <br />• Age-restricted/restricted content.
            <br />• Private videos & playlist downloads you own.
            <br />
            To export cookies, use browser extensions like <em>"Get cookies.txt LOCALLY"</em> or <em>"EditThisCookie"</em>.
          </p>
          
          <div style={S.textareaWrap}>
            <textarea
              placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	1893456000	SID	..."
              value={cookies}
              onChange={e => setCookies(e.target.value)}
              style={S.textarea}
              aria-label="YouTube Cookies content"
            />
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button
              type="button"
              onClick={handleClearCookies}
              style={S.secondaryBtn}
            >
              Clear Cookies Text
            </button>
          </div>
        </div>

        {/* --- Feedback Messages --- */}
        {message && <div style={S.success}>{message}</div>}
        {error && <div style={S.errorMsg}>{error}</div>}

        {/* --- Submit Actions --- */}
        <div style={S.footer}>
          <button
            type="submit"
            disabled={saving}
            style={{ ...S.saveBtn, opacity: saving ? 0.7 : 1 }}
          >
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>

      </form>
    </div>
  );
}

const S = {
  container: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '32px 24px 64px',
    animation: 'fadeIn 0.2s ease-in-out',
  },
  loading: {
    padding: 80,
    textAlign: 'center',
    color: 'var(--yt-text-secondary)',
    fontSize: 16
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    marginBottom: 28
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 24
  },
  section: {
    backgroundColor: 'var(--yt-surface)',
    border: '1px solid var(--yt-border)',
    borderRadius: 16,
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--yt-text-primary)',
    marginBottom: 8
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20
  },
  infoCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1
  },
  label: {
    fontSize: 15,
    fontWeight: 500,
    color: 'var(--yt-text-primary)'
  },
  desc: {
    fontSize: 12,
    color: 'var(--yt-text-secondary)'
  },
  descBlock: {
    fontSize: 13,
    color: 'var(--yt-text-secondary)',
    lineHeight: '20px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.04)',
    margin: 0
  },
  divider: {
    height: 1,
    backgroundColor: 'var(--yt-border)',
    margin: '8px 0'
  },
  selectWrap: {
    position: 'relative',
    width: 220
  },
  select: {
    width: '100%',
    padding: '10px 36px 10px 14px',
    backgroundColor: 'var(--yt-surface-hover)',
    border: '1px solid var(--yt-border)',
    borderRadius: 10,
    color: 'var(--yt-text-primary)',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    appearance: 'none',
    WebkitAppearance: 'none'
  },
  selectArrow: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--yt-text-secondary)',
    pointerEvents: 'none',
    fontSize: 12
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  toggle: {
    position: 'relative',
    width: 44,
    height: 24,
    borderRadius: 12,
    cursor: 'pointer',
    border: 'none',
    transition: 'background-color 0.2s',
    padding: 0,
    flexShrink: 0
  },
  thumb: {
    position: 'absolute',
    top: 3,
    width: 18,
    height: 18,
    borderRadius: '50%',
    transition: 'left 0.2s'
  },
  textareaWrap: {
    width: '100%'
  },
  textarea: {
    width: '100%',
    height: 180,
    backgroundColor: '#0a0a0a',
    border: '1px solid var(--yt-border)',
    borderRadius: 12,
    color: '#00ff66',
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 14,
    outline: 'none',
    resize: 'vertical',
    lineHeight: '18px'
  },
  secondaryBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--yt-border)',
    color: 'var(--yt-text-primary)',
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    '&:hover': {
      backgroundColor: 'rgba(255,255,255,0.1)'
    }
  },
  saveBtn: {
    backgroundColor: 'var(--yt-blue)',
    color: '#0f0f0f',
    padding: '12px 24px',
    borderRadius: 24,
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    border: 'none',
    transition: 'transform 0.15s, background-color 0.15s',
    boxShadow: '0 4px 14px rgba(62,166,255,0.2)'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 8
  },
  success: {
    color: '#22c55e',
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '1px solid rgba(34,197,94,0.2)',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500
  },
  errorMsg: {
    color: '#ef4444',
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.2)',
    padding: '10px 16px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500
  }
};
