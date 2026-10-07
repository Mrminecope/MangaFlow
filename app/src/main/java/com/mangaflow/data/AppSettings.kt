package com.mangaflow.data

enum class ScrollMode { MANUAL, AUTO }

/**
 * All user-tunable values.
 *
 * - [scrollSpeed] 1..10: Auto-scroll speed, and also how fast the animated "page step" is.
 * - [scrollDistancePct]: step size as a percentage of the visible viewport height.
 * - [eyeCloseMs]: how long both eyes must stay closed to trigger a scroll.
 * - [sensitivity] 0..1: higher = eyes count as "closed" with less closure.
 * - [cooldownMs]: minimum gap between two triggers.
 * - [calibOpen]/[calibClosed]: measured blink-score for open / closed eyes (from calibration).
 */
data class AppSettings(
    val scrollSpeed: Float = 5f,
    val scrollDistancePct: Int = 70,
    val eyeCloseMs: Int = 800,
    val sensitivity: Float = 0.5f,
    val cooldownMs: Int = 1000,
    val mode: ScrollMode = ScrollMode.MANUAL,
    val eyeControlEnabled: Boolean = true,
    val calibOpen: Float = 0.10f,
    val calibClosed: Float = 0.80f,
) {
    /** Blink score above which both eyes are considered closed. */
    val closeThreshold: Float
        get() {
            val fraction = 0.8f - 0.6f * sensitivity.coerceIn(0f, 1f) // sens 1 -> 0.2, sens 0 -> 0.8
            return calibOpen + (calibClosed - calibOpen) * fraction
        }

    /** Duration of the animated scroll step in ms. */
    val stepDurationMs: Int get() = (1300 - scrollSpeed * 100).toInt().coerceIn(250, 1200)

    /** Auto scroll velocity in dp per second. */
    val autoSpeedDpPerSec: Float get() = scrollSpeed * 25f
}
