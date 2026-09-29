package com.preprole.media

import android.app.Activity
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Base64
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.util.Locale

class InterviewMediaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
    private var textToSpeech: TextToSpeech? = null
    private var isTtsInitialized: Boolean = false
    private var currentAudioFile: File? = null
    private var recordingStartTime: Long = 0L

    private var videoCapturePromise: Promise? = null
    private val VIDEO_CAPTURE_REQUEST_CODE = 4421

    private val activityEventListener: ActivityEventListener =
        object : BaseActivityEventListener() {
            override fun onActivityResult(
                activity: Activity,
                requestCode: Int,
                resultCode: Int,
                data: Intent?
            ) {
                if (requestCode == VIDEO_CAPTURE_REQUEST_CODE) {
                    val promise = videoCapturePromise ?: return
                    videoCapturePromise = null

                    if (resultCode == Activity.RESULT_OK && data != null && data.data != null) {
                        val videoUri = data.data!!
                        Thread {
                            try {
                                var durationSeconds = 60
                                val retriever = MediaMetadataRetriever()
                                try {
                                    retriever.setDataSource(reactContext, videoUri)
                                    val durationStr = retriever.extractMetadata(
                                        MediaMetadataRetriever.METADATA_KEY_DURATION
                                    )
                                    if (durationStr != null) {
                                        val durationMs = durationStr.toLong()
                                        durationSeconds = Math.max(1, (durationMs / 1000).toInt())
                                    }
                                } catch (e: Exception) {
                                    // Ignore metadata parsing error
                                } finally {
                                    try {
                                        retriever.release()
                                    } catch (e: Exception) {}
                                }

                                val inputStream: InputStream? =
                                    reactContext.contentResolver.openInputStream(videoUri)
                                val bytes = inputStream?.readBytes() ?: ByteArray(0)
                                inputStream?.close()
                                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

                                val result = WritableNativeMap()
                                result.putString("uri", videoUri.toString())
                                result.putInt("durationSeconds", durationSeconds)
                                result.putString("mimeType", "video/mp4")
                                result.putString("base64", base64)
                                promise.resolve(result)
                            } catch (e: Exception) {
                                promise.reject("ERR_VIDEO_PROCESS", e.message, e)
                            }
                        }.start()
                    } else if (resultCode == Activity.RESULT_CANCELED) {
                        promise.reject("ERR_CANCELLED", "Video recording was cancelled by user")
                    } else {
                        promise.reject("ERR_FAILED", "Video recording failed or no data returned")
                    }
                }
            }
        }

    init {
        reactContext.addActivityEventListener(activityEventListener)
        initTts(null)
    }

    private fun initTts(onReady: (() -> Unit)?) {
        try {
            textToSpeech = TextToSpeech(reactContext.applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    isTtsInitialized = true
                    try {
                        textToSpeech?.language = Locale.US
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            val attrs = AudioAttributes.Builder()
                                .setUsage(AudioAttributes.USAGE_MEDIA)
                                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                .build()
                            textToSpeech?.setAudioAttributes(attrs)
                        }
                        textToSpeech?.setSpeechRate(0.83f)
                        textToSpeech?.setPitch(1.0f)
                    } catch (e: Exception) {}
                    onReady?.invoke()
                } else {
                    isTtsInitialized = false
                }
            }
        } catch (e: Exception) {
            isTtsInitialized = false
        }
    }

    override fun getName(): String = "InterviewMediaModule"

    @ReactMethod
    fun startAudioRecording(promise: Promise) {
        try {
            stopAudioPlaybackInternal()
            stopAudioRecordingInternal()

            val dir = File(reactContext.cacheDir, "interview_recordings")
            if (!dir.exists()) {
                dir.mkdirs()
            }
            val audioFile = File(dir, "interview_audio_${System.currentTimeMillis()}.m4a")
            currentAudioFile = audioFile

            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(reactContext)
            } else {
                @Suppress("DEPRECATION")
                MediaRecorder()
            }

            recorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            recorder.setAudioSamplingRate(44100)
            recorder.setAudioEncodingBitRate(128000)
            recorder.setOutputFile(audioFile.absolutePath)
            recorder.prepare()
            recorder.start()

            mediaRecorder = recorder
            recordingStartTime = System.currentTimeMillis()

            val map = WritableNativeMap()
            map.putBoolean("success", true)
            map.putString("filePath", audioFile.absolutePath)
            promise.resolve(map)
        } catch (e: Exception) {
            currentAudioFile = null
            mediaRecorder = null
            promise.reject("ERR_START_RECORD", e.message, e)
        }
    }

    @ReactMethod
    fun stopAudioRecording(promise: Promise) {
        val recorder = mediaRecorder
        val audioFile = currentAudioFile
        val startTime = recordingStartTime

        if (recorder == null || audioFile == null) {
            promise.reject("ERR_NO_RECORDING", "No active audio recording session found")
            return
        }

        try {
            recorder.stop()
            recorder.release()
            mediaRecorder = null
        } catch (e: Exception) {
            mediaRecorder = null
            promise.reject("ERR_STOP_RECORD", "Failed to finalize audio recording: " + e.message, e)
            return
        }

        val elapsedMs = System.currentTimeMillis() - startTime
        val durationSeconds = Math.max(1, (elapsedMs / 1000).toInt())

        Thread {
            try {
                val bytes = audioFile.readBytes()
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)

                val result = WritableNativeMap()
                result.putString("uri", "file://${audioFile.absolutePath}")
                result.putInt("durationSeconds", durationSeconds)
                result.putString("mimeType", "audio/mp4")
                result.putString("base64", base64)
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ERR_READ_FILE", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun cancelAudioRecording(promise: Promise) {
        try {
            stopAudioRecordingInternal()
            currentAudioFile?.delete()
            currentAudioFile = null
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_CANCEL_RECORD", e.message, e)
        }
    }

    @ReactMethod
    fun startAudioPlayback(uriString: String, promise: Promise) {
        Thread {
            try {
                stopAudioPlaybackInternal()

                val player = MediaPlayer()
                val uri = Uri.parse(uriString)

                if (uri.scheme == "file") {
                    val filePath = uri.path ?: uriString.replace("file://", "")
                    player.setDataSource(filePath)
                } else {
                    player.setDataSource(reactContext.applicationContext, uri)
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    val attrs = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                    player.setAudioAttributes(attrs)
                }

                player.setOnCompletionListener {
                    stopAudioPlaybackInternal()
                }
                player.prepare()
                player.start()
                mediaPlayer = player

                val map = WritableNativeMap()
                map.putBoolean("playing", true)
                map.putInt("durationMs", player.duration)
                Handler(Looper.getMainLooper()).post {
                    promise.resolve(map)
                }
            } catch (e: Exception) {
                Handler(Looper.getMainLooper()).post {
                    promise.reject("ERR_PLAY_AUDIO", e.message, e)
                }
            }
        }.start()
    }

    @ReactMethod
    fun stopAudioPlayback(promise: Promise) {
        try {
            stopAudioPlaybackInternal()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_STOP_PLAYBACK", e.message, e)
        }
    }

    @ReactMethod
    fun captureVideo(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("ERR_NO_ACTIVITY", "No current activity to launch camera")
            return
        }

        if (videoCapturePromise != null) {
            promise.reject("ERR_IN_PROGRESS", "A video capture session is already pending")
            return
        }

        try {
            val intent = Intent(MediaStore.ACTION_VIDEO_CAPTURE)
            intent.putExtra(MediaStore.EXTRA_DURATION_LIMIT, 90) // 90 seconds limit
            intent.putExtra(MediaStore.EXTRA_VIDEO_QUALITY, 0) // 0 = low/compact quality for efficient upload
            intent.putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
            intent.putExtra("android.intent.extras.CAMERA_FACING", 1) // Front camera

            videoCapturePromise = promise
            activity.startActivityForResult(intent, VIDEO_CAPTURE_REQUEST_CODE)
        } catch (e: Exception) {
            videoCapturePromise = null
            promise.reject("ERR_LAUNCH_CAMERA", e.message, e)
        }
    }

    @ReactMethod
    fun readFileAsBase64(uriString: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(uriString)
                val bytes: ByteArray = if (uri.scheme == "content") {
                    val inputStream = reactContext.contentResolver.openInputStream(uri)
                    val data = inputStream?.readBytes() ?: ByteArray(0)
                    inputStream?.close()
                    data
                } else {
                    val path = uri.path ?: uriString.replace("file://", "")
                    File(path).readBytes()
                }
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                promise.resolve(base64)
            } catch (e: Exception) {
                promise.reject("ERR_BASE64", e.message, e)
            }
        }.start()
    }

    private fun stopAudioRecordingInternal() {
        try {
            mediaRecorder?.stop()
        } catch (e: Exception) {}
        try {
            mediaRecorder?.release()
        } catch (e: Exception) {}
        mediaRecorder = null
    }

    private fun stopAudioPlaybackInternal() {
        try {
            if (mediaPlayer?.isPlaying == true) {
                mediaPlayer?.stop()
            }
        } catch (e: Exception) {}
        try {
            mediaPlayer?.release()
        } catch (e: Exception) {}
        mediaPlayer = null
    }

    @ReactMethod
    fun speakText(text: String, languageTag: String, promise: Promise) {
        speakTextInternal(text, languageTag, 0.83f, promise)
    }

    @ReactMethod
    fun speakTextWithRate(text: String, languageTag: String, rate: Double, promise: Promise) {
        val speechRate = if (rate in 0.5..2.0) rate.toFloat() else 0.83f
        speakTextInternal(text, languageTag, speechRate, promise)
    }

    private fun speakTextInternal(text: String, languageTag: String, speechRate: Float, promise: Promise) {
        Handler(Looper.getMainLooper()).post {
            val doSpeak = {
                val tts = textToSpeech
                if (tts == null) {
                    promise.reject("ERR_TTS_UNAVAILABLE", "TextToSpeech engine is not available")
                } else {
                    try {
                        val locale = if (languageTag.isNotEmpty()) Locale.forLanguageTag(languageTag) else Locale.US
                        tts.language = locale
                    } catch (e: Exception) {
                        tts.language = Locale.US
                    }

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        val attrs = AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build()
                        tts.setAudioAttributes(attrs)
                    }
                    tts.setSpeechRate(speechRate)
                    tts.setPitch(1.0f)

                    val utteranceId = "utterance_${System.currentTimeMillis()}"
                    var isResolved = false

                    tts.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                        override fun onStart(id: String?) {}
                        override fun onDone(id: String?) {
                            if (!isResolved && id == utteranceId) {
                                isResolved = true
                                val map = WritableNativeMap()
                                map.putBoolean("success", true)
                                map.putString("utteranceId", utteranceId)
                                Handler(Looper.getMainLooper()).post {
                                    promise.resolve(map)
                                }
                            }
                        }
                        override fun onError(id: String?) {
                            if (!isResolved && id == utteranceId) {
                                isResolved = true
                                Handler(Looper.getMainLooper()).post {
                                    promise.reject("ERR_TTS_PLAY", "TTS playback failed for $id")
                                }
                            }
                        }
                    })

                    tts.stop()
                    val res = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, utteranceId)
                    if (res != TextToSpeech.SUCCESS) {
                        if (!isResolved) {
                            isResolved = true
                            promise.reject("ERR_TTS_QUEUE", "Failed to queue TTS utterance (code $res)")
                        }
                    } else {
                        // Safety fallback timer if onDone is not invoked by engine
                        val timeoutMs = Math.max(7000L, (text.length * 140).toLong())
                        Handler(Looper.getMainLooper()).postDelayed({
                            if (!isResolved) {
                                isResolved = true
                                val map = WritableNativeMap()
                                map.putBoolean("success", true)
                                map.putString("utteranceId", utteranceId)
                                promise.resolve(map)
                            }
                        }, timeoutMs)
                    }
                }
            }

            if (textToSpeech == null || !isTtsInitialized) {
                initTts {
                    doSpeak()
                }
            } else {
                doSpeak()
            }
        }
    }

    @ReactMethod
    fun stopSpeech(promise: Promise) {
        try {
            textToSpeech?.stop()
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_TTS_STOP", e.message, e)
        }
    }
}
