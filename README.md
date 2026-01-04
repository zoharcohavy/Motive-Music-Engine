🎵 Music Motive Engine

A browser-based, collaborative digital audio workstation

Music Motive Engine is a web-based Digital Audio Workstation (DAW)
that allows users to play instruments, record multi-track audio, and
collaborate in real time with others through shared rooms — all
directly in the browser.

The app is built with React, Web Audio API, Node.js, and WebSockets,
and supports both solo recording and synchronized multi-user room
recording.

✨ Features
🎹 Browser instruments (piano, drums, sampler)
🎛 Multi-track timeline with clips and transport controls
⏺ Individual (local) recording
🌐 Real-time collaborative rooms
Hear notes played by other users instantly
Synchronized room recording across multiple users
🧠 Smart recording controls
Auto-play during recording
Pause button acts as “stop & save recording”
UI locking to prevent accidental edits while recording
💾 Persistent recordings
Recordings saved on the server
Viewable in a recordings panel
🧩 Modular architecture using custom React hooks

🖥 Tech Stack
Frontend:
React
Web Audio API
Canvas (waveform rendering)
Vite

Backend:
Node.js
Express
WebSocket (ws)
Multer (audio uploads)

📂 Project Structure (simplified)
.
├── my-app/            # Frontend (React)
│   └── src/
├── server/            # Backend (Node + Express + WebSockets)
├── .gitignore
├── README.md

🚀 Running the App Locally
1. Prerequisites

Make sure you have installed:

Node.js (v18+ recommended)

npm (comes with Node)

Check with:

node -v
npm -v

2. Clone the Repository
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME

3. Install Dependencies
Backend
cd server
npm install

Frontend
cd ../my-app
npm install

4. Environment Variables (Backend)

Create a file:
server/.env


Example:

PORT=8080
MONGO_URI=your_mongodb_connection_string_here


⚠️ The .env file is required to run the backend, but is not
included in the repo for security reasons.

If you don’t need database features yet, the app will still run
without MongoDB for basic audio + room functionality.

5. Start the Servers
Start the backend:
cd server
npm start


You should see something like:
Server running on port 8080

Start the frontend:
cd ../my-app
npm run dev

Vite will print a local URL, usually:
http://localhost:5173

Open that URL in your browser.

🌐 Using Collaborative Rooms
To collaborate between multiple computers:
Run the backend on one shared machine or server
Replace localhost in the frontend API/WebSocket config with:
A LAN IP (for same Wi-Fi testing), or
A public IP/domain (for remote collaboration)
Open the app on multiple devices
Join the same room name
Play notes — they will be heard on all connected machines
Audio is event-based (notes), not streamed audio — each browser renders
sound locally for low latency.

⏺ Recording Behavior
Record button starts recording and auto-plays transport
Pause button during recording: Stops the recording,
Saves the audio, and Pauses the transport

While recording, most UI controls are locked to prevent mistakes

🧪 Development Notes

Audio files are saved under server/recordings/ (ignored by git)
Uploaded clips are stored under server/storage/
The app is designed for experimentation and extension:
Shared metronome
MIDI input
Effects chains
Exporting stems

📜 License

Proprietary License – All Rights Reserved

Copyright © 2026 Zohar Cohavy

This project is not open source.

The source code, assets, and documentation in this repository are
provided for viewing purposes only. No permission is granted to copy,
modify, distribute, sublicense, or use this software in any form,
whether for commercial or non-commercial purposes, without prior
written consent from the copyright holder.

This repository is published publicly for demonstration and
evaluation purposes only.

For full terms, see the LICENSE file included in this repository.

🙌 Acknowledgements

Inspired by classic DAWs, hardware multitrack recorders, and
modern collaborative music tools — built as an exploration of
real-time audio systems in the browser.
