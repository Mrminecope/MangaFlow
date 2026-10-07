# MangaFlow 📖👀

> **Hands-free manga reader for Android tablets** powered by on-device eye tracking with CameraX and MediaPipe. Built using Kotlin, Jetpack Compose, and MVVM architecture.

---

## ✨ Features

- **Hands-Free Eye Tracking Control**:
  - Uses the front camera with **CameraX** + **MediaPipe Face Landmarker** (478 3D landmarks + 52 blendshapes).
  - Normal blinks (~100–300 ms) are automatically filtered and ignored.
  - Closing both eyes for ~700–1000 ms triggers a smooth scroll step downward.
  - Requires reopening eyes before another scroll can be initiated (anti-runaway latch).
  - Independent eye evaluation (minimum of left & right closure) prevents unintentional scrolls from one-eye winks.
- **Reading Modes**:
  - **Manual Scroll**: Each intentional long close triggers an animated smooth step down.
  - **Auto Scroll**: Pages scroll smoothly and continuously. Closing eyes pauses or resumes auto-scrolling. Pauses automatically if the user touches/drags the screen.
- **Manga Library & Import Support**:
  - Import loose images (`.jpg`, `.jpeg`, `.png`, `.webp`, etc.).
  - Import entire folders via the Android Storage Access Framework (SAF) folder picker.
  - Import `.cbz` comic archives with secure extraction and natural numeric ordering (e.g., `page_2` before `page_10`).
  - Stored safely in app-private storage without requiring risky storage permissions.
- **Tablet-Optimized UI**:
  - Continuous vertical reading experience (`LazyColumn`).
  - Adaptive layout with column width capped at 900dp for comfortable aspect ratios on 10"–13" tablet displays.
  - Adaptive multi-column grid in Library and dual-pane layout in Settings for tablets.
  - Predictive prefetching (3 pages ahead) using Coil with downsampled sizing for fast, stutter-free scrolling.
  - Quick-seeking page scrubber slider and auto-saved reading progress.
- **Customizable Controls & Calibration**:
  - Interactive eye calibration wizard with real-time feedback and audio cues to measure individual baseline open/closed eye scores.
  - Adjustable scroll speed, scroll distance (% of viewport), eye-close duration threshold, sensitivity, and cooldown interval.
- **Strict On-Device Privacy 🔒**:
  - **Zero Network Permissions**: The app does not request or include `android.permission.INTERNET`.
  - Camera frames are processed strictly in memory by MediaPipe and recycled immediately.
  - No photos or videos are ever recorded, saved, or uploaded.

---

## 🛠 Tech Stack & Architecture

- **Language**: Kotlin 1.9
- **UI Toolkit**: Jetpack Compose with Material Design 3
- **Architecture**: MVVM with unidirectional data flow (UDF) + Coroutines Flow / StateFlow
- **Computer Vision**: Google MediaPipe Tasks Vision (`FaceLandmarker` with live stream mode) + AndroidX CameraX
- **Image Loading**: Coil 2.7 with lifecycle management and downsampled memory caching
- **Storage / Preferences**: Jetpack DataStore Preferences
- **Build System**: Gradle 8.7 with Kotlin DSL

---

## 🚀 Getting Started

### Prerequisites
- Android Studio Hedgehog / Koala or newer
- JDK 17
- Android SDK with `minSdk = 26` (Android 8.0+) and `compileSdk = 34`
- A physical tablet or tablet emulator equipped with a front-facing camera

### Building & Running
1. Clone the repository:
   ```bash
   git clone https://github.com/Mrminecope/MangaFlow.git
   cd MangaFlow
   ```
2. Open the project in Android Studio or build using the included Gradle wrapper:
   ```bash
   ./gradlew assembleDebug
   ```
3. Install the APK onto your device or emulator:
   ```bash
   ./gradlew installDebug
   ```

---

## 📄 License
This project is licensed under the Apache 2.0 License.
