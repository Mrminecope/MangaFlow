import { EyeSample } from '../types';

export interface BlinkDetectorConfig {
  threshold: number;
  closeMs: number;
  cooldownMs: number;
}

/**
 * Pure state machine turning a stream of EyeSamples into "long close" triggers.
 * Ported faithfully from com.mangaflow.eye.BlinkDetector.
 *
 * Rules:
 * - Eyes must stay closed for closeMs; shorter closures (normal blinks) are ignored.
 * - After a trigger the detector is *disarmed* until eyes are seen open again.
 * - Triggers are at least cooldownMs apart.
 * - Losing the face resets the running closure timer (never triggers from missing data).
 * - Hysteresis: eyes count as closed at closure >= threshold and as open below
 *   threshold * OPEN_RATIO; in between the previous state is kept (avoids jitter).
 */
export class BlinkDetector {
  private static readonly OPEN_RATIO = 0.8;

  private closed = false;
  private closedSince = -1;
  private armed = true;
  private lastTrigger = -Number.MAX_SAFE_INTEGER / 2;

  /** 0..1 progress towards a trigger while eyes are closed (for UI feedback). */
  public progress = 0;

  /** @returns true when a scroll should be triggered for this sample */
  public update(sample: EyeSample, cfg: BlinkDetectorConfig): boolean {
    const now = sample.timestampMs;

    if (!sample.faceDetected) {
      this.closed = false;
      this.closedSince = -1;
      this.progress = 0;
      return false;
    }

    const c = sample.closure;
    if (c >= cfg.threshold) {
      this.closed = true;
    } else if (c < cfg.threshold * BlinkDetector.OPEN_RATIO) {
      this.closed = false;
    }

    if (!this.closed) {
      this.closedSince = -1;
      this.armed = true;
      this.progress = 0;
      return false;
    }

    if (this.closedSince < 0) {
      this.closedSince = now;
    }

    const held = now - this.closedSince;
    this.progress = this.armed ? Math.max(0, Math.min(1, held / cfg.closeMs)) : 0;

    if (this.armed && held >= cfg.closeMs && now - this.lastTrigger >= cfg.cooldownMs) {
      this.armed = false;
      this.lastTrigger = now;
      this.progress = 0;
      return true;
    }

    return false;
  }

  public reset(): void {
    this.closed = false;
    this.closedSince = -1;
    this.armed = true;
    this.progress = 0;
  }
}
