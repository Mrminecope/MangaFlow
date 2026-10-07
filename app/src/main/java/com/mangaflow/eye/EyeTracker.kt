package com.mangaflow.eye

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.SystemClock
import android.util.Log
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker
import com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarkerResult
import kotlinx.coroutines.channels.BufferOverflow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

sealed interface TrackerStatus {
    data object Idle : TrackerStatus
    data object Running : TrackerStatus
    data class Error(val message: String) : TrackerStatus
}

/**
 * On-device eye tracker: CameraX [ImageAnalysis] -> MediaPipe Face Landmarker (blendshapes).
 *
 * Privacy: there is no [androidx.camera.core.Preview], no VideoCapture / ImageCapture, no file
 * writes and the app has no INTERNET permission. Each frame is analysed in memory and dropped.
 *
 * One instance is shared app-wide (see MangaFlowApp). Screens call [start]/[stop] with their own
 * lifecycle owner; [stop] from a screen that has already been superseded is ignored so
 * navigation transitions never kill the camera of the incoming screen.
 */
class EyeTracker(context: Context) {

    private val appContext = context.applicationContext
    private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    private val _samples = MutableSharedFlow<EyeSample>(
        extraBufferCapacity = 64,
        onBufferOverflow = BufferOverflow.DROP_OLDEST,
    )
    /** Every analysed sample (use for the blink state machine). */
    val samples: SharedFlow<EyeSample> = _samples.asSharedFlow()

    private val _latest = MutableStateFlow(EyeSample.NONE)
    /** Latest sample (use for UI indicators). */
    val latest: StateFlow<EyeSample> = _latest.asStateFlow()

    private val _status = MutableStateFlow<TrackerStatus>(TrackerStatus.Idle)
    val status: StateFlow<TrackerStatus> = _status.asStateFlow()

    @Volatile private var landmarker: FaceLandmarker? = null
    private var owner: LifecycleOwner? = null
    private var lastTimestamp = 0L

    /** Must be called on the main thread, after CAMERA permission was granted. */
    fun start(lifecycleOwner: LifecycleOwner) {
        owner = lifecycleOwner
        _status.value = TrackerStatus.Idle
        analysisExecutor.execute { ensureLandmarker() }

        val future = ProcessCameraProvider.getInstance(appContext)
        future.addListener({
            if (owner !== lifecycleOwner) return@addListener
            try {
                val provider = future.get()
                if (!provider.hasCamera(CameraSelector.DEFAULT_FRONT_CAMERA)) {
                    _status.value = TrackerStatus.Error("No front camera available")
                    return@addListener
                }
                val analysis = ImageAnalysis.Builder()
                    .setResolutionSelector(
                        ResolutionSelector.Builder()
                            .setResolutionStrategy(
                                ResolutionStrategy(
                                    Size(640, 480),
                                    ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER,
                                ),
                            ).build(),
                    )
                    .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                    .setOutputImageFormat(ImageAnalysis.OUTPUT_IMAGE_FORMAT_RGBA_8888)
                    .build()
                    .also { it.setAnalyzer(analysisExecutor, ::analyze) }

                provider.unbindAll()
                provider.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, analysis)
                _status.value = TrackerStatus.Running
            } catch (t: Throwable) {
                Log.e(TAG, "Camera start failed", t)
                _status.value = TrackerStatus.Error(t.message ?: "Camera error")
            }
        }, ContextCompat.getMainExecutor(appContext))
    }

    fun stop(lifecycleOwner: LifecycleOwner) {
        if (owner !== lifecycleOwner) return
        owner = null
        runCatching { ProcessCameraProvider.getInstance(appContext).get().unbindAll() }
        analysisExecutor.execute {
            landmarker?.close()
            landmarker = null
        }
        _latest.value = EyeSample.NONE
        _status.value = TrackerStatus.Idle
    }

    private fun ensureLandmarker(): FaceLandmarker? {
        landmarker?.let { return it }
        return try {
            val options = FaceLandmarker.FaceLandmarkerOptions.builder()
                .setBaseOptions(BaseOptions.builder().setModelAssetPath(MODEL_ASSET).build())
                .setRunningMode(RunningMode.LIVE_STREAM)
                .setNumFaces(1)
                .setOutputFaceBlendshapes(true)
                .setMinFaceDetectionConfidence(0.5f)
                .setMinFacePresenceConfidence(0.5f)
                .setMinTrackingConfidence(0.5f)
                .setResultListener { result, _ -> onResult(result) }
                .setErrorListener { e ->
                    Log.e(TAG, "FaceLandmarker error", e)
                }
                .build()
            FaceLandmarker.createFromOptions(appContext, options).also { landmarker = it }
        } catch (t: Throwable) {
            Log.e(TAG, "Cannot create FaceLandmarker", t)
            _status.value = TrackerStatus.Error("Eye model failed to load: ${t.message}")
            null
        }
    }

    private fun analyze(image: ImageProxy) {
        try {
            val lm = ensureLandmarker() ?: return
            val src = image.toBitmap()
            val matrix = Matrix().apply { postRotate(image.imageInfo.rotationDegrees.toFloat()) }
            val upright = Bitmap.createBitmap(src, 0, 0, src.width, src.height, matrix, false)
            if (upright !== src) src.recycle()

            var ts = SystemClock.uptimeMillis()
            if (ts <= lastTimestamp) ts = lastTimestamp + 1
            lastTimestamp = ts
            lm.detectAsync(BitmapImageBuilder(upright).build(), ts)
        } catch (t: Throwable) {
            Log.w(TAG, "Frame analysis failed", t)
        } finally {
            image.close() // frame is dropped right here; nothing is persisted
        }
    }

    private fun onResult(result: FaceLandmarkerResult) {
        val ts = SystemClock.uptimeMillis()
        val shapes = result.faceBlendshapes().orElse(null)?.firstOrNull()
        val sample = if (shapes == null) {
            EyeSample(ts, false, 0f, 0f)
        } else {
            var l = 0f
            var r = 0f
            for (c in shapes) {
                when (c.categoryName()) {
                    "eyeBlinkLeft" -> l = c.score()
                    "eyeBlinkRight" -> r = c.score()
                }
            }
            EyeSample(ts, true, l, r)
        }
        _latest.value = sample
        _samples.tryEmit(sample)
    }

    companion object {
        private const val TAG = "EyeTracker"
        private const val MODEL_ASSET = "face_landmarker.task"
    }
}
