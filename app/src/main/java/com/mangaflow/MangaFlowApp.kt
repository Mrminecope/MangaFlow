package com.mangaflow

import android.app.Application
import android.content.Context
import com.mangaflow.data.LibraryRepository
import com.mangaflow.data.SettingsRepository
import com.mangaflow.eye.EyeTracker

class AppContainer(context: Context) {
    val settings = SettingsRepository(context)
    val library = LibraryRepository(context)
    val eyeTracker = EyeTracker(context)
}

class MangaFlowApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
