# LinkPad Offline/LAN Architecture

This document describes how to evolve LinkPad from an internet-hosted Render app into a local-network-first collaboration system with optional remote access.

## Target Modes

1. LAN mode: devices are on the same WiFi/router/hotspot and do not need internet.
2. Remote mode: far-away users connect through a public server, tunnel, VPN, or WebRTC relay path.
3. Hybrid mode: the app prefers LAN when available and falls back to the internet when needed.

## Current Baseline

The current app already has a useful local foundation:

- Express serves the React build from `client/dist`.
- Socket.IO runs on the same Node server.
- Server listens on `0.0.0.0`, so other LAN devices can open `http://HOST_IPV4:4000`.
- Rooms and notes are in memory for the MVP.

Run locally:

```bash
npm run build
npm start
```

Host opens:

```text
http://localhost:4000
```

Other LAN devices open:

```text
http://HOST_IPV4:4000
```

Example:

```text
http://192.168.0.171:4000
```

## LAN Hosting Options

### Option A: Developer Host

Use this for testing and demos.

```text
Laptop runs Node server
Phones/laptops join via http://HOST_IPV4:4000
Socket.IO syncs notes over LAN
```

Pros:

- Already works with current code.
- No internet needed after dependencies are installed.
- Lowest complexity.

Cons:

- Host must keep terminal/server running.
- Users need the host IP address.

### Option B: Desktop Host App

Package LinkPad with Electron or Tauri so non-technical users can run it like an app.

```text
Desktop app starts Node/Socket.IO locally
Desktop app shows local URL and invite QR
Other devices join through browser/PWA
```

Recommended for Windows/Mac/Linux distribution.

### Option C: Dedicated LAN Box

Run LinkPad on a Raspberry Pi, mini PC, classroom server, or router-adjacent device.

```text
Always-on LAN device
Static local IP
Users open http://linkpad.local or http://SERVER_IP:4000
```

Best for classrooms/offices.

## Discovery: Local IP and mDNS

### Local IP

The most reliable MVP discovery method is showing host IPv4 addresses in the server logs.

Node can list LAN IPv4 addresses using `os.networkInterfaces()`, which the server already does.

Users connect using:

```text
http://HOST_IPV4:4000
```

### QR Code

Next UX improvement:

```text
Host screen shows QR code for http://HOST_IPV4:4000?room=ABCD
```

This is the easiest cross-platform join method.

### mDNS

mDNS lets devices open a friendly local hostname:

```text
http://linkpad.local:4000
```

Recommended package:

```bash
npm install bonjour-service
```

Example server module:

```js
import { Bonjour } from "bonjour-service";

const bonjour = new Bonjour();

bonjour.publish({
  name: "LinkPad",
  type: "http",
  port: Number(PORT),
  host: "linkpad.local"
});
```

Reality check:

- Works well on macOS/iOS.
- Windows may need Bonjour/iTunes services or compatible mDNS support.
- Android support varies by browser/app environment.

Use mDNS as a convenience, not the only access path.

## LAN Realtime Sync

Recommended MVP path:

```text
Socket.IO over LAN WebSocket
One local Node server is room authority
Clients send note-update / typing-update events
Server broadcasts to the room
```

This is simpler and more reliable than pure peer-to-peer for classrooms and workshops.

For conflict-safe editing later:

```text
React editor + Yjs document + y-socket.io or custom Socket.IO provider
```

Current textarea sync is last-write-wins. It is fine for MVP, but not ideal for heavy simultaneous editing.

## Offline-First Frontend

The app now includes a basic PWA shell:

- `client/public/manifest.webmanifest`
- `client/public/sw.js`
- service worker registration in `client/src/main.jsx`

What this gives:

- Installable app-like frontend on supported browsers.
- Cached app shell after first load.
- Better reload behavior when internet is missing.

Important:

- Realtime collaboration still needs a reachable server.
- If no internet and no LAN host is running, users can open the cached UI but cannot sync.

## Cross-Platform Strategy

### Windows

Best host options:

- Node server from terminal for developers.
- Electron/Tauri packaged app for users.
- Optional MSIX installer later.

### Mac

Best host options:

- Node server from terminal.
- Electron/Tauri app.
- mDNS works well with `.local` names.

