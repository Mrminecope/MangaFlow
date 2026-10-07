package com.mangaflow.eye

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BlinkDetectorTest {
    private val cfg = BlinkDetector.Config(threshold = 0.5f, closeMs = 800, cooldownMs = 1000)
    private fun s(t: Long, c: Float, face: Boolean = true) = EyeSample(t, face, c, c)

    private fun run(d: BlinkDetector, from: Long, to: Long, c: Float, step: Long = 33): Int {
        var triggers = 0
        var t = from
        while (t <= to) { if (d.update(s(t, c), cfg)) triggers++; t += step }
        return triggers
    }

    @Test fun normalBlinkIgnored() {
        val d = BlinkDetector()
        assertEquals(0, run(d, 0, 300, 0.9f))
        assertEquals(0, run(d, 301, 600, 0.0f))
    }

    @Test fun longCloseTriggersOnce() {
        val d = BlinkDetector()
        assertEquals(1, run(d, 0, 3000, 0.9f))
    }

    @Test fun mustReopenBeforeNextTrigger() {
        val d = BlinkDetector()
        assertEquals(1, run(d, 0, 1000, 0.9f))
        assertEquals(0, run(d, 1001, 5000, 0.9f))
        run(d, 5001, 5200, 0.0f)
        assertEquals(1, run(d, 5201, 6200, 0.9f))
    }

    @Test fun faceLossNeverTriggers() {
        val d = BlinkDetector()
        run(d, 0, 400, 0.9f)
        assertFalse(d.update(s(500, 0f, face = false), cfg))
        assertFalse(d.update(s(1500, 0.9f), cfg))
        assertTrue(d.update(s(2400, 0.9f), cfg))
    }
}
