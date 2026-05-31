import React, { useState, useEffect, useRef } from 'react';
import { client } from '../api/client';

/* ── Helpers ──────────────────────────────────────────────────────────── */
function fmtDuration(sec) {
  if (!sec) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function statusColor(st) {
  if (st === 'done')        return '#22c55e';
  if (st === 'error')       return '#ef4444';
  if (st === 'downloading') return 'var(--yt-blue)';
  if (st === 'processing')  return '#f59e0b';
  return 'var(--yt-text-secondary)';
}

function statusLabel(st) {
  return { starting:'Starting…', downloading:'Downloading', processing:'Processing…', done:'Complete', error:'Failed' }[st] || st;
}

function fmtTs(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }); } catch { return ''; }
}

/* ── Progress card ────────────────────────────────────────────────────── */
function ProgressCard({ entry }) {
  const pct = parseFloat(entry.percent_str) || 0;
  const active = ['downloading','starting','processing'].includes(entry.status);
  return (
    <div style={S.card}>
      <div style={S.cardRow}>
        <span style={S.cardTitle} title={entry.title || entry.url}>{entry.title || entry.filename || entry.url}</span>
        <span style={{ ...S.badge, color: statusColor(entry.status) }}>{statusLabel(entry.status)}</span>
      </div>
      {entry.channel && <div style={S.cardSub}>{entry.channel}</div>}
      <div style={S.track}><div style={{ ...S.fill, width: entry.status==='done'?'100%':`${pct}%`, backgroundColor: statusColor(entry.status), transition: active?'width 0.5s ease':'none' }} /></div>
      <div style={S.cardMeta}>
        <span>
          {entry.status==='downloading' ? `${entry.percent_str} • ${entry.speed_str} • ETA ${entry.eta_str}` :
           entry.status==='done' ? `✓ ${fmtTs(entry.finished_at)}` :
           entry.status==='error' ? `✗ ${entry.error||'Unknown error'}` : statusLabel(entry.status)}
        </span>
        <span style={S.tag}>{entry.quality}{entry.captions?' · CC':''}</span>
      </div>
    </div>
  );
}

