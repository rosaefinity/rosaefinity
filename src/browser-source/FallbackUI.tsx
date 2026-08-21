// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Fallback UI Components
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import React from 'react';
import type { ConnectionStatus } from './BrowserSourceContext';

// ─── Shared Styles ───

const baseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100vw',
  height: '100vh',
  background: 'transparent',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  padding: '20px',
  textAlign: 'center',
  pointerEvents: 'none',
  userSelect: 'none',
};

// ─── Loading State ───

export function LoadingUI(): React.ReactElement {
  return (
    <div style={baseStyle}>
      <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', letterSpacing: '0.05em' }}>
        🌹 Loading overlay...
      </div>
    </div>
  );
}

// ─── Error State ───

interface ErrorUIProps {
  message: string;
}

export function ErrorUI({ message }: ErrorUIProps): React.ReactElement {
  return (
    <div style={baseStyle}>
      <div
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '16px 24px',
          maxWidth: '400px',
        }}
      >
        <div style={{ color: '#ef4444', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Overlay Error
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', lineHeight: 1.5 }}>
          {message}
        </div>
      </div>
    </div>
  );
}

// ─── Missing Overlay ───

interface MissingOverlayUIProps {
  overlayId: string | null;
}

export function MissingOverlayUI({ overlayId }: MissingOverlayUIProps): React.ReactElement {
  return (
    <div style={baseStyle}>
      <div
        style={{
          background: 'rgba(251, 191, 36, 0.15)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '8px',
          padding: '16px 24px',
          maxWidth: '400px',
        }}
      >
        <div style={{ color: '#fbbf24', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Overlay Not Found
        </div>
        <div style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '12px', lineHeight: 1.5 }}>
          {overlayId
            ? `No overlay registered with id "${overlayId}". Check the URL parameter.`
            : 'No overlay ID provided. Add ?overlay=<id> to the URL.'}
        </div>
      </div>
    </div>
  );
}

// ─── Connection Status ───

interface ConnectionStatusUIProps {
  status: ConnectionStatus;
  reconnectCount: number;
  onReconnect?: () => void;
}

export function ConnectionStatusUI({
  status,
  reconnectCount,
  onReconnect,
}: ConnectionStatusUIProps): React.ReactElement | null {
  // Only show when not connected
  if (status === 'connected') return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '8px',
        right: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'rgba(0, 0, 0, 0.7)',
        borderRadius: '6px',
        padding: '6px 12px',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        fontSize: '11px',
        color: 'rgba(255, 255, 255, 0.8)',
        zIndex: 99999,
        pointerEvents: 'auto',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background:
            status === 'reconnecting' ? '#fbbf24' :
            status === 'disconnected' ? '#ef4444' :
            '#6b7280',
        }}
      />
      <span>
        {status === 'connecting' && 'Connecting...'}
        {status === 'reconnecting' && `Reconnecting (${reconnectCount})...`}
        {status === 'disconnected' && 'Disconnected'}
      </span>
      {status === 'disconnected' && onReconnect && (
        <button
          onClick={onReconnect}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            borderRadius: '4px',
            padding: '2px 8px',
            color: '#fff',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ─── Status Dot (minimal) ───

interface StatusDotProps {
  connected: boolean;
}

export function StatusDot({ connected }: StatusDotProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        top: '8px',
        right: '8px',
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        background: connected ? '#22c55e' : '#ef4444',
        transition: 'background 0.3s',
        zIndex: 99999,
      }}
      title={connected ? 'Connected' : 'Disconnected'}
    />
  );
}
