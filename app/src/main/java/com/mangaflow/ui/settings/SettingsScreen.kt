package com.mangaflow.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mangaflow.data.AppSettings
import com.mangaflow.data.ScrollMode

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    onBack: () -> Unit,
    onCalibrate: () -> Unit,
    vm: SettingsViewModel = viewModel(factory = SettingsViewModel.Factory),
) {
    val s by vm.settings.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Settings") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
    ) { padding ->
        BoxWithConstraints(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.TopCenter) {
            val twoPane = maxWidth >= 840.dp // tablets: two columns
            Column(
                Modifier.widthIn(max = 1200.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(24.dp),
                verticalArrangement = Arrangement.spacedBy(20.dp),
            ) {
                if (twoPane) {
                    Row(horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                        Box(Modifier.weight(1f)) { ScrollingCard(s, vm) }
                        Box(Modifier.weight(1f)) { EyeCard(s, vm, onCalibrate) }
                    }
                } else {
                    ScrollingCard(s, vm)
                    EyeCard(s, vm, onCalibrate)
                }
                PrivacyCard()
                OutlinedButton(onClick = vm::reset) { Text("Reset to defaults") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScrollingCard(s: AppSettings, vm: SettingsViewModel) {
    SectionCard("Scrolling") {
        Text("Mode", style = MaterialTheme.typography.titleSmall)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            ScrollMode.entries.forEachIndexed { i, m ->
                SegmentedButton(
                    selected = s.mode == m,
                    onClick = { vm.update { it.copy(mode = m) } },
                    shape = SegmentedButtonDefaults.itemShape(i, ScrollMode.entries.size),
                ) { Text(if (m == ScrollMode.AUTO) "Auto scroll" else "Manual scroll") }
            }
        }
        Text(
            if (s.mode == ScrollMode.AUTO) "Pages move continuously. Closing your eyes pauses / resumes."
            else "Pages move one step each time you close your eyes (or when you swipe).",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        SettingSlider(
            "Scroll speed", s.scrollSpeed, 1f..10f, 8, { "%.0f".format(it) },
        ) { v -> vm.update { it.copy(scrollSpeed = v) } }
        SettingSlider(
            "Scroll distance", s.scrollDistancePct.toFloat(), 20f..100f, 15, { "${it.toInt()}% of screen" },
        ) { v -> vm.update { it.copy(scrollDistancePct = v.toInt()) } }
    }
}

@Composable
private fun EyeCard(s: AppSettings, vm: SettingsViewModel, onCalibrate: () -> Unit) {
    SectionCard("Eye control") {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text("Enable eye control", style = MaterialTheme.typography.titleSmall)
                Text(
                    "Close both eyes to scroll. Normal blinks are ignored.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Switch(
                checked = s.eyeControlEnabled,
                onCheckedChange = { v -> vm.update { it.copy(eyeControlEnabled = v) } },
            )
        }
        SettingSlider(
            "Eye-close duration", s.eyeCloseMs.toFloat(), 500f..1500f, 19, { "${it.toInt()} ms" },
        ) { v -> vm.update { it.copy(eyeCloseMs = v.toInt()) } }
        SettingSlider(
            "Sensitivity", s.sensitivity, 0f..1f, 9, { "${(it * 100).toInt()}%" },
        ) { v -> vm.update { it.copy(sensitivity = v) } }
        SettingSlider(
            "Cooldown", s.cooldownMs.toFloat(), 300f..3000f, 26, { "${it.toInt()} ms" },
        ) { v -> vm.update { it.copy(cooldownMs = v.toInt()) } }
        Button(onClick = onCalibrate) { Text("Calibrate eye tracking") }
    }
}

@Composable
private fun PrivacyCard() {
    SectionCard("Privacy") {
        Text(
            "Eye tracking runs entirely on this device with MediaPipe. Camera frames are analysed in " +
                "memory and discarded immediately — they are never recorded, saved or uploaded. " +
                "MangaFlow does not even request internet permission.",
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            content()
        }
    }
}

/** Slider keeping a local value while dragging; persists once on release. */
@Composable
private fun SettingSlider(
    label: String,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    steps: Int,
    format: (Float) -> String,
    onCommit: (Float) -> Unit,
) {
    var local by remember(value) { mutableFloatStateOf(value) }
    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, style = MaterialTheme.typography.titleSmall)
            Text(format(local), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.primary)
        }
        Slider(
            value = local,
            onValueChange = { local = it },
            onValueChangeFinished = { onCommit(local) },
            valueRange = range,
            steps = steps,
        )
    }
}
