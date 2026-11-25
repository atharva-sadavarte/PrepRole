package com.preprole.pdf

import android.content.ClipData
import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import com.tom_roush.pdfbox.pdmodel.PDDocument
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

class PdfPreviewModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    @Volatile
    private var pdfBoxInitialized = false

    override fun getName(): String = "PdfPreviewModule"

    private fun ensurePdfBoxInitialized() {
        if (!pdfBoxInitialized) {
            synchronized(this) {
                if (!pdfBoxInitialized) {
                    PDFBoxResourceLoader.init(reactContext.applicationContext)
                    pdfBoxInitialized = true
                }
            }
        }
    }

    private fun openInputStreamForUri(uriString: String): InputStream? {
        val uri = Uri.parse(uriString)
        return when (uri.scheme) {
            "content" -> reactContext.contentResolver.openInputStream(uri)
            "file" -> {
                val filePath = uri.path ?: uriString.replace("file://", "")
                FileInputStream(File(filePath))
            }
            else -> FileInputStream(File(uriString))
        }
    }

    private fun resolveToLocalReadableFile(uriString: String, tempPrefix: String = "pdf_work"): File {
        val uri = Uri.parse(uriString)
        if (uri.scheme == "file" || uri.scheme == null) {
            val path = uri.path ?: uriString.replace("file://", "")
            val f = File(path)
            if (f.exists() && f.canRead()) {
                return f
            }
        }
        val cacheDir = File(reactContext.cacheDir, "pdf_cache")
        if (!cacheDir.exists()) cacheDir.mkdirs()
        val destFile = File(cacheDir, "${tempPrefix}_${System.currentTimeMillis()}.pdf")
        val input = openInputStreamForUri(uriString)
            ?: throw IllegalStateException("Could not open PDF stream for URI: $uriString")
        input.use { ins ->
            FileOutputStream(destFile).use { out ->
                ins.copyTo(out)
            }
        }
        return destFile
    }

    private fun resolveShareableUri(uriString: String): Uri {
        val uri = Uri.parse(uriString)
        if (uri.scheme == "content" || uri.scheme == "http" || uri.scheme == "https") {
            return uri
        }
        val path = uri.path ?: uriString.replace("file://", "")
        val file = File(path)
        return FileProvider.getUriForFile(
            reactContext,
            "${reactContext.packageName}.fileprovider",
            file,
        )
    }

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
            val contentUri = resolveShareableUri(uriString)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/pdf")
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
                clipData = ClipData.newRawUri("Resume PDF", contentUri)
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
    fun sharePdfFile(uriString: String, title: String?, promise: Promise) {
        try {
            val contentUri = resolveShareableUri(uriString)
            val intent = Intent(Intent.ACTION_SEND).apply {
                type = "application/pdf"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                putExtra(Intent.EXTRA_SUBJECT, title ?: "Updated Resume PDF")
                clipData = ClipData.newRawUri(title ?: "Resume PDF", contentUri)
                flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK
            }
            val chooser = Intent.createChooser(intent, title ?: "Share Updated Resume PDF").apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SHARE", e.message, e)
        }
    }

    @ReactMethod
    fun savePdfToDownloads(uriString: String, displayName: String, promise: Promise) {
        Thread {
            try {
                val safeName = displayName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                    .let { if (it.lowercase().endsWith(".pdf")) it else "$it.pdf" }

                val sourceFile = resolveToLocalReadableFile(uriString, "dl_src")

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                        put(MediaStore.Downloads.MIME_TYPE, "application/pdf")
                        put(MediaStore.Downloads.RELATIVE_PATH, "${Environment.DIRECTORY_DOWNLOADS}/PrepRole")
                        put(MediaStore.Downloads.IS_PENDING, 1)
                    }
                    val resolver = reactContext.contentResolver
                    val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
                    val itemUri = resolver.insert(collection, values)
                        ?: throw IllegalStateException("Could not create download entry")

                    resolver.openOutputStream(itemUri)?.use { out ->
                        FileInputStream(sourceFile).use { ins ->
                            ins.copyTo(out)
                        }
                    } ?: throw IllegalStateException("Could not open MediaStore output stream")

                    values.clear()
                    values.put(MediaStore.Downloads.IS_PENDING, 0)
                    resolver.update(itemUri, values, null, null)

                    val res = WritableNativeMap().apply {
                        putString("uri", itemUri.toString())
                        putString("fileName", safeName)
                        putString("location", "Downloads/PrepRole/$safeName")
                    }
                    promise.resolve(res)
                } else {
                    val docsDir = File(
                        Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                        "PrepRole",
                    )
                    if (!docsDir.exists()) docsDir.mkdirs()
                    val dest = File(docsDir, safeName)
                    FileInputStream(sourceFile).use { ins ->
                        FileOutputStream(dest).use { out ->
                            ins.copyTo(out)
                        }
                    }
                    val res = WritableNativeMap().apply {
                        putString("uri", "file://${dest.absolutePath}")
                        putString("fileName", safeName)
                        putString("location", "Downloads/PrepRole/$safeName")
                    }
                    promise.resolve(res)
                }
            } catch (e: Exception) {
                promise.reject("ERR_SAVE_DOWNLOADS", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun getPdfBase64(uriString: String, promise: Promise) {
        Thread {
            try {
                val inputStream = openInputStreamForUri(uriString)
                if (inputStream == null) {
                    promise.reject("ERR_OPEN", "Could not open stream for URI: $uriString")
                    return@Thread
                }
                val bytes = inputStream.use { it.readBytes() }
                val base64 = android.util.Base64.encodeToString(bytes, android.util.Base64.NO_WRAP)
                promise.resolve(base64)
            } catch (e: Exception) {
                promise.reject("ERR_BASE64", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun copyUriToCache(uriString: String, fileName: String, promise: Promise) {
        Thread {
            try {
                val cacheDir = File(reactContext.cacheDir, "pdf_cache")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                val safeName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                val dest = File(cacheDir, safeName)
                val input = openInputStreamForUri(uriString)
                    ?: throw IllegalStateException("Could not open stream for URI: $uriString")
                input.use { ins ->
                    FileOutputStream(dest).use { out ->
                        ins.copyTo(out)
                    }
                }
                promise.resolve("file://${dest.absolutePath}")
            } catch (e: Exception) {
                promise.reject("ERR_COPY", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun downloadPdfToCache(urlString: String, fileName: String, promise: Promise) {
        Thread {
            var conn: HttpURLConnection? = null
            try {
                val cacheDir = File(reactContext.cacheDir, "pdf_cache")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                val safeName = fileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                val dest = File(cacheDir, safeName)

                conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15000
                    readTimeout = 30000
                    instanceFollowRedirects = true
                }
                val code = conn.responseCode
                if (code !in 200..299) {
                    throw IllegalStateException("HTTP $code downloading PDF")
                }
                conn.inputStream.use { ins ->
                    FileOutputStream(dest).use { out ->
                        ins.copyTo(out)
                    }
                }
                promise.resolve("file://${dest.absolutePath}")
            } catch (e: Exception) {
                promise.reject("ERR_DOWNLOAD", e.message, e)
            } finally {
                conn?.disconnect()
            }
        }.start()
    }

    @ReactMethod
    fun ensureFontFileCached(urlString: String, cacheFileName: String, promise: Promise) {
        Thread {
            var conn: HttpURLConnection? = null
            try {
                val fontDir = File(reactContext.cacheDir, "resume_fonts")
                if (!fontDir.exists()) fontDir.mkdirs()
                val safeName = cacheFileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                val dest = File(fontDir, safeName)
                if (dest.exists() && dest.length() > 1024L) {
                    promise.resolve(dest.absolutePath)
                    return@Thread
                }

                conn = (URL(urlString).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 10000
                    readTimeout = 15000
                    instanceFollowRedirects = true
                    setRequestProperty("User-Agent", "Mozilla/4.0")
                }
                if (conn.responseCode !in 200..299) {
                    promise.resolve(null)
                    return@Thread
                }
                val bytes = conn.inputStream.use { it.readBytes() }
                // Validate TrueType / OpenType magic header (0x00010000, 'OTTO', 'true', 'ttcf')
                if (bytes.size < 1024) {
                    promise.resolve(null)
                    return@Thread
                }
                val isTtf = (bytes[0] == 0.toByte() && bytes[1] == 1.toByte() && bytes[2] == 0.toByte() && bytes[3] == 0.toByte()) ||
                    (bytes[0] == 't'.code.toByte() && bytes[1] == 'r'.code.toByte() && bytes[2] == 'u'.code.toByte() && bytes[3] == 'e'.code.toByte()) ||
                    (bytes[0] == 'O'.code.toByte() && bytes[1] == 'T'.code.toByte() && bytes[2] == 'T'.code.toByte() && bytes[3] == 'O'.code.toByte())
                if (!isTtf) {
                    promise.resolve(null)
                    return@Thread
                }
                FileOutputStream(dest).use { it.write(bytes) }
                promise.resolve(dest.absolutePath)
            } catch (_: Exception) {
                promise.resolve(null)
            } finally {
                conn?.disconnect()
            }
        }.start()
    }

    @ReactMethod
    fun extractPdfStructure(uriString: String, promise: Promise) {
        Thread {
            try {
                ensurePdfBoxInitialized()
                val file = resolveToLocalReadableFile(uriString, "extract_src")
                val structure = PDDocument.load(file).use { doc ->
                    PdfStructureExtractor.extract(doc)
                }

                val pagesArr = WritableNativeArray()
                val fontKeysMap = mutableMapOf<String, WritableNativeMap>()

                for (page in structure.pages) {
                    val linesArr = WritableNativeArray()
                    for (line in page.lines) {
                        val runsArr = WritableNativeArray()
                        for (run in line.runs) {
                            runsArr.pushMap(
                                WritableNativeMap().apply {
                                    putString("text", run.text)
                                    putDouble("x", run.x.toDouble())
                                    putDouble("width", run.width.toDouble())
                                    putString("fontName", run.fontName)
                                    putString("cleanFamily", run.cleanFamily)
                                    putDouble("fontSize", run.fontSize.toDouble())
                                    putBoolean("isBold", run.isBold)
                                    putBoolean("isItalic", run.isItalic)
                                    putBoolean("isSerif", run.isSerif)
                                    putBoolean("isMono", run.isMono)
                                    putInt("fontWeight", run.fontWeight)
                                    putString("colorHex", run.colorHex)
                                },
                            )

                            val key = PdfFontResolver.buildStyleKey(run.cleanFamily, run.isBold, run.isItalic, run.fontWeight)
                            if (!fontKeysMap.containsKey(key)) {
                                val canonical = PdfFontResolver.mapToCanonicalFamily(run.cleanFamily, run.isSerif, run.isMono)
                                fontKeysMap[key] = WritableNativeMap().apply {
                                    putString("styleKey", key)
                                    putString("cleanFamily", run.cleanFamily)
                                    putString("canonicalFamily", canonical)
                                    putBoolean("isBold", run.isBold)
                                    putBoolean("isItalic", run.isItalic)
                                    putBoolean("isSerif", run.isSerif)
                                    putBoolean("isMono", run.isMono)
                                    putInt("fontWeight", run.fontWeight)
                                }
                            }
                        }

                        linesArr.pushMap(
                            WritableNativeMap().apply {
                                putString("id", line.id)
                                putInt("pageIndex", line.pageIndex)
                                putDouble("x", line.x.toDouble())
                                putDouble("yBaseline", line.yBaseline.toDouble())
                                putDouble("width", line.width.toDouble())
                                putDouble("colLeft", line.colLeft.toDouble())
                                putDouble("colRight", line.colRight.toDouble())
                                putDouble("colMaxWidth", line.colMaxWidth.toDouble())
                                putDouble("fontSize", line.fontSize.toDouble())
                                putString("fontName", line.fontName)
                                putString("cleanFamily", line.cleanFamily)
                                putBoolean("isBold", line.isBold)
                                putBoolean("isItalic", line.isItalic)
                                putBoolean("isSerif", line.isSerif)
                                putBoolean("isMono", line.isMono)
                                putInt("fontWeight", line.fontWeight)
                                putString("colorHex", line.colorHex)
                                putDouble("lineSpacing", line.lineSpacing.toDouble())
                                putString("leadingBullet", line.leadingBullet)
                                putString("text", line.text)
                                putArray("runs", runsArr)
                            },
                        )
                    }

                    pagesArr.pushMap(
                        WritableNativeMap().apply {
                            putInt("pageIndex", page.pageIndex)
                            putDouble("width", page.width.toDouble())
                            putDouble("height", page.height.toDouble())
                            putArray("lines", linesArr)
                        },
                    )
                }

                val fontsArr = WritableNativeArray()
                for (fMap in fontKeysMap.values) {
                    fontsArr.pushMap(fMap)
                }

                val result = WritableNativeMap().apply {
                    putInt("pageCount", structure.pageCount)
                    putArray("pages", pagesArr)
                    putArray("fonts", fontsArr)
                }
                promise.resolve(result)
            } catch (e: Exception) {
                promise.reject("ERR_EXTRACT", e.message, e)
            }
        }.start()
    }

    @ReactMethod
    fun applyPdfEdits(
        uriString: String,
        editsJson: String,
        fontPathsJson: String,
        outputFileName: String,
        promise: Promise,
    ) {
        Thread {
            try {
                ensurePdfBoxInitialized()
                val inputFile = resolveToLocalReadableFile(uriString, "edit_src")

                val outDir = File(reactContext.cacheDir, "pdf_edited")
                if (!outDir.exists()) outDir.mkdirs()
                val safeOutName = outputFileName.replace(Regex("[^a-zA-Z0-9._-]"), "_")
                    .let { if (it.lowercase().endsWith(".pdf")) it else "$it.pdf" }
                val outputFile = File(outDir, safeOutName)

                val editsArr = JSONArray(editsJson)
                val edits = mutableListOf<PdfEditInstruction>()
                for (i in 0 until editsArr.length()) {
                    val obj = editsArr.getJSONObject(i)
                    val targetIdsArr = obj.optJSONArray("targetLineIds") ?: JSONArray()
                    val ids = mutableListOf<String>()
                    for (j in 0 until targetIdsArr.length()) {
                        ids.add(targetIdsArr.getString(j))
                    }
                    edits.add(
                        PdfEditInstruction(
                            id = obj.optString("id", "edit-$i"),
                            action = obj.optString("action", "replace"),
                            targetLineIds = ids,
                            newText = obj.optString("newText", ""),
                            preserveBoldPrefix = obj.optBoolean("preserveBoldPrefix", true),
                        ),
                    )
                }

                val fontPaths = mutableMapOf<String, String>()
                if (fontPathsJson.isNotBlank()) {
                    val fObj = JSONObject(fontPathsJson)
                    val keys = fObj.keys()
                    while (keys.hasNext()) {
                        val k = keys.next()
                        val v = fObj.optString(k, "")
                        if (v.isNotBlank()) {
                            fontPaths[k] = v
                        }
                    }
                }

                val editResult = PdfSurgicalEditor.applyEdits(
                    context = reactContext,
                    inputFile = inputFile,
                    outputFile = outputFile,
                    edits = edits,
                    downloadedFontPaths = fontPaths,
                )

                val detailsArr = WritableNativeArray()
                editResult.fontMatchDetails.forEach { detailsArr.pushString(it) }

                val res = WritableNativeMap().apply {
                    putString("outputPath", editResult.outputPath)
                    putString("outputUri", editResult.outputUri)
                    putInt("appliedCount", editResult.appliedCount)
                    putInt("pageCount", editResult.pageCount)
                    putArray("fontMatchDetails", detailsArr)
                }
                promise.resolve(res)
            } catch (e: Exception) {
                promise.reject("ERR_APPLY_EDITS", e.message, e)
            }
        }.start()
    }
}
