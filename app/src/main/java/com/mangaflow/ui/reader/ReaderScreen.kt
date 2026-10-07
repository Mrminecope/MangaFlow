package com.mangaflow.ui.reader

import android.app.Activity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.animateScrollBy
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsDraggedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.RemoveRedEye
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconToggleButton
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.min
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.Coil
import coil.compose.AsyncImage
import coil.request.ImageRequest
import coil.size.Size
import com.mangaflow.MangaFlowApp
import com.mangaflow.data.AppSettings
import com.mangaflow.data.MangaPage
import com.mangaflow.data.ScrollMode
import com.mangaflow.eye.TrackerStatus
import com.mangaflow.ui.findActivity
import com.mangaflow.ui.rememberCameraPermission
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File

private val MaxPageWidth = 900.dp

@Composable
fun ReaderScreen(
    onBack: () -> Unit,
    onSettings: () -> Unit,
    vm: ReaderViewModel = viewModel(factory = ReaderViewModel.Factory),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val view = LocalView.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val permission = rememberCameraPermission()
    val tracker = remember { (context.applicationContext as MangaFlowApp).container.eyeTracker }

    // Immersive reading + keep the screen awake (hands-free reading would otherwise time out).
    DisposableEffect(view) {
        val window = (context.findActivity() as? Activity)?.window
        val controller = window?.let { WindowCompat.getInsetsController(it, view) }
        controller?.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        controller?.hide(WindowInsetsCompat.Type.systemBars())
        view.keepScreenOn = true
        onDispose {
            controller?.show(WindowInsetsCompat.Type.systemBars())
            view.keepScreenOn = false
        }
    }

    // Camera runs only while the reader is visible, eye control is on and permission is granted.
    val eyeActive = settings.eyeControlEnabled && permission.granted
    DisposableEffect(eyeActive, lifecycleOwner) {
        if (eyeActive) tracker.start(lifecycleOwner)
        onDispose { if (eyeActive) tracker.stop(lifecycleOwner) }
    }

    Box(Modifier.fillMaxSize().background(Color.Black)) {
        when {
            ui.loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
            ui.pages.isEmpty() -> Text("No pages", Modifier.align(Alignment.Center), color = Color.White)
            else -> ReaderContent(vm, ui, settings, onBack, onSettings)
        }

        if (settings.eyeControlEnabled && !permission.granted) {
            Card(Modifier.align(Alignment.BottomCenter).safeDrawingPadding().padding(24.dp).width(420.dp)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Camera access needed", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "MangaFlow uses the front camera only to detect when your eyes close. " +
                            "Frames are analysed on this device and are never saved or uploaded.",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = permission.request) { Text("Allow camera") }
                        androidx.compose.material3.TextButton(onClick = { vm.setEyeControl(false) }) {
                            Text("Turn off eye control")
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class, FlowPreview::class)
@Composable
private fun ReaderContent(
    vm: ReaderViewModel,
    ui: ReaderUiState,
    settings: AppSettings,
    onBack: () -> Unit,
    onSettings: () -> Unit,
) {
    val context = LocalContext.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    val listState = rememberLazyListState(initialFirstVisibleItemIndex = ui.startIndex)
    val dragged by listState.interactionSource.collectIsDraggedAsState()
    val currentPage by remember { derivedStateOf { listState.firstVisibleItemIndex } }

    // --- Eye-triggered smooth scroll step (or auto-scroll pause toggle) ---
    LaunchedEffect(listState) {
        vm.events.collect { event ->
            when (event) {
                ReaderEvent.ScrollStep -> {
                    val s = vm.settings.value
                    val distance = listState.layoutInfo.viewportSize.height * s.scrollDistancePct / 100f
                    listState.animateScrollBy(
                        distance,
                        tween(durationMillis = s.stepDurationMs, easing = FastOutSlowInEasing),
                    )
                }
                ReaderEvent.ToggleAuto -> vm.toggleAuto()
            }
        }
    }

    // --- Auto scroll: frame-synced constant velocity, pauses while the user drags ---
    LaunchedEffect(listState, settings.mode, ui.autoRunning, dragged, settings.autoSpeedDpPerSec) {
        if (settings.mode != ScrollMode.AUTO || !ui.autoRunning || dragged) return@LaunchedEffect
        val pxPerSec = with(density) { settings.autoSpeedDpPerSec.dp.toPx() }
        var last = 0L
        while (isActive) {
            val now = androidx.compose.runtime.withFrameNanos { it }
            if (last != 0L) {
                listState.dispatchRawDelta(pxPerSec * (now - last) / 1_000_000_000f)
                if (!listState.canScrollForward) {
                    vm.setAutoRunning(false)
                    break
                }
            }
            last = now
        }
    }

    // --- Persist reading position ---
    LaunchedEffect(listState) {
        androidx.compose.runtime.snapshotFlow { listState.firstVisibleItemIndex }
            .debounce(600)
            .collect { vm.saveProgress(it) }
    }

    BoxWithConstraints(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        val pageWidth = min(maxWidth, MaxPageWidth) // comfortable column on 10-13" tablets
        val widthPx = with(density) { pageWidth.roundToPx() }

        // Warm the image cache for the next pages so scrolling never shows blank frames.
        LaunchedEffect(listState, ui.pages, widthPx) {
            androidx.compose.runtime.snapshotFlow { listState.firstVisibleItemIndex }.collect { first ->
                val loader = Coil.imageLoader(context)
                for (k in first + 1..first + PREFETCH) {
                    val p = ui.pages.getOrNull(k) ?: break
                    loader.enqueue(pageRequest(context, p, widthPx))
                }
            }
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .width(pageWidth)
                .fillMaxHeight()
                .clickable(
                    interactionSource = remember { MutableInteractionSource() },
                    indication = null,
                    onClick = vm::toggleOverlay,
                ),
        ) {
            items(ui.pages, key = { it.path }) { page ->
                AsyncImage(
                    model = pageRequest(context, page, widthPx),
                    contentDescription = null,
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().aspectRatio(page.aspectRatio),
                )
            }
        }
    }

    // --- Always-visible, tiny eye status (only if eye control is on) ---
    if (settings.eyeControlEnabled) {
        Box(Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp), contentAlignment = Alignment.CenterEnd) {
            EyeIndicator(vm)
        }
    }

    // --- Overlay controls ---
    Box(Modifier.fillMaxSize().safeDrawingPadding()) {
        AnimatedVisibility(
            visible = ui.overlayVisible,
            modifier = Modifier.align(Alignment.TopCenter),
            enter = fadeIn(), exit = fadeOut(),
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                modifier = Modifier.padding(12.dp).fillMaxWidth(),
            ) {
                Row(
                    Modifier.padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") }
                    Text(
                        ui.title,
                        modifier = Modifier.weight(1f),
                        maxLines = 1, overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.titleMedium,
                    )
                    Text("${currentPage + 1} / ${ui.pages.size}", style = MaterialTheme.typography.labelLarge)
                    SingleChoiceSegmentedButtonRow {
                        ScrollMode.entries.forEachIndexed { i, m ->
                            SegmentedButton(
                                selected = settings.mode == m,
                                onClick = { vm.setMode(m) },
                                shape = SegmentedButtonDefaults.itemShape(i, ScrollMode.entries.size),
                            ) { Text(if (m == ScrollMode.AUTO) "Auto" else "Manual") }
                        }
                    }
                    FilledIconToggleButton(
                        checked = settings.eyeControlEnabled,
                        onCheckedChange = vm::setEyeControl,
                    ) { Icon(Icons.Default.RemoveRedEye, "Eye control") }
                    IconButton(onClick = onSettings) { Icon(Icons.Default.Settings, "Settings") }
                }
            }
        }

        AnimatedVisibility(
            visible = ui.overlayVisible,
            modifier = Modifier.align(Alignment.BottomCenter),
            enter = fadeIn(), exit = fadeOut(),
        ) {
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
                shape = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
                modifier = Modifier.padding(12.dp).widthIn(max = 720.dp).fillMaxWidth(),
            ) {
                Row(
                    Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (settings.mode == ScrollMode.AUTO) {
                        FilledTonalIconButton(onClick = vm::toggleAuto) {
                            Icon(
                                if (ui.autoRunning) Icons.Default.Pause else Icons.Default.PlayArrow,
                                if (ui.autoRunning) "Pause" else "Play",
                            )
                        }
                    }
                    Slider(
                        value = currentPage.toFloat(),
                        onValueChange = { v -> scope.launch { listState.scrollToItem(v.toInt()) } },
                        valueRange = 0f..(ui.pages.size - 1).coerceAtLeast(1).toFloat(),
                        modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                    )
                }
            }
        }
    }
}