### Android

Best client option:

- Chrome browser or PWA.

Android can join a LAN host using:

```text
http://HOST_IPV4:4000
```

### iPhone/iPad

Best client option:

- Safari browser.
- Add to Home Screen after first load.

iOS requires HTTPS for some advanced PWA APIs, but basic LAN HTTP browsing and Socket.IO can work on local networks.

## Remote Users

Users in different cities cannot connect to a private LAN IP.

Use one of these:

### Public Cloud Server

```text
Render/Fly/Railway/VPS hosts Node + Socket.IO
All users open public HTTPS URL
```

This is the simplest remote version.

### Tunnel

```text
Local host runs LinkPad
Cloudflare Tunnel/ngrok exposes temporary HTTPS URL
Remote users join through tunnel URL
```

Good for demos. Less ideal as a final product.

### Mesh VPN

```text
Tailscale/ZeroTier connects devices into one private network
Users open the host device's VPN IP
```

Good for private teams, not frictionless for public events.

### WebRTC/P2P

Possible, but not recommended as the first production path.

Needs:

- signaling server
- STUN/TURN
- NAT traversal handling
- conflict resolution

Good later for advanced peer-to-peer mode.

## Hybrid Architecture

Recommended production direction:

```text
Client starts
  1. Try saved LAN server URL
  2. Try mDNS/local discovery if available
  3. Fall back to configured cloud URL
  4. Show manual host/IP input if neither works
```

Connection priority:

```text
LAN WebSocket < lowest latency
Cloud WebSocket < easiest remote access
Tunnel/VPN < private remote sessions
```

Client config shape:

```js
const connectionTargets = [
  "http://linkpad.local:4000",
  "http://192.168.0.171:4000",
  "https://linkpad.onrender.com"
];
```

The first target that connects becomes the active sync server.

## Security Considerations

LAN MVP:

- No auth means anyone on the same network with the room code can join.
- Use random room codes.
- Expire empty rooms.
- Do not store sensitive notes permanently.

Recommended next steps:

- Optional room passcode.
- Host can lock room.
- Host can clear room.
- Rate-limit room creation and events.
- Limit note size.
- Sanitize names and future rich-text content.
- Prefer HTTPS for public hosting.
- For LAN HTTPS, use a trusted local certificate only if needed; otherwise local HTTP is simpler.

## Recommended Tech Stack

MVP LAN:

```text
React + Vite + PWA
Node + Express
Socket.IO
In-memory rooms
Optional mDNS with bonjour-service
```

Better collaboration:

```text
TipTap/ProseMirror
Yjs CRDT
Socket.IO or y-websocket provider
IndexedDB local persistence
```

Desktop host:

```text
Electron or Tauri
Bundled Node server or sidecar server
QR code invite
mDNS publish
```

Remote:

```text
Render/Fly/Railway/VPS
Socket.IO Redis adapter if scaling to multiple instances
Redis for shared room state
```

## Implementation Plan

### Phase 1: LAN MVP

- Keep current Express + Socket.IO server.
- Build client and serve it from Node.
- Show host IPv4 addresses.
- Add QR invite links.
- Add PWA shell caching.

### Phase 2: LAN Discovery

- Add optional `bonjour-service`.
- Publish `linkpad.local`.
- Keep manual IP fallback.
- Add a host screen that displays IP, `.local` URL, and QR code.

### Phase 3: Offline-First UX

- Cache app shell with service worker.
- Store last used name and server URL in localStorage.
- Store draft note locally for solo editing.
- Reconnect automatically when LAN server returns.

### Phase 4: Remote Mode

- Keep Render deployment as public fallback.
- Add connection target config:

```text
LAN URL
Cloud URL
Manual URL
```

- Client picks first reachable server.

### Phase 5: Reliability Upgrade

- Replace textarea last-write-wins with Yjs.
- Add IndexedDB persistence.
- Add Redis for multi-instance cloud scaling.
- Add room expiry and host controls.

## Suggested Future Structure

```text
client/
  src/
    lib/
      socket.js
      connectionTargets.js
      localStorage.js
    pages/
    components/
server/
  src/
    index.js
    rooms.js
    discovery.js
    network.js
docs/
  OFFLINE_LAN_ARCHITECTURE.md
```

