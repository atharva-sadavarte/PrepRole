package com.preprole.media

import android.app.Activity
import android.content.Intent
import android.media.MediaMetadataRetriever
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
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

class InterviewMediaModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private var mediaRecorder: MediaRecorder? = null
    private var mediaPlayer: MediaPlayer? = null
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
        try {
            stopAudioPlaybackInternal()

            val player = MediaPlayer()
            val uri = Uri.parse(uriString)

            if (uri.scheme == "file") {
                val filePath = uri.path ?: uriString.replace("file://", "")
                player.setDataSource(filePath)
            } else {
                player.setDataSource(reactContext, uri)
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
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERR_PLAY_AUDIO", e.message, e)
        }
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
}
