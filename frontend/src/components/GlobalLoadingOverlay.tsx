import React from 'react';
import { useLoading } from '../contexts/LoadingContext';

const badgeStyle: React.CSSProperties = {
  position: 'fixed',
  right: 16,
  bottom: 16,
  width: 44,
  height: 44,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.95)',
  boxShadow: '0 6px 18px rgba(0,0,0,0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9999,
  pointerEvents: 'none'
};

export default function GlobalLoadingOverlay() {
  // This component was originally added as a **test indicator** to show which
  // page/window was active and if any global loading was happening.  After
  // stabilization the overlay became noisy and is no longer needed.
  //
  // Keep the component around only for ad-hoc debugging in development,
  // otherwise render nothing.
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  let loading = false;
  try {
    const ctx = useLoading();
    loading = ctx.isLoading;
  } catch (e) {
    loading = false;
  }

  if (!loading) return null;

  return (
    <div style={badgeStyle} aria-hidden>
      <div style={{width: 28, height: 28, borderRadius: 14, border: '4px solid rgba(0,0,0,0.08)', borderTopColor: '#2563eb', animation: 'spin 1s linear infinite', pointerEvents: 'none'}} />
      <style>{'@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}
