/**
 * ConfirmDialog — global context-based modal
 *
 * Setup:  wrap your app in <ConfirmProvider>
 * Usage:  const { confirm } = useConfirm();
 *         const ok = await confirm({ title, message, confirmLabel, danger });
 */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const Ctx = createContext(null);

/* ── Provider (mount once in App) ─────────────────────────────────────── */
export function ConfirmProvider({ children }) {
  const [state,   setState]   = useState(null);   // null = closed
  const [resolve, setResolve] = useState(null);

  const confirm = useCallback(({ title, message, confirmLabel = 'Confirm', danger = false }) =>
    new Promise(res => {
      setState({ title, message, confirmLabel, danger });
      setResolve(() => res);   // store resolver
    }),
  []);

  const close = useCallback((result) => {
    setState(null);
    resolve?.(result);
  }, [resolve]);

  // Close on Escape
  useEffect(() => {
    if (!state) return;
    const handler = (e) => { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [state, close]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {state && (
        <div style={S.backdrop} onClick={() => close(false)} aria-modal="true" role="dialog">
          <div style={S.modal} onClick={e => e.stopPropagation()}>

            {/* Icon ring */}
            <div style={{ ...S.iconRing, borderColor: state.danger ? '#ef444455' : '#3b82f655' }}>
              <span style={{ fontSize: 30 }}>{state.danger ? '🗑' : '❓'}</span>
            </div>

            {/* Text */}
            <h2 style={S.title}>{state.title}</h2>
            {state.message && <p style={S.message}>{state.message}</p>}

            {/* Buttons */}
            <div style={S.buttons}>
              <button style={S.cancelBtn} onClick={() => close(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...S.confirmBtn,
                  backgroundColor: state.danger ? '#ef4444' : '#3b82f6',
                }}
                onClick={() => close(true)}
                autoFocus
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

/* ── Hook ──────────────────────────────────────────────────────────────── */
export function useConfirm() {
  const confirm = useContext(Ctx);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return { confirm };
}

/* ── Styles ────────────────────────────────────────────────────────────── */
const S = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(6px)',
    zIndex: 9000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'fadeIn 0.15s ease',
  },
  modal: {
    backgroundColor: '#1f1f1f',
    border: '1px solid #333',
    borderRadius: 20,
    padding: '36px 32px 28px',
    width: 360,
    maxWidth: 'calc(100vw - 32px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    animation: 'slideUp 0.18s ease',
    boxShadow: '0 24px 64px rgba(0,0,0,0.65)',
  },
  iconRing: {
    width: 68,
    height: 68,
    borderRadius: '50%',
    border: '2px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: 'var(--yt-text-primary)',
    margin: 0,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'var(--yt-text-secondary)',
    margin: '0 0 8px',
    textAlign: 'center',
    lineHeight: 1.6,
  },
  buttons: {
    display: 'flex',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    padding: '11px 0',
    backgroundColor: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 12,
    color: 'var(--yt-text-primary)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  confirmBtn: {
    flex: 1,
    padding: '11px 0',
    border: 'none',
    borderRadius: 12,
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'opacity 0.15s',
  },
};
