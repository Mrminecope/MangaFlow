package com.mangaflow.ui.reader

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.mangaflow.AppContainer
import com.mangaflow.data.AppSettings
import com.mangaflow.data.MangaPage
import com.mangaflow.data.ScrollMode
import com.mangaflow.eye.BlinkDetector
import com.mangaflow.eye.TrackerStatus
import com.mangaflow.ui.container
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

sealed interface ReaderEvent {
    /** Animate one step down. */
    data object ScrollStep : ReaderEvent
    /** Auto mode: eyes-closed gesture pauses / resumes the auto scroll. */
    data object ToggleAuto : ReaderEvent
}

data class ReaderUiState(
    val title: String = "",
    val pages: List<MangaPage> = emptyList(),
    val loading: Boolean = true,
    val startIndex: Int = 0,
    val overlayVisible: Boolean = true,
    val autoRunning: Boolean = false,
)

class ReaderViewModel(
    private val c: AppContainer,
    handle: SavedStateHandle,
) : ViewModel() {

    private val mangaId: String = checkNotNull(handle["id"])

    private val _ui = MutableStateFlow(ReaderUiState())
    val ui: StateFlow<ReaderUiState> = _ui.asStateFlow()

    val settings: StateFlow<AppSettings> = c.settings.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    /** Closing progress 0..1, separate flow so only the small ring recomposes at camera rate. */
    private val _closeProgress = MutableStateFlow(0f)
    val closeProgress: StateFlow<Float> = _closeProgress.asStateFlow()

    val faceVisible: StateFlow<Boolean> = c.eyeTracker.latest
        .map { it.faceDetected }
        .distinctUntilChanged()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), false)

    val trackerStatus: StateFlow<TrackerStatus> = c.eyeTracker.status

    private val eventChannel = Channel<ReaderEvent>(Channel.CONFLATED)
    val events = eventChannel.receiveAsFlow()

    private val detector = BlinkDetector()

    init {
        viewModelScope.launch {
            val pages = c.library.loadPages(mangaId)
            val start = c.settings.getProgress(mangaId).coerceIn(0, (pages.size - 1).coerceAtLeast(0))
            _ui.update {
                it.copy(
                    title = c.library.title(mangaId),
                    pages = pages,
                    startIndex = start,
                    loading = false,
                    autoRunning = settings.value.mode == ScrollMode.AUTO,
                )
            }
        }
        viewModelScope.launch {
            c.eyeTracker.samples.collect { sample ->
                val s = settings.value
                if (!s.eyeControlEnabled) {
                    detector.reset()
                    _closeProgress.value = 0f
                    return@collect
                }
                val fired = detector.update(
                    sample,
                    BlinkDetector.Config(s.closeThreshold, s.eyeCloseMs.toLong(), s.cooldownMs.toLong()),
                )
                _closeProgress.value = detector.progress
                if (fired) {
                    eventChannel.trySend(
                        if (s.mode == ScrollMode.AUTO) ReaderEvent.ToggleAuto else ReaderEvent.ScrollStep,
                    )
                }
            }
        }
    }

    fun toggleOverlay() = _ui.update { it.copy(overlayVisible = !it.overlayVisible) }

    fun setAutoRunning(running: Boolean) = _ui.update { it.copy(autoRunning = running) }

    fun toggleAuto() = _ui.update { it.copy(autoRunning = !it.autoRunning) }

    fun setMode(mode: ScrollMode) {
        viewModelScope.launch { c.settings.update { it.copy(mode = mode) } }
        _ui.update { it.copy(autoRunning = mode == ScrollMode.AUTO) }
    }

    fun setEyeControl(enabled: Boolean) {
        viewModelScope.launch { c.settings.update { it.copy(eyeControlEnabled = enabled) } }
    }

    fun saveProgress(page: Int) {
        viewModelScope.launch { c.settings.setProgress(mangaId, page) }
    }

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { ReaderViewModel(container(), createSavedStateHandle()) }
        }
    }
}
