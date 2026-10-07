package com.mangaflow.ui.calibration

import android.media.AudioManager
import android.media.ToneGenerator
import android.os.SystemClock
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.mangaflow.AppContainer
import com.mangaflow.eye.EyeSample
import com.mangaflow.ui.container
import kotlinx.coroutines.Job
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull

enum class CalibrationPhase { INTRO, OPEN_EYES, GET_READY, CLOSE_EYES, SUCCESS, FAILED }

data class CalibrationUi(
    val phase: CalibrationPhase = CalibrationPhase.INTRO,
    val secondsLeft: Int = 0,
    val openValue: Float = 0f,
    val closedValue: Float = 0f,
    val error: String? = null,
)

/**
 * Two-step calibration:
 *  1. look at the screen with eyes open  -> baseline "open" blink score
 *  2. (beep) close eyes until the 2nd beep -> "closed" blink score
 * Medians are stored; the live threshold is interpolated between them using the sensitivity setting.
 */
class CalibrationViewModel(private val c: AppContainer) : ViewModel() {
    private val _ui = MutableStateFlow(CalibrationUi())
    val ui: StateFlow<CalibrationUi> = _ui.asStateFlow()

    val live: StateFlow<EyeSample> = c.eyeTracker.latest

    private var job: Job? = null

    fun start() {
        job?.cancel()
        job = viewModelScope.launch {
            _ui.value = CalibrationUi(CalibrationPhase.OPEN_EYES)
            val open = collectPhase(CalibrationPhase.OPEN_EYES, 3_000, skipMs = 700)

            val ready = 3
            for (left in ready downTo 1) {
                _ui.update { it.copy(phase = CalibrationPhase.GET_READY, secondsLeft = left) }
                delay(1_000)
            }
            beep()
            val closed = collectPhase(CalibrationPhase.CLOSE_EYES, 3_500, skipMs = 800)
            beep()

            if (open.size < MIN_SAMPLES || closed.size < MIN_SAMPLES) {
                fail("Your face wasn't detected clearly. Hold the tablet at arm's length in good light and try again.")
                return@launch
            }
            val o = median(open)
            val cl = median(closed)
            if (cl - o < 0.25f) {
                fail("Couldn't see a clear difference between open and closed eyes. Try again with both eyes fully closed.")
                return@launch
            }
            c.settings.update { it.copy(calibOpen = o, calibClosed = cl) }
            _ui.value = CalibrationUi(CalibrationPhase.SUCCESS, openValue = o, closedValue = cl)
        }
    }

    fun reset() {
        job?.cancel()
        _ui.value = CalibrationUi()
    }

    private fun fail(msg: String) {
        _ui.value = CalibrationUi(CalibrationPhase.FAILED, error = msg)
    }

    private suspend fun collectPhase(phase: CalibrationPhase, durationMs: Long, skipMs: Long): List<Float> =
        coroutineScope {
            val out = ArrayList<Float>()
            val t0 = SystemClock.uptimeMillis()
            val ticker = launch {
                var left = ((durationMs + 999) / 1000).toInt()
                while (left > 0) {
                    _ui.update { it.copy(phase = phase, secondsLeft = left) }
                    delay(1_000)
                    left--
                }
            }
            withTimeoutOrNull(durationMs) {
                c.eyeTracker.samples.collect { s ->
                    if (s.faceDetected && SystemClock.uptimeMillis() - t0 >= skipMs) out += s.closure
                }
            }
            ticker.cancel()
            out
        }

    private fun median(v: List<Float>): Float = v.sorted().let { it[it.size / 2] }

    private suspend fun beep() {
        runCatching {
            val tg = ToneGenerator(AudioManager.STREAM_MUSIC, 80)
            tg.startTone(ToneGenerator.TONE_PROP_BEEP, 200)
            delay(250)
            tg.release()
        }
    }

    companion object {
        private const val MIN_SAMPLES = 15
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { CalibrationViewModel(container()) }
        }
    }
}
