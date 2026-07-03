# RosaeFinity

TikTok LIVE streaming companion desktop app — connect to live streams, trigger automated actions, and engage viewers with real-time interactivity.

## Features

- **TikTok LIVE Integration** — Multi-screen support (up to 8 simultaneous connections), real-time gifts, likes, follows, comments, and chat command handling
- **Action System** — Create custom actions with sounds, videos, images, keystrokes, and Minecraft commands
- **Event-to-Action Mapping** — Link TikTok events to actions with configurable triggers (gift type, minimum coins, keywords, roles)
- **Points & Levels** — Viewer engagement points with exponential leveling and subscriber multipliers
- **Overlay** — Browser source overlay for OBS/TikTok Live Studio with animated alert cards
- **External Integrations** — OBS WebSocket, Streamer.bot, Minecraft ServerTap, Spotify song requests
- **License System** — Free tier (5 actions, 3 custom sounds) and Pro tier with unlimited features

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite 8, TailwindCSS 4, Zustand, Dexie (IndexedDB), Framer Motion
- **Backend:** Electron 42, Node.js IPC, WebSocket
- **Key Libraries:** tiktok-live-connector, @nut-tree-fork/nut-js (keystroke simulation), Radix UI

## Getting Started

```bash
# Install dependencies
npm install

# Run in development (browser-only mode)
npm run dev

# Build for Electron
npm run build

# Run Electron app
npm run electron:dev
```

## Project Structure

```
├── electron/           # Electron main process & backend
│   ├── main.cjs        # Main process, IPC handlers, TikTok connections
│   ├── preload.cjs     # Context bridge (window.electronAPI)
│   └── backend/        # Integration modules (OBS, Spotify, etc.)
├── src/                # React frontend
│   ├── components/     # UI components (sidebar, header, auth, etc.)
│   ├── pages/          # Route pages (Dashboard, Actions, Alerts, etc.)
│   ├── store/          # Zustand stores (app state, auth, favorites)
│   ├── services/       # API and Electron service layer
│   ├── types/          # TypeScript type definitions
│   └── lib/            # Utilities, IndexedDB, overlay event bus
├── public/             # Static assets and overlay widget
└── package.json
```

## License

Proprietary — see [LICENSE](LICENSE) for details.
