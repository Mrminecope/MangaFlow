# MangaFlow 📖👀

> **Hands-free manga reader for desktop & tablets** powered by on-device eye tracking with MediaPipe Face Landmarker. Built using React, TypeScript, Vite, and Tailwind CSS.

---

## ✨ Features

- **Hands-Free Eye Tracking Control**:
  - Uses the front camera with **MediaPipe Tasks Vision Face Landmarker** (478 3D landmarks + 52 blendshapes).
  - Normal blinks (~100–300 ms) are automatically filtered and ignored.
  - Closing both eyes for ~700–1000 ms triggers a smooth scroll step downward.
  - Anti-runaway latch: requires reopening eyes before another scroll can be initiated.
  - Independent eye evaluation (`min(leftBlink, rightBlink)`) prevents unintentional scrolls from one-eye winks.
  - Real-time circular progress indicator ring for visual feedback.
  - Fallback / simulation controls (Spacebar or interactive HUD tap) for testing without a webcam.

- **Reading Modes**:
  - **Manual Scroll**: Each intentional long eye closure triggers an animated smooth step down (% of viewport).
  - **Auto Scroll**: Pages scroll smoothly and continuously. Closing eyes pauses or resumes auto-scrolling. Pauses automatically if the user touches, scrolls, or drags the screen.

- **Manga Library & Import Support**:
  - Import loose images (`.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, etc.).
  - Import entire folders via the directory picker.
  - Import `.cbz` and `.zip` comic archives with client-side extraction and natural numeric ordering (e.g., `page_2` before `page_10`).
  - Stored safely in browser **IndexedDB** for persistent offline reading.
  - Built-in sample manga chapter for immediate hands-free reading out of the box.

- **Tablet & Desktop Optimized UI**:
  - Continuous vertical reading experience with adaptive width capped at 900px for optimal aspect ratios.
  - Adaptive multi-column grid in Library and dual-pane layout in Settings.
  - Quick-seeking page scrubber slider and auto-saved reading progress per manga.
  - Fullscreen reading mode support.

- **Customizable Controls & Calibration**:
  - Interactive eye calibration wizard with real-time feedback and audio cues (Web Audio API synthesised beeps) to measure individual baseline open/closed eye scores.
  - Adjustable scroll speed, scroll distance (% of viewport), eye-close duration threshold, sensitivity, and cooldown interval.

- **Strict On-Device Privacy 🔒**:
  - Camera frames are processed strictly in memory by MediaPipe and recycled immediately.
  - Zero external recording, saving, or uploading of video frames.

---

## 🛠 Tech Stack & Architecture

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS
- **Computer Vision**: `@mediapipe/tasks-vision` Face Landmarker
- **Storage**: IndexedDB (`idb`) & `localStorage`
- **Archive Extraction**: `jszip`
- **Icons**: Lucide React

---

## 🚀 Getting Started

### Development
```bash
npm install
npm run dev
```
The application will start on `http://0.0.0.0:3000`.

### Building
```bash
npm run build
```
