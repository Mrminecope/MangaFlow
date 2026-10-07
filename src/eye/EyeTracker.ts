import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { EyeSample, EMPTY_EYE_SAMPLE, TrackerStatus } from '../types';

export class EyeTracker {
  private static instance: EyeTracker;

  private landmarker: FaceLandmarker | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private mediaStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private isProcessing = false;

  private latestSample: EyeSample = EMPTY_EYE_SAMPLE;
  private currentStatus: TrackerStatus = { type: 'idle' };

  private sampleListeners = new Set<(sample: EyeSample) => void>();
  private statusListeners = new Set<(status: TrackerStatus) => void>();

  // Audio tone context for calibration beeps
  private audioCtx: AudioContext | null = null;

  // Active consumer count so navigating between screens doesn't accidentally stop
  private activeOwners = new Set<string>();

  public static getInstance(): EyeTracker {
    if (!EyeTracker.instance) {
      EyeTracker.instance = new EyeTracker();
    }
    return EyeTracker.instance;
  }

  private constructor() {
    // Hidden video element used for webcam capture
    if (typeof document !== 'undefined') {
      const v = document.createElement('video');
      v.setAttribute('autoplay', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('muted', '');
      v.style.display = 'none';
      document.body.appendChild(v);
      this.videoElement = v;
    }
  }

  public get latest(): EyeSample {
    return this.latestSample;
  }

  public get status(): TrackerStatus {
    return this.currentStatus;
  }

  public subscribeSamples(listener: (sample: EyeSample) => void): () => void {
    this.sampleListeners.add(listener);
    listener(this.latestSample);
    return () => this.sampleListeners.delete(listener);
  }

  public subscribeStatus(listener: (status: TrackerStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.currentStatus);
    return () => this.statusListeners.delete(listener);
  }

  private emitStatus(status: TrackerStatus): void {
    this.currentStatus = status;
    this.statusListeners.forEach((fn) => fn(status));
  }

  private emitSample(sample: EyeSample): void {
    this.latestSample = sample;
    this.sampleListeners.forEach((fn) => fn(sample));
  }

  public async start(ownerId = 'default'): Promise<void> {
    this.activeOwners.add(ownerId);
    if (this.isProcessing || this.currentStatus.type === 'running') {
      return;
    }

    this.emitStatus({ type: 'loading', message: 'Initializing camera and eye tracker...' });

    try {
      // 1. Initialize MediaPipe FaceLandmarker
      await this.ensureLandmarker();

      // 2. Request webcam
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera API is not supported in this browser environment.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      });

      this.mediaStream = stream;

      if (!this.videoElement) {
        const v = document.createElement('video');
        v.setAttribute('autoplay', '');
        v.setAttribute('playsinline', '');
        v.setAttribute('muted', '');
        v.style.display = 'none';
        document.body.appendChild(v);
        this.videoElement = v;
      }

      this.videoElement.srcObject = stream;
      await new Promise<void>((resolve, reject) => {
        if (!this.videoElement) return reject(new Error('No video element'));
        this.videoElement.onloadedmetadata = () => {
          this.videoElement?.play().then(() => resolve()).catch(reject);
        };
        this.videoElement.onerror = (e) => reject(e);
      });

      this.isProcessing = true;
      this.emitStatus({ type: 'running' });
      this.loop();
    } catch (err: unknown) {
      console.error('Eye tracker start failed:', err);
      const msg = err instanceof Error ? err.message : 'Camera or eye tracking error';
      this.emitStatus({ type: 'error', message: msg });
    }
  }

  public stop(ownerId = 'default'): void {
    this.activeOwners.delete(ownerId);
    if (this.activeOwners.size > 0) {
      // Still used by another component (e.g. transitioning between screens)
      return;
    }

    this.isProcessing = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.emitSample(EMPTY_EYE_SAMPLE);
    this.emitStatus({ type: 'idle' });
  }

  private async ensureLandmarker(): Promise<FaceLandmarker> {
    if (this.landmarker) {
      return this.landmarker;
    }

    try {
      // Load wasm from CDN (standard MediaPipe Web Tasks delivery)
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );

      // Model is served locally from public/face_landmarker.task
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });

      return this.landmarker;
    } catch (e) {
      console.warn('GPU landmarker init failed, retrying with CPU delegate...', e);
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      this.landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: '/face_landmarker.task',
          delegate: 'CPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      return this.landmarker;
    }
  }

  private lastVideoTime = -1;

  private loop = (): void => {
    if (!this.isProcessing) return;

    try {
      const video = this.videoElement;
      if (video && video.readyState >= 2 && this.landmarker) {
        const currentTime = video.currentTime;
        if (currentTime !== this.lastVideoTime) {
          this.lastVideoTime = currentTime;
          const startTimeMs = performance.now();
          const result = this.landmarker.detectForVideo(video, startTimeMs);

          if (result && result.faceBlendshapes && result.faceBlendshapes.length > 0) {
            const blendshapes = result.faceBlendshapes[0].categories;
            let leftBlink = 0;
            let rightBlink = 0;

            for (const cat of blendshapes) {
              if (cat.categoryName === 'eyeBlinkLeft') {
                leftBlink = cat.score;
              } else if (cat.categoryName === 'eyeBlinkRight') {
                rightBlink = cat.score;
              }
            }

            const sample: EyeSample = {
              timestampMs: Math.round(performance.now()),
              faceDetected: true,
              leftBlink,
              rightBlink,
              closure: Math.min(leftBlink, rightBlink),
            };
            this.emitSample(sample);
          } else {
            const sample: EyeSample = {
              timestampMs: Math.round(performance.now()),
              faceDetected: false,
              leftBlink: 0,
              rightBlink: 0,
              closure: 0,
            };
            this.emitSample(sample);
          }
        }
      }
    } catch (err) {
      console.warn('Frame processing error:', err);
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Helper to simulate eye samples for manual testing or environments without a camera.
   */
  public simulateSample(closure: number, faceDetected = true): void {
    const sample: EyeSample = {
      timestampMs: Math.round(performance.now()),
      faceDetected,
      leftBlink: closure,
      rightBlink: closure,
      closure,
    };
    this.emitSample(sample);
  }

  /**
   * Audio feedback beep for calibration cues.
   * Matches ToneGenerator(AudioManager.STREAM_MUSIC, 80) in Android.
   */
  public playBeep(freq = 880, durationMs = 200): void {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + durationMs / 1000);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + durationMs / 1000);
    } catch (e) {
      console.warn('Could not play audio cue:', e);
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }
}

export const eyeTracker = EyeTracker.getInstance();
