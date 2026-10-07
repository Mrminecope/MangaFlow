package com.mangaflow.eye

/**
 * One analysed camera frame. Only these numbers leave the analyzer; the frame itself is
 * discarded immediately and never stored.
 *
 * @property closure 0 (wide open) .. 1 (fully shut); the *smaller* of both eyes, so it is
 * only high when BOTH eyes are closed (winks are ignored).
 */
data class EyeSample(
    val timestampMs: Long,
    val faceDetected: Boolean,
    val leftBlink: Float,
    val rightBlink: Float,
) {
    val closure: Float get() = minOf(leftBlink, rightBlink)

    companion object {
        val NONE = EyeSample(0L, false, 0f, 0f)
    }
}
