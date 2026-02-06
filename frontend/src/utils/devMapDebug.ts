export function initMapDebug(): (() => void) | undefined {
  try {
    if (process.env.NODE_ENV !== 'development') return;

    const btn = document.createElement('button');
    btn.id = 'map-debug-toggle';
    btn.textContent = 'Map Debug';
    Object.assign(btn.style, {
      position: 'fixed',
      top: '12px',
      right: '12px',
      zIndex: '999999',
      padding: '6px 10px',
      background: '#1d4ed8',
      color: 'white',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 6px 18px rgba(0,0,0,0.2)'
    });

    function toggle() {
      const on = document.body.classList.toggle('map-debug-mode');
      btn.textContent = on ? 'Map Debug (ON)' : 'Map Debug';
    }

    btn.title = 'Toggle map debug mode: disables overlays and brings map to front (Shift+M)';
    btn.addEventListener('click', toggle);
    document.body.appendChild(btn);

    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey && (e.key === 'M' || e.key === 'm')) {
        toggle();
      }
    };
    window.addEventListener('keydown', handler);

    return () => {
      btn.removeEventListener('click', toggle);
      window.removeEventListener('keydown', handler);
      if (document.body.contains(btn)) document.body.removeChild(btn);
      document.body.classList.remove('map-debug-mode');
    };
  } catch (err) {
    // best-effort, don't break app
    console.warn('[devMapDebug] init failed', err);
    return;
  }
}
