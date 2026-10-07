export type ScrollMode = 'MANUAL' | 'AUTO';

export interface AppSettings {
  scrollSpeed: number;        // 1..10
  scrollDistancePct: number;  // 20..100% of viewport
  eyeCloseMs: number;         // 500..1500 ms
  sensitivity: number;        // 0..1
  cooldownMs: number;         // 300..3000 ms
  mode: ScrollMode;           // MANUAL | AUTO
  eyeControlEnabled: boolean;
  calibOpen: number;          // baseline open eye score (0..1)
  calibClosed: number;        // baseline closed eye score (0..1)
}

export const DEFAULT_SETTINGS: AppSettings = {
  scrollSpeed: 5,
  scrollDistancePct: 70,
  eyeCloseMs: 800,
  sensitivity: 0.5,
  cooldownMs: 1000,
  mode: 'MANUAL',
  eyeControlEnabled: true,
  calibOpen: 0.10,
  calibClosed: 0.80,
};

export function getCloseThreshold(settings: AppSettings): number {
  const fraction = 0.8 - 0.6 * Math.max(0, Math.min(1, settings.sensitivity));
  return settings.calibOpen + (settings.calibClosed - settings.calibOpen) * fraction;
}

export function getStepDurationMs(settings: AppSettings): number {
  return Math.max(250, Math.min(1200, Math.round(1300 - settings.scrollSpeed * 100)));
}

export function getAutoSpeedPxPerSec(settings: AppSettings): number {
  return settings.scrollSpeed * 60; // Pixels per second
}

export interface EyeSample {
  timestampMs: number;
  faceDetected: boolean;
  leftBlink: number;
  rightBlink: number;
  closure: number; // min(leftBlink, rightBlink)
}

export const EMPTY_EYE_SAMPLE: EyeSample = {
  timestampMs: 0,
  faceDetected: false,
  leftBlink: 0,
  rightBlink: 0,
  closure: 0,
};

export type TrackerStatus =
  | { type: 'idle' }
  | { type: 'loading'; message?: string }
  | { type: 'running' }
  | { type: 'error'; message: string };

export interface Manga {
  id: string;
  title: string;
  pageCount: number;
  coverUrl?: string;
  createdAt: number;
  progress: number; // Current page index
}

export interface MangaPage {
  index: number;
  url: string;
  name: string;
  aspectRatio: number;
}
