package com.mangaflow.data

import android.content.Context
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.floatPreferencesKey
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.dataStore by preferencesDataStore(name = "mangaflow_settings")

class SettingsRepository(private val context: Context) {

    private object Keys {
        val speed = floatPreferencesKey("scroll_speed")
        val distance = intPreferencesKey("scroll_distance_pct")
        val closeMs = intPreferencesKey("eye_close_ms")
        val sensitivity = floatPreferencesKey("sensitivity")
        val cooldown = intPreferencesKey("cooldown_ms")
        val mode = stringPreferencesKey("mode")
        val eyeEnabled = booleanPreferencesKey("eye_enabled")
        val calibOpen = floatPreferencesKey("calib_open")
        val calibClosed = floatPreferencesKey("calib_closed")
        fun progress(id: String) = intPreferencesKey("progress_$id")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        val d = AppSettings()
        AppSettings(
            scrollSpeed = p[Keys.speed] ?: d.scrollSpeed,
            scrollDistancePct = p[Keys.distance] ?: d.scrollDistancePct,
            eyeCloseMs = p[Keys.closeMs] ?: d.eyeCloseMs,
            sensitivity = p[Keys.sensitivity] ?: d.sensitivity,
            cooldownMs = p[Keys.cooldown] ?: d.cooldownMs,
            mode = runCatching { ScrollMode.valueOf(p[Keys.mode] ?: "") }.getOrDefault(d.mode),
            eyeControlEnabled = p[Keys.eyeEnabled] ?: d.eyeControlEnabled,
            calibOpen = p[Keys.calibOpen] ?: d.calibOpen,
            calibClosed = p[Keys.calibClosed] ?: d.calibClosed,
        )
    }

    suspend fun update(transform: (AppSettings) -> AppSettings) {
        context.dataStore.edit { p ->
            val s = transform(p.toSettings())
            p[Keys.speed] = s.scrollSpeed
            p[Keys.distance] = s.scrollDistancePct
            p[Keys.closeMs] = s.eyeCloseMs
            p[Keys.sensitivity] = s.sensitivity
            p[Keys.cooldown] = s.cooldownMs
            p[Keys.mode] = s.mode.name
            p[Keys.eyeEnabled] = s.eyeControlEnabled
            p[Keys.calibOpen] = s.calibOpen
            p[Keys.calibClosed] = s.calibClosed
        }
    }

    suspend fun reset() = update { AppSettings() }

    suspend fun getProgress(mangaId: String): Int =
        context.dataStore.data.first()[Keys.progress(mangaId)] ?: 0

    suspend fun setProgress(mangaId: String, page: Int) {
        context.dataStore.edit { it[Keys.progress(mangaId)] = page }
    }

    private fun Preferences.toSettings(): AppSettings {
        val d = AppSettings()
        return AppSettings(
            scrollSpeed = this[Keys.speed] ?: d.scrollSpeed,
            scrollDistancePct = this[Keys.distance] ?: d.scrollDistancePct,
            eyeCloseMs = this[Keys.closeMs] ?: d.eyeCloseMs,
            sensitivity = this[Keys.sensitivity] ?: d.sensitivity,
            cooldownMs = this[Keys.cooldown] ?: d.cooldownMs,
            mode = runCatching { ScrollMode.valueOf(this[Keys.mode] ?: "") }.getOrDefault(d.mode),
            eyeControlEnabled = this[Keys.eyeEnabled] ?: d.eyeControlEnabled,
            calibOpen = this[Keys.calibOpen] ?: d.calibOpen,
            calibClosed = this[Keys.calibClosed] ?: d.calibClosed,
        )
    }
}
