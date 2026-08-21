// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Entry Point
// v3.1 Architecture Spec (Frozen)
//
// This is the React entry point for overlay-widget.html.
// It mounts the BrowserSourceApp into #root.
//
// URL Parameters:
//   ?overlay=<id>       — Module ID to render (required)
//   ?instance=<uuid>    — Instance ID for custom config
//   ?instanceId=<uuid>  — Alias for ?instance
//   ?screen=<id>        — Screen filter
//   ?scene=<id>         — Scene filter
//   ?preview=true       — Enable preview mode
//   ?theme=<dark|light|auto> — Theme override
//   ?debug=true         — Enable debug panel
// ─────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import { BrowserSourceApp } from './BrowserSourceApp';

// Mount the React application
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<BrowserSourceApp />);
} else {
  console.error('[BrowserSource] #root element not found in overlay-widget.html');
}