function HistoryCard({ entry }) {
  return (
    <div style={{ ...S.card, opacity:0.88 }}>
      <div style={S.cardRow}>
        <span style={S.cardTitle} title={entry.title||entry.url}>{entry.title||entry.url}</span>
        <span style={{ ...S.badge, color:statusColor(entry.status) }}>{statusLabel(entry.status)}</span>
      </div>
      {entry.channel && <div style={S.cardSub}>{entry.channel}</div>}
      <div style={S.cardMeta}>
        <span style={{ fontSize:12, color:'var(--yt-text-secondary)' }}>{fmtTs(entry.started_at)}{entry.finished_at && ` → ${fmtTs(entry.finished_at)}`}</span>
        <span style={S.tag}>{entry.quality}{entry.captions?' · CC':''}</span>
      </div>
    </div>
  );
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function DownloadDialog({ onClose }) {
  // Tab
  const [tab, setTab] = useState('download');

  // Step 1: URL input
  const [url,        setUrl]        = useState('');
  const [fetching,   setFetching]   = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Step 2: info + options
  const [info,       setInfo]       = useState(null);  // result from /api/download/info
  const [quality,    setQuality]    = useState('best');
  const [captions,   setCaptions]   = useState(false);
  const [defaultQuality, setDefaultQuality] = useState('best');

  // Download
  const [downloading, setDownloading] = useState(false);
  const [dlError,     setDlError]    = useState('');
  const [dlStarted,   setDlStarted]  = useState(false);

  // Live progress + history
  const [progress, setProgress] = useState({});
  const [history,  setHistory]  = useState([]);
  const pollRef = useRef(null);

  useEffect(() => {
    // Fetch default quality setting
    client.getSettings()
      .then(res => {
        if (res && res.default_quality) {
          setDefaultQuality(res.default_quality);
          setQuality(res.default_quality);
        }
      })
      .catch(err => console.warn('Failed to load settings in DownloadDialog', err));

    const poll = async () => {
      try {
        const [p, h] = await Promise.all([client.getDownloadProgress(), client.getDownloadHistory()]);
        setProgress(p);
        setHistory(h);
      } catch {}
    };
    poll();
    pollRef.current = setInterval(poll, 1200);
    return () => clearInterval(pollRef.current);
  }, []);

  /* ── Step 1 → Fetch info ── */
  const handleFetch = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setFetchError('');
    setInfo(null);
    setDlStarted(false);
    setDlError('');
    setFetching(true);
    try {
      const data = await client.getVideoInfo(url.trim());
      setInfo(data);
      
      // Auto-select preferred default quality from settings if available
      const hasDefault = data.qualities?.find(q => q.value === defaultQuality);
      if (hasDefault) {
        setQuality(defaultQuality);
      } else if (data.is_playlist) {
        setQuality(defaultQuality);
      } else {
        setQuality(data.qualities?.[0]?.value || 'best');
      }
      setCaptions(false);
    } catch (err) {
      setFetchError(err?.response?.data?.detail || 'Could not fetch video info. Check the URL.');
    } finally {
      setFetching(false);
    }
  };

  const resetToUrl = () => {
    setInfo(null);
    setFetchError('');
    setDlError('');
    setDlStarted(false);
  };

  /* ── Step 2 → Download ── */
  const handleDownload = async () => {
    if (!info) return;
    setDlError('');
    setDownloading(true);
    try {
      await client.startDownload(url.trim(), quality, captions);
      setDlStarted(true);
      setUrl('');
      setInfo(null);
      setTab('download'); // stay on download tab to see progress
    } catch (err) {
      setDlError(err?.response?.data?.detail || 'Failed to start download.');
    } finally {
      setDownloading(false);
    }
  };

  const activeEntries = Object.values(progress).filter(e => !['done','error'].includes(e.status));

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.dialog} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div style={S.header}>
          <h2 style={S.headerTitle}>
            Download Manager
            {activeEntries.length > 0 && <span style={S.activeBadge}>{activeEntries.length}</span>}
          </h2>
          <button onClick={onClose} style={S.closeBtn} aria-label="Close">✕</button>
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabs}>
          {[['download','⬇ Download'], ['history',`🕓 History (${history.length})`]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ ...S.tab, ...(tab===key ? S.tabActive : {}) }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ Download tab ══ */}
        {tab === 'download' && (
          <div style={S.body}>

            {/* ── Step 1: URL input ── */}
            {!info && (
              <form onSubmit={handleFetch} style={S.urlForm}>
                <p style={S.stepHint}>Paste a YouTube video or playlist URL to see available options.</p>
                <div style={S.urlRow}>
                  <input
                    type="url"
                    placeholder="https://youtube.com/watch?v=…"
                    value={url}
                    onChange={e => { setUrl(e.target.value); setFetchError(''); }}
                    style={S.urlInput}
                    id="download-url-input"
                    autoFocus
                    required
                  />
                  <button
                    type="submit"
                    style={{ ...S.fetchBtn, opacity: fetching ? 0.6 : 1 }}
                    disabled={fetching || !url.trim()}
                  >
                    {fetching ? (
                      <span style={S.spinner}>⟳</span>
                    ) : 'Fetch Info'}
                  </button>
                </div>
                {fetchError && <div style={S.errBox}>{fetchError}</div>}
                {fetching && (
                  <div style={S.fetchingMsg}>
                    <span style={{ ...S.spinner, fontSize: 20, display: 'inline-block' }}>⟳</span>
                    Fetching video info…
                  </div>
                )}
              </form>
            )}

            {/* ── Step 2: Video preview + options ── */}
            {info && (
              <div style={S.infoSection}>
                {/* Back button */}
                <button onClick={resetToUrl} style={S.backBtn}>← Back</button>

                {/* Video preview card */}
                <div style={S.previewCard}>
                  {info.thumbnail && (
                    <img
                      src={info.thumbnail}
                      alt={info.title}
                      style={S.previewThumb}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div style={S.previewInfo}>
                    <div style={S.previewTitle}>{info.title}</div>
                    <div style={S.previewMeta}>
                      {info.channel && <span>{info.channel}</span>}
                      {info.duration && <span> · {fmtDuration(info.duration)}</span>}
                      {info.is_playlist && (
                        <span style={S.playlistTag}> 📋 Playlist · {info.entry_count} videos</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div style={S.optionsGrid}>
                  {/* Quality */}
                  <div style={S.optGroup}>
                    <label style={S.optLabel} htmlFor="quality-select">Quality</label>
                    <div style={S.selectWrap}>
                      <select
                        id="quality-select"
                        value={quality}
                        onChange={e => setQuality(e.target.value)}
                        style={S.select}
                      >
                        {(info.qualities || []).map(q => (
                          <option key={q.value} value={q.value}>{q.label}</option>
                        ))}
                      </select>
                      <span style={S.selectArrow}>▾</span>
                    </div>
                  </div>

                  {/* Captions — only if available */}
                  {info.has_captions && (
                    <div style={S.optGroup}>
                      <label style={S.optLabel} htmlFor="cc-toggle">English Captions</label>
                      <div style={S.toggleRow}>
                        <button
                          id="cc-toggle"
                          type="button"
                          onClick={() => setCaptions(c => !c)}
                          style={{ ...S.toggle, backgroundColor: captions ? 'var(--yt-blue)' : '#333' }}
                          aria-pressed={captions}
                        >
                          <span style={{ ...S.thumb, left: captions ? 22 : 3 }} />
                        </button>
                        <span style={S.toggleHint}>{captions ? 'Will download .en.vtt' : 'Off'}</span>
                      </div>
                    </div>
                  )}

                  {/* No captions notice */}
                  {!info.has_captions && (
                    <div style={S.optGroup}>
                      <label style={S.optLabel}>Captions</label>
                      <span style={{ fontSize: 13, color: 'var(--yt-text-secondary)', paddingTop: 8, display: 'block' }}>
                        Not available for this video
                      </span>
                    </div>
                  )}
                </div>

                {dlError && <div style={S.errBox}>{dlError}</div>}

                <button
                  onClick={handleDownload}
                  style={{ ...S.dlBtn, opacity: downloading ? 0.65 : 1 }}
                  disabled={downloading}
                >
                  {downloading ? 'Starting…' : `⬇  Download${info.is_playlist ? ` (${info.entry_count} videos)` : ''}`}
                </button>
              </div>
            )}

            {/* ── Active downloads ── */}
            {Object.keys(progress).length > 0 && (
              <div style={S.section}>
                <div style={S.sLabel}>Active Downloads</div>
                {Object.entries(progress).map(([id, e]) => <ProgressCard key={id} entry={e} />)}
              </div>
            )}

            {/* Empty state */}
            {!info && Object.keys(progress).length === 0 && (
              <div style={S.empty}>No active downloads.</div>
            )}
          </div>
        )}

        {/* ══ History tab ══ */}
        {tab === 'history' && (
          <div style={S.body}>
            {history.length === 0
              ? <div style={S.empty}>No download history yet.</div>
              : <div style={S.section}>{history.map((e, i) => <HistoryCard key={e.download_id||i} entry={e} />)}</div>
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────────────────── */
const S = {
  overlay: { position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.78)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 },
  dialog:  { backgroundColor:'#1a1a1a', border:'1px solid #333', borderRadius:20, width:560, maxWidth:'96vw', maxHeight:'88vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.7)', overflow:'hidden' },
  header:  { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px 0' },
  headerTitle: { fontSize:18, fontWeight:700, color:'var(--yt-text-primary)', display:'flex', alignItems:'center', gap:8, margin:0 },
  activeBadge: { backgroundColor:'var(--yt-red)', color:'#fff', borderRadius:10, fontSize:11, fontWeight:700, padding:'2px 7px' },
  closeBtn: { width:32, height:32, borderRadius:'50%', color:'var(--yt-text-secondary)', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', background:'transparent', border:'none' },
  tabs:    { display:'flex', gap:4, padding:'16px 24px 0', borderBottom:'1px solid #2a2a2a' },
  tab:     { padding:'8px 16px', borderRadius:'8px 8px 0 0', fontSize:13, fontWeight:500, color:'var(--yt-text-secondary)', cursor:'pointer', background:'none', border:'none', transition:'color 0.15s', marginBottom:-1, fontFamily:'inherit' },
  tabActive: { color:'var(--yt-text-primary)', backgroundColor:'#222', borderBottom:'2px solid var(--yt-blue)' },
  body:    { flex:1, overflowY:'auto', padding:'20px 24px 24px', display:'flex', flexDirection:'column', gap:16 },

  /* Step 1 */
  stepHint: { fontSize:13, color:'var(--yt-text-secondary)', margin:'0 0 12px' },
  urlForm:  { display:'flex', flexDirection:'column', gap:0 },
  urlRow:   { display:'flex', gap:8, alignItems:'stretch' },
  urlInput: { flex:1, padding:'12px 16px', backgroundColor:'#121212', border:'1px solid #333', borderRadius:12, color:'var(--yt-text-primary)', fontSize:14, outline:'none', fontFamily:'inherit' },
  fetchBtn: { padding:'12px 20px', backgroundColor:'var(--yt-blue)', color:'#0f0f0f', border:'none', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', flexShrink:0 },
  fetchingMsg: { display:'flex', alignItems:'center', gap:10, color:'var(--yt-text-secondary)', fontSize:13, marginTop:12 },
  spinner:  { display:'inline-block', animation:'spin 1s linear infinite' },

  /* Step 2 */
  infoSection: { display:'flex', flexDirection:'column', gap:14 },
  backBtn:  { background:'none', border:'none', color:'var(--yt-blue)', fontSize:13, fontWeight:500, cursor:'pointer', padding:0, textAlign:'left', fontFamily:'inherit' },
  previewCard: { display:'flex', gap:12, backgroundColor:'#222', borderRadius:14, overflow:'hidden', border:'1px solid #2e2e2e' },
  previewThumb: { width:140, aspectRatio:'16/9', objectFit:'cover', flexShrink:0, display:'block' },
  previewInfo: { flex:1, padding:'12px 14px 12px 0', display:'flex', flexDirection:'column', justifyContent:'center', gap:6, minWidth:0 },
  previewTitle: { fontSize:14, fontWeight:600, color:'var(--yt-text-primary)', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' },
  previewMeta:  { fontSize:12, color:'var(--yt-text-secondary)' },
  playlistTag:  { color:'var(--yt-blue)', fontWeight:500 },
  optionsGrid:  { display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 },
  optGroup:     { display:'flex', flexDirection:'column', gap:6 },
  optLabel:     { fontSize:11, fontWeight:700, color:'var(--yt-text-secondary)', textTransform:'uppercase', letterSpacing:'0.5px' },
  selectWrap:   { position:'relative' },
  select:       { width:'100%', padding:'10px 36px 10px 12px', backgroundColor:'#222', border:'1px solid #333', borderRadius:10, color:'var(--yt-text-primary)', fontSize:13, outline:'none', cursor:'pointer', fontFamily:'inherit', appearance:'none', WebkitAppearance:'none' },
  selectArrow:  { position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:'var(--yt-text-secondary)', pointerEvents:'none', fontSize:12 },
  toggleRow:    { display:'flex', alignItems:'center', gap:10, paddingTop:4 },
  toggle:       { position:'relative', width:44, height:24, borderRadius:12, cursor:'pointer', border:'none', transition:'background-color 0.2s', padding:0, flexShrink:0 },
  thumb:        { position:'absolute', top:3, width:18, height:18, borderRadius:'50%', backgroundColor:'#fff', transition:'left 0.2s' },
  toggleHint:   { fontSize:12, color:'var(--yt-text-secondary)' },
  errBox:       { color:'#ef4444', fontSize:13, padding:'8px 12px', backgroundColor:'rgba(239,68,68,0.1)', borderRadius:8, border:'1px solid rgba(239,68,68,0.25)', marginTop:4 },
  dlBtn:        { padding:'13px', backgroundColor:'var(--yt-blue)', color:'#0f0f0f', borderRadius:12, fontWeight:700, fontSize:15, cursor:'pointer', border:'none', fontFamily:'inherit', transition:'opacity 0.2s' },

  /* Shared */
  section: { display:'flex', flexDirection:'column', gap:10 },
  sLabel:  { fontSize:11, fontWeight:700, color:'var(--yt-text-secondary)', textTransform:'uppercase', letterSpacing:'0.8px' },
  empty:   { padding:'40px 0', textAlign:'center', color:'var(--yt-text-secondary)', fontSize:14 },
  card:    { backgroundColor:'#222', border:'1px solid #2e2e2e', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:7 },
  cardRow: { display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 },
  cardTitle: { fontSize:13, fontWeight:500, color:'var(--yt-text-primary)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' },
  badge:   { fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 },
  cardSub: { fontSize:12, color:'var(--yt-text-secondary)', marginTop:-4 },
  track:   { height:3, backgroundColor:'#333', borderRadius:2, overflow:'hidden' },
  fill:    { height:'100%', borderRadius:2, minWidth:3 },
  cardMeta: { display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--yt-text-secondary)' },
  tag:     { backgroundColor:'#2a2a2a', color:'#888', padding:'1px 6px', borderRadius:4, fontSize:11, fontWeight:500, flexShrink:0 },
};