private const val PREFETCH = 3

/** Same request (incl. explicit size => same cache key) for display and prefetch. */
private fun pageRequest(context: android.content.Context, page: MangaPage, widthPx: Int): ImageRequest =
    ImageRequest.Builder(context)
        .data(File(page.path))
        .size(Size(widthPx, (widthPx / page.aspectRatio).toInt().coerceIn(1, 8192)))
        .build()

@Composable
private fun EyeIndicator(vm: ReaderViewModel) {
    val progress by vm.closeProgress.collectAsStateWithLifecycle()
    val face by vm.faceVisible.collectAsStateWithLifecycle()
    val status by vm.trackerStatus.collectAsStateWithLifecycle()
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            Modifier.size(56.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.55f)),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator(
                progress = { progress },
                modifier = Modifier.size(52.dp),
                strokeWidth = 4.dp,
                color = MaterialTheme.colorScheme.primary,
                trackColor = Color.White.copy(alpha = 0.15f),
            )
            Icon(
                if (face) Icons.Default.RemoveRedEye else Icons.Default.VisibilityOff,
                contentDescription = if (face) "Face detected" else "No face detected",
                tint = if (face) Color.White else Color.White.copy(alpha = 0.4f),
            )
        }
        if (status is TrackerStatus.Error) {
            Text(
                (status as TrackerStatus.Error).message,
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.labelSmall,
                modifier = Modifier.width(120.dp),
            )
        }
    }
}
