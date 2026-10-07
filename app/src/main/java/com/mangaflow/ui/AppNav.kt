package com.mangaflow.ui

import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.CreationExtras
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.mangaflow.AppContainer
import com.mangaflow.MangaFlowApp
import com.mangaflow.ui.calibration.CalibrationScreen
import com.mangaflow.ui.library.LibraryScreen
import com.mangaflow.ui.reader.ReaderScreen
import com.mangaflow.ui.settings.SettingsScreen

fun CreationExtras.container(): AppContainer = (this[APPLICATION_KEY] as MangaFlowApp).container

object Routes {
    const val LIBRARY = "library"
    const val READER = "reader/{id}"
    const val SETTINGS = "settings"
    const val CALIBRATION = "calibration"
    fun reader(id: String) = "reader/$id"
}

@Composable
fun AppNav() {
    val nav = rememberNavController()
    NavHost(navController = nav, startDestination = Routes.LIBRARY) {
        composable(Routes.LIBRARY) {
            LibraryScreen(
                onOpen = { nav.navigate(Routes.reader(it)) },
                onSettings = { nav.navigate(Routes.SETTINGS) },
            )
        }
        composable(
            Routes.READER,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) {
            ReaderScreen(
                onBack = { nav.popBackStack() },
                onSettings = { nav.navigate(Routes.SETTINGS) },
            )
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(
                onBack = { nav.popBackStack() },
                onCalibrate = { nav.navigate(Routes.CALIBRATION) },
            )
        }
        composable(Routes.CALIBRATION) {
            CalibrationScreen(onBack = { nav.popBackStack() })
        }
    }
}
