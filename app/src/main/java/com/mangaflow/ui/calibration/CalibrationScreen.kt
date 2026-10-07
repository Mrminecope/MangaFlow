package com.mangaflow.ui.calibration

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.mangaflow.MangaFlowApp
import com.mangaflow.ui.rememberCameraPermission

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalibrationScreen(
    onBack: () -> Unit,
    vm: CalibrationViewModel = viewModel(factory = CalibrationViewModel.Factory),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val permission = rememberCameraPermission()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val tracker = remember { (context.applicationContext as MangaFlowApp).container.eyeTracker }

    DisposableEffect(permission.granted, lifecycleOwner) {
        if (permission.granted) tracker.start(lifecycleOwner)
        onDispose { if (permission.granted) tracker.stop(lifecycleOwner) }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Calibrate eye tracking") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                },
            )
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
            Column(
                Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(32.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(24.dp),
            ) {
                val (title, body) = when (ui.phase) {
                    CalibrationPhase.INTRO ->
                        "Let's tune MangaFlow to your eyes" to
                            "Hold the tablet at reading distance. First you'll look at the screen normally, " +
                            "then you'll close your eyes when you hear a beep, and open them at the second beep."
                    CalibrationPhase.OPEN_EYES ->
                        "Look at the screen" to "Keep your eyes naturally open… ${ui.secondsLeft}"
                    CalibrationPhase.GET_READY ->
                        "Get ready" to "When you hear the beep, close both eyes. Starting in ${ui.secondsLeft}…"
                    CalibrationPhase.CLOSE_EYES ->
                        "Close your eyes" to "Keep them closed until you hear the second beep."
                    CalibrationPhase.SUCCESS ->
                        "Calibration saved" to
                            "Open-eye level %.0f%%, closed-eye level %.0f%%. You can fine-tune with Sensitivity in Settings."
                                .format(ui.openValue * 100, ui.closedValue * 100)
                    CalibrationPhase.FAILED -> "Calibration failed" to (ui.error ?: "")
                }
                Text(title, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)
                Text(
                    body,
                    style = MaterialTheme.typography.bodyLarge,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )

                LiveMeter(vm)

                val running = ui.phase in setOf(
                    CalibrationPhase.OPEN_EYES, CalibrationPhase.GET_READY, CalibrationPhase.CLOSE_EYES,
                )
                when {
                    !permission.granted -> Button(onClick = permission.request) { Text("Allow camera") }
                    running -> OutlinedButton(onClick = vm::reset) { Text("Cancel") }
                    ui.phase == CalibrationPhase.SUCCESS -> Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        OutlinedButton(onClick = vm::start) { Text("Redo") }
                        Button(onClick = onBack) { Text("Done") }
                    }
                    else -> Button(onClick = vm::start) {
                        Text(if (ui.phase == CalibrationPhase.FAILED) "Try again" else "Start")
                    }
                }
                Text(
                    "The camera image is analysed on-device and never stored or sent anywhere.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                )
            }
        }
    }
}

/** Live eye-closure bar so users can see that tracking works. Isolated to limit recomposition. */
@Composable
private fun LiveMeter(vm: CalibrationViewModel) {
    val sample by vm.live.collectAsStateWithLifecycle()
    Column(Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            if (sample.faceDetected) "Face detected" else "No face detected",
            style = MaterialTheme.typography.labelLarge,
            color = if (sample.faceDetected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
        )
        LinearProgressIndicator(
            progress = { if (sample.faceDetected) sample.closure.coerceIn(0f, 1f) else 0f },
            modifier = Modifier.fillMaxWidth().height(12.dp),
        )
        Text("Eye closure", style = MaterialTheme.typography.bodySmall)
    }
}
