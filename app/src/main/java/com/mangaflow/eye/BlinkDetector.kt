package com.mangaflow.eye

/**
 * Pure (Android-free, unit-testable) state machine turning a stream of [EyeSample]s into
 * "long close" triggers.
 *
 * Rules:
 * - Eyes must stay closed for [closeMs]; shorter closures (normal blinks) are ignored.
 * - After a trigger the detector is *disarmed* until eyes are seen open again.
 * - Triggers are at least [cooldownMs] apart.
 * - Losing the face resets the running closure timer (never triggers from missing data).
 * - Hysteresis: eyes count as closed at `closure >= threshold` and as open below
 *   `threshold * OPEN_RATIO`; in between the previous state is kept (avoids jitter).
 */
class BlinkDetector {

    data class Config(val threshold: Float, val closeMs: Long, val cooldownMs: Long)

    private var closed = false
    private var closedSince = -1L
    private var armed = true
    private var lastTrigger = Long.MIN_VALUE / 2

    /** 0..1 progress towards a trigger while eyes are closed (for UI feedback). */
    var progress: Float = 0f
        private set

    /** @return true when a scroll should be triggered for this sample. */
    fun update(sample: EyeSample, cfg: Config): Boolean {
        val now = sample.timestampMs
        if (!sample.faceDetected) {
            closed = false
            closedSince = -1L
            progress = 0f
            return false
        }
        val c = sample.closure
        if (c >= cfg.threshold) closed = true
        else if (c < cfg.threshold * OPEN_RATIO) closed = false

        if (!closed) {
            closedSince = -1L
            armed = true
            progress = 0f
            return false
        }
        if (closedSince < 0) closedSince = now
        val held = now - closedSince
        progress = if (armed) (held.toFloat() / cfg.closeMs).coerceIn(0f, 1f) else 0f
        if (armed && held >= cfg.closeMs && now - lastTrigger >= cfg.cooldownMs) {
            armed = false
            lastTrigger = now
            progress = 0f
            return true
        }
        return false
    }

    fun reset() {
        closed = false
        closedSince = -1L
        armed = true
        progress = 0f
    }

    companion object {
        const val OPEN_RATIO = 0.8f
    }
}
