// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Debug Panel
// v3.1 Architecture Spec (Frozen)
//
// Only rendered when ?debug=true is in the URL.
// Zero overhead in production.
// ─────────────────────────────────────────────────────

import React from 'react';
import { useBrowserSourceContext } from './BrowserSourceContext';

// ─── Styles ───

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: '8px',
  left: '8px',
  background: 'rgba(0, 0, 0, 0.85)',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '8px',
  padding: '12px 16px',
  fontFamily: "'Segoe UI', system-ui, monospace",
  fontSize: '11px',
  color: '#e2e8f0',
  zIndex: 99999,
  pointerEvents: 'auto',
  userSelect: 'none',
  minWidth: '220px',
  lineHeight: 1.6,
};

const labelStyle: React.CSSProperties = {
  color: 'rgba(255, 255, 255, 0.5)',
  display: 'inline-block',
  width: '100px',
};

const valueStyle: React.CSSProperties = {
  color: '#e2e8f0',
  fontWeight: 600,
};

const dotGreen: React.CSSProperties = {
  display: 'inline-block',
  width: '6px',
  height: '6px',
  borderRadius: '50%',
  background: '#22c55e',
  marginRight: '6px',
};

const dotRed: React.CSSProperties = {
  ...dotGreen,
  background: '#ef4444',
};

const dotYellow: React.CSSProperties = {
  ...dotGreen,
  background: '#fbbf24',
};

const headerStyle: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'rgba(255, 255, 255, 0.4)',
  marginBottom: '8px',
  paddingBottom: '6px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
};

// ─── Component ───

export function DebugPanel(): React.ReactElement {
  const ctx = useBrowserSourceContext();

  const fpsColor = ctx.fps >= 55 ? '#22c55e' : ctx.fps >= 30 ? '#fbbf24' : '#ef4444';
  const latencyColor = ctx.eventLatency < 10 ? '#22c55e' : ctx.eventLatency < 50 ? '#fbbf24' : '#ef4444';

  return (
    <div style={panelStyle}>
      <div style={headerStyle}>🔍 Debug Panel</div>

      {/* Identity */}
      <div>
        <span style={labelStyle}>Overlay</span>
        <span style={valueStyle}>{ctx.overlayId ?? '—'}</span>
      </div>
      <div>
        <span style={labelStyle}>Instance</span>
        <span style={valueStyle}>{ctx.instanceId ? ctx.instanceId.slice(0, 8) + '...' : '—'}</span>
      </div>
      <div>
        <span style={labelStyle}>Screen</span>
        <span style={valueStyle}>{ctx.screenId ?? '—'}</span>
      </div>
      <div>
        <span style={labelStyle}>Theme</span>
        <span style={valueStyle}>{ctx.theme}</span>
      </div>

      {/* Connection */}
      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <span style={labelStyle}>Connected</span>
        <span style={valueStyle}>
          <span style={ctx.connectionStatus === 'connected' ? dotGreen : ctx.connectionStatus === 'reconnecting' ? dotYellow : dotRed} />
          {ctx.connectionStatus}
        </span>
      </div>
      <div>
        <span style={labelStyle}>Reconnects</span>
        <span style={valueStyle}>{ctx.reconnectCount}</span>
      </div>

      {/* Performance */}
      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <span style={labelStyle}>FPS</span>
        <span style={{ ...valueStyle, color: fpsColor }}>{ctx.fps}</span>
      </div>
      <div>
        <span style={labelStyle}>Render</span>
        <span style={valueStyle}>{ctx.renderTime.toFixed(1)}ms</span>
      </div>
      <div>
        <span style={labelStyle}>Event Latency</span>
        <span style={{ ...valueStyle, color: latencyColor }}>{ctx.eventLatency}ms</span>
      </div>
      <div>
        <span style={labelStyle}>Last Event</span>
        <span style={valueStyle}>{ctx.lastEventType || '—'}</span>
      </div>
      <div>
        <span style={labelStyle}>Perf Mode</span>
        <span style={{ ...valueStyle, color: ctx.performanceMode ? '#fbbf24' : '#22c55e' }}>
          {ctx.performanceMode ? 'ON' : 'OFF'}
        </span>
      </div>

      {/* Version */}
      <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
        <span style={labelStyle}>Runtime</span>
        <span style={valueStyle}>v{ctx.runtimeVersion}</span>
      </div>
    </div>
  );
}
