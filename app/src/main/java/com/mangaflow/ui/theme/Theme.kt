package com.mangaflow.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Scheme = darkColorScheme(
    primary = Color(0xFFFF7A59),
    onPrimary = Color(0xFF1A0A05),
    secondary = Color(0xFF8AB4FF),
    background = Color(0xFF12121A),
    onBackground = Color(0xFFEDEDF2),
    surface = Color(0xFF1B1B26),
    onSurface = Color(0xFFEDEDF2),
    surfaceVariant = Color(0xFF272735),
    onSurfaceVariant = Color(0xFFC4C4D0),
)

@Composable
fun MangaFlowTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
