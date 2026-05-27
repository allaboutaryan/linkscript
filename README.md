# LinkPad

LinkPad is a lightweight realtime collaborative notes app for fast group writing. It was designed for classrooms, meetings, orientations, hackathons, and study groups where people need one shared writing space without accounts or setup friction.

Users enter a name, create or join a room with a short code, and type together live.

## Why LinkPad?

LinkPad is not trying to replace WhatsApp or Google Docs.

It is for temporary collaboration when you do not want:

- phone numbers
- logins
- groups
- cloud documents
- permanent chat history
- setup before a session

For local use, LinkPad can run over the same WiFi or mobile hotspot. For remote users, it can be hosted on a public Node server.

## Features

- Create a room with a short random room code
- Join using room code
- Enter your name before joining
- Realtime shared note syncing
- Connected user count
- Colored participant dots
- "Who is typing" indicator
- Humanize button for making pasted AI-style text sound more natural
- No authentication
- No database
- No AI features
- No external API dependency
- Works locally on same WiFi/hotspot
- Can also be deployed as a public Node app
- PWA app shell caching for better offline reload behavior

## Architecture Guide

For the full local-network, offline-first, remote, and hybrid architecture plan, see:

```text
docs/OFFLINE_LAN_ARCHITECTURE.md
```

## Tech Stack

Frontend:

- React
- Vite
- TailwindCSS
- Socket.IO Client

Backend:

- Node.js
- Express
- Socket.IO

Storage:

- In-memory only for MVP
- Restarting the server clears rooms and notes

## Folder Structure

```text
client/
server/
README.md
package.json
render.yaml
```

## Local Setup

Install dependencies:

```bash
npm run install:all
```

## Run Locally From One URL

Build the React client:

```bash
npm run build
```

Start the Node server:

```bash
npm start
```

Open:

```text
http://localhost:4000
```

## Easy Offline LAN Mode

For non-technical users, the target flow is:

```text
Host opens LinkPad desktop app
Host creates room
App shows room code + phone invite QR/link
Phones/laptops on same WiFi open the invite link
Everyone collaborates without internet
```

Development command for the desktop host app:

```bash
npm run desktop
```

Build a Windows installer:

```bash
npm run desktop:dist
```

Phone users do not install the desktop app. They connect to the same WiFi/hotspot as the host laptop and open the invite link shown in the host app, for example:

```text
http://192.168.0.100:4000?room=ABCD
```

The QR code in the room points to this LAN invite link.

## How To Use The Windows Host App

This is the easiest offline/same-WiFi flow.

### Host Laptop

1. Install LinkPad using the Windows installer.
2. Open the LinkPad desktop app.
3. Enter your name.
4. Click **Create Session**.
5. Keep the LinkPad app open.
6. Share the QR code or phone invite link shown in the room.

### Phone Or Other Laptop

1. Connect to the same WiFi or mobile hotspot as the host laptop.
2. Scan the QR code shown on the host laptop.
3. Or open the invite link shown on the host laptop.
4. Enter your name.
5. Click **Join Session**.

Phone users do not install anything. They only need a browser.

### Important

This local file path only works on the machine where the file exists:

```text
file:///C:/Users/2arya/Desktop/linknote/release/LinkPad%20Setup%200.1.0.exe
```

Do not send that `file:///` path to other people. Their device cannot access your `C:` drive.

To share the installer with someone else, send/upload the actual file:

```text
release/LinkPad Setup 0.1.0.exe
```

Good sharing options:

- GitHub Releases
- Google Drive
- WhatsApp/Telegram file share
- USB drive
- LAN file share

Because this is an unsigned local build, Windows may show a warning. For a polished public release, sign the installer with a code-signing certificate.

## Render Mode Vs Offline LAN Mode

LinkPad now has two useful modes.

### Render Mode

Use this when users are far away or have internet:

```text
https://linkpad.onrender.com
```

How it works:

```text
Everyone opens the Render link
Render runs the Node + Socket.IO server online
Users create/join rooms through the internet
```

Pros:

- Works across cities
- No install needed
- Easy public demo

Cons:

- Needs internet
- Free Render can sleep and take time to wake up

### Offline LAN Mode

Use this when users are in the same room/class/workshop and may not have internet:

```text
Host laptop runs LinkPad desktop app
Phones/laptops join through local WiFi link or QR
```

How it works:

```text
The desktop app starts a local server on the host laptop
The app shows the host laptop's local network URL
Other devices on the same WiFi open that URL
Socket.IO syncs notes over the local network
```

Example local invite:

```text
http://192.168.0.100:4000?room=ABCD
```

Pros:

- No internet needed
- Very low latency
- Great for classrooms, meetings, workshops, hotspots

Cons:

- Host laptop must keep LinkPad app open
- Everyone must be on the same WiFi/hotspot
- Far-away users cannot join this local link

Simple explanation:

```text
Render mode = online server
Offline LAN mode = one laptop becomes the local server
```

For auto-restart while developing the backend:

```bash
npm run dev:server
```

## Quick Commands

```bash
npm run install:all
npm run build
npm start
```

## Use On Same WiFi Or Hotspot

1. Connect all devices to the same WiFi or mobile hotspot.
2. Start LinkPad on the host laptop.
3. Find the host laptop's IPv4 address.

Windows:

```powershell
ipconfig
```

Look for an address like:

```text
192.168.0.171
```

4. Other devices open:

```text
http://YOUR_IPV4:4000
```

Example:

```text
http://192.168.0.171:4000
```

5. Enter your name.
6. Host creates a room.
7. Others enter their name and room code.

## Development Mode

You can run the frontend dev server separately while developing:

Terminal 1:

```bash
npm run dev:server
```

Terminal 2:

```bash
npm run dev:client
```

Open:

```text
http://localhost:5173
```

For normal testing, prefer `http://localhost:4000` after building the client.

## Deploy Free With Render

GitHub Pages cannot run this full app because LinkPad needs a Node.js Socket.IO server.

Use Render or another Node hosting provider instead.

### Option A: Render Dashboard

1. Push this project to GitHub.
2. Go to Render.
3. Create a new **Web Service**.
4. Connect your GitHub repository.
5. Leave the root directory blank if this repository directly contains `client`, `server`, and `package.json`.

6. Use this build command:

```bash
npm run render-build
```

7. Use this start command:

```bash
npm start
```

8. Deploy.

Render will give you a public URL like:

```text
https://your-linkpad-app.onrender.com
```

Anyone with that URL can create or join rooms.

### Option B: Render Blueprint

If your hosting provider supports blueprint files, use the included `render.yaml`.

## Production Notes

This MVP intentionally has no database. That keeps it simple and fast, but it means:

- rooms disappear when the server restarts
- notes are not saved permanently
- all users share memory on one running server instance

For a future production version, consider:

- Yjs for conflict-safe collaboration
- Redis adapter for scaling Socket.IO across multiple instances
- optional room expiry timers
- optional export/download note feature
- PWA install support
- Electron/Tauri desktop host app

## Current Product Flow

```text
Enter name
Create or join room
See connected users
Type together live
See who is typing
Leave when done
```
