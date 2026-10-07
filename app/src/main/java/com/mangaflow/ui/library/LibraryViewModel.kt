package com.mangaflow.ui.library

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.mangaflow.AppContainer
import com.mangaflow.data.Manga
import com.mangaflow.ui.container
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class LibraryUiState(
    val items: List<Manga> = emptyList(),
    val loading: Boolean = true,
    val importing: Boolean = false,
    val message: String? = null,
)

class LibraryViewModel(private val c: AppContainer) : ViewModel() {
    private val _state = MutableStateFlow(LibraryUiState())
    val state: StateFlow<LibraryUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() {
        viewModelScope.launch {
            val list = c.library.list()
            _state.update { it.copy(items = list, loading = false) }
        }
    }

    fun importImages(uris: List<Uri>) = runImport { c.library.importImages(uris) }
    fun importFolder(uri: Uri) = runImport { c.library.importFolder(uri) }
    fun importCbz(uris: List<Uri>) = runImport { uris.forEach { c.library.importCbz(it) } }

    fun delete(m: Manga) {
        viewModelScope.launch {
            c.library.delete(m.id)
            refresh()
        }
    }

    fun messageShown() = _state.update { it.copy(message = null) }

    private fun runImport(block: suspend () -> Unit) {
        if (alreadyImporting()) return
        viewModelScope.launch {
            _state.update { it.copy(importing = true) }
            try {
                block()
                _state.update { it.copy(message = "Import complete") }
            } catch (t: Throwable) {
                _state.update { it.copy(message = "Import failed: ${t.message}") }
            }
            _state.update { it.copy(importing = false) }
            refresh()
        }
    }

    private fun alreadyImporting() = _state.value.importing

    companion object {
        val Factory: ViewModelProvider.Factory = viewModelFactory {
            initializer { LibraryViewModel(container()) }
        }
    }
}
