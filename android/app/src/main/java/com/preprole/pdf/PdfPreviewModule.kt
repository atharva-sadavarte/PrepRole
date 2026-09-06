package com.preprole.pdf

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileOutputStream

class PdfPreviewModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "PdfPreviewModule"

    @ReactMethod
    fun renderPdfPages(uriString: String, maxPages: Int, promise: Promise) {
        Thread {
            var fileDescriptor: ParcelFileDescriptor? = null
            var renderer: PdfRenderer? = null
            try {
                val uri = Uri.parse(uriString)
                fileDescriptor = if (uri.scheme == "content") {
                    reactContext.contentResolver.openFileDescriptor(uri, "r")
                } else if (uri.scheme == "file") {
                    val filePath = uri.path ?: uriString.replace("file://", "")
                    val file = File(filePath)
                    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                } else {
                    val file = File(uriString)
                    ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                }

                if (fileDescriptor == null) {
                    promise.reject("ERR_OPEN", "Could not open file descriptor for URI: $uriString")
                    return@Thread
                }

                renderer = PdfRenderer(fileDescriptor)
                val totalPageCount = renderer.pageCount
                val renderLimit = if (maxPages > 0) Math.min(totalPageCount, maxPages) else totalPageCount

                val cacheDir = File(reactContext.cacheDir, "pdf_previews")
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs()
                }

                val pageUris = WritableNativeArray()
                val pageHeights = WritableNativeArray()
                val pageWidths = WritableNativeArray()

                for (i in 0 until renderLimit) {
                    val page = renderer.openPage(i)
                    // High-DPI scale (2x) so text is crisp and clear
                    val scale = 2
                    val width = Math.max(1, page.width * scale)
                    val height = Math.max(1, page.height * scale)

                    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                    bitmap.eraseColor(Color.WHITE)

                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    page.close()

                    val outFile = File(cacheDir, "preview_page_${System.currentTimeMillis()}_$i.png")
                    val outputStream = FileOutputStream(outFile)
                    bitmap.compress(Bitmap.CompressFormat.PNG, 95, outputStream)
                    outputStream.flush()
                    outputStream.close()
                    bitmap.recycle()

                    pageUris.pushString("file://" + outFile.absolutePath)
                    pageWidths.pushInt(width)
                    pageHeights.pushInt(height)
                }

                val result = WritableNativeMap().apply {
                    putInt("pageCount", totalPageCount)
                    putArray("pageUris", pageUris)
                    putArray("pageWidths", pageWidths)
                    putArray("pageHeights", pageHeights)
                }

                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ERR_RENDER", e.message, e)
            } finally {
                try {
                    renderer?.close()
                } catch (_: Exception) {}
                try {
                    fileDescriptor?.close()
                } catch (_: Exception) {}
            }
        }.start()
    }

    @ReactMethod
    fun openSystemViewer(uriString: String, promise: Promise) {
        try {
            val uri = Uri.parse(uriString)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/pdf")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val chooser = Intent.createChooser(intent, "Open Resume PDF").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_OPEN", e.message, e)
        }
    }

    @ReactMethod
    fun getPdfBase64(uriString: String, promise: Promise) {
        Thread {
            try {
                val uri = Uri.parse(uriString)
                val inputStream = if (uri.scheme == "content") {
                    reactContext.contentResolver.openInputStream(uri)
                } else if (uri.scheme == "file") {
                    val filePath = uri.path ?: uriString.replace("file://", "")
                    java.io.FileInputStream(File(filePath))
                } else {
                    java.io.FileInputStream(File(uriString))
                }

                if (inputStream == null) {
                    promise.reject("ERR_OPEN", "Could not open stream for URI: $uriString")
                    return@Thread
                }

                val bytes = inputStream.readBytes()
                inputStream.close()
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                promise.resolve(base64)
            } catch (e: Exception) {
                promise.reject("ERR_BASE64", e.message, e)
            }
        }.start()
    }
}
