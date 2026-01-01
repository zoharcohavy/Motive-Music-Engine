# Motive-Music-Engine

Music-Motive-Engine is a browser-based music creation app that lets you play instruments (piano/synth, drums, sampler), record multi-track audio, and collaborate in real-time rooms.

The goal is to make creating musical ideas fast: play instantly, record instantly, and build layered clips on a timeline with a simple tape-head workflow.

## What you can do

### 1) Play instruments
- **Piano / Synth**: click keys or play using your computer keyboard.
- **Drums**: trigger pads with keyboard.
- **Sampler**: use the drum-style grid workflow for triggering samples.

### 2) Multi-track timeline recording
- Record onto **record-armed tracks**
- Each track can hold multiple **clips** (no overlap) arranged along the timeline.
- Use the **tape-head** to control where playback/recording begins.
- Zoom + scroll the timeline to work precisely.

### 3) Track controls + effects
- **Mute / Solo** per track
- Apply **effects** per track (processed audio routing)
- Route playback + live input through track processing

### 4) Live input routing (audio interface / microphone)
- Connect an input device to a specific track.
- Hear the input through the track’s effects chain.
- Record-arm multiple tracks when you want to capture multiple sources.

### 5) Real-time collaboration rooms
- Connect to a room and play together in real time.
- See current room status and active users.

### 6) Room recording
- Start a room recording with a shared countdown.
- Each user’s record-armed tracks capture audio into synchronized files.
- Recording is blocked if:
  - any user has clips to the right of their tape-head on record-armed tracks, or
  - any user is not “UI ready” (a modal/popup is open)
- If blocked, the message shown is:
  - **“make sure all users are ready”**

## Key concepts

### Tape-head safety
To prevent accidental overwrite, recording is blocked when a record-armed track contains any clip that extends past the current tape-head time.

### Clips and the timeline
A clip is a piece of recorded audio placed at a `startTime` on a track with a `duration`.

### Rooms + synchronization
Room recording is designed so every participant starts recording together after the countdown, producing aligned files.

## Local Development

### Prerequisites
- Node.js 18+ recommended
- npm

### Install
From the project root:

```bash
# install client deps
cd my-app
npm install

# install server deps
cd ../server
npm install
