package com.preprole.pdf

import android.content.Context
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.font.PDCIDFontType2
import com.tom_roush.pdfbox.pdmodel.font.PDFont
import com.tom_roush.pdfbox.pdmodel.font.PDType0Font
import com.tom_roush.pdfbox.pdmodel.font.PDType1Font
import java.io.File
import java.io.FileInputStream
import kotlin.math.abs

data class ResolvedPdfFont(
    val font: PDFont,
    val sizeMultiplier: Float,
    val isStandardFallback: Boolean,
    val source: String,
)

class PdfFontResolver(
    private val context: Context,
    private val document: PDDocument,
    private val downloadedFontPaths: Map<String, String>,
) {
    private val loadedFontCache = mutableMapOf<String, PDFont>()

    fun resolveForRun(
        originalFont: PDFont?,
        cleanFamily: String,
        fontName: String,
        isBold: Boolean,
        isItalic: Boolean,
        isSerif: Boolean,
        isMono: Boolean,
        fontWeight: Int,
        origCapHeight: Float,
        textToRender: String,
    ): ResolvedPdfFont {
        // Tier 1: Literal original PDF font if it can cleanly encode every char in textToRender
        if (originalFont != null && canEncodeCleanly(originalFont, textToRender)) {
            return ResolvedPdfFont(
                font = originalFont,
                sizeMultiplier = 1.0f,
                isStandardFallback = false,
                source = "original_embedded",
            )
        }

        // Tier 2: Dynamically downloaded/cached Google Font TTF matching exact family + weight + italic
        val styleKey = buildStyleKey(cleanFamily, isBold, isItalic, fontWeight)
        val genericKey = buildStyleKey(mapToCanonicalFamily(cleanFamily, isSerif, isMono), isBold, isItalic, fontWeight)
        val exactMatchPath = downloadedFontPaths[styleKey]
            ?: downloadedFontPaths[fontName]
            ?: downloadedFontPaths[genericKey]
            ?: findCachedFontInDir(cleanFamily, isBold, isItalic, isSerif, isMono, fontWeight)

        if (exactMatchPath != null) {
            loadType0FontFromFile(exactMatchPath)?.let { loaded ->
                if (canEncodeCleanly(loaded, textToRender)) {
                    return ResolvedPdfFont(
                        font = loaded,
                        sizeMultiplier = computeCapHeightScale(origCapHeight, loaded),
                        isStandardFallback = false,
                        source = "matched_ttf:$exactMatchPath",
                    )
                }
            }
        }

        // Tier 3: Bundled Montserrat assets if sans-serif / Montserrat
        if (!isSerif && !isMono && cleanFamily.lowercase().contains("montserrat")) {
            val assetName = resolveMontserratAsset(isBold, isItalic, fontWeight)
            loadType0FontFromAsset(assetName)?.let { loaded ->
                if (canEncodeCleanly(loaded, textToRender)) {
                    return ResolvedPdfFont(
                        font = loaded,
                        sizeMultiplier = computeCapHeightScale(origCapHeight, loaded),
                        isStandardFallback = false,
                        source = "bundled_asset:$assetName",
                    )
                }
            }
        }

        // Tier 4: Android /system/fonts/ (NotoSerif, Roboto, DroidSansMono, NotoSans)
        val systemCandidates = getSystemFontCandidates(isBold, isItalic, isSerif, isMono, fontWeight)
        for (sysPath in systemCandidates) {
            val f = File(sysPath)
            if (f.exists() && f.canRead()) {
                loadType0FontFromFile(sysPath)?.let { loaded ->
                    if (canEncodeCleanly(loaded, textToRender)) {
                        return ResolvedPdfFont(
                            font = loaded,
                            sizeMultiplier = computeCapHeightScale(origCapHeight, loaded),
                            isStandardFallback = false,
                            source = "system_font:${f.name}",
                        )
                    }
                }
            }
        }

        // Tier 4b: Bundled Montserrat as safe Unicode geometric sans fallback
        val fallbackAsset = resolveMontserratAsset(isBold, isItalic, fontWeight)
        loadType0FontFromAsset(fallbackAsset)?.let { loaded ->
            if (canEncodeCleanly(loaded, textToRender)) {
                return ResolvedPdfFont(
                    font = loaded,
                    sizeMultiplier = computeCapHeightScale(origCapHeight, loaded),
                    isStandardFallback = false,
                    source = "bundled_fallback:$fallbackAsset",
                )
            }
        }

        // Tier 5: PDFBox Standard 14 fallback
        val stdFont: PDFont = when {
            isMono && isBold && isItalic -> PDType1Font.COURIER_BOLD_OBLIQUE
            isMono && isBold -> PDType1Font.COURIER_BOLD
            isMono && isItalic -> PDType1Font.COURIER_OBLIQUE
            isMono -> PDType1Font.COURIER
            isSerif && isBold && isItalic -> PDType1Font.TIMES_BOLD_ITALIC
            isSerif && isBold -> PDType1Font.TIMES_BOLD
            isSerif && isItalic -> PDType1Font.TIMES_ITALIC
            isSerif -> PDType1Font.TIMES_ROMAN
            isBold && isItalic -> PDType1Font.HELVETICA_BOLD_OBLIQUE
            isBold -> PDType1Font.HELVETICA_BOLD
            isItalic -> PDType1Font.HELVETICA_OBLIQUE
            else -> PDType1Font.HELVETICA
        }

        return ResolvedPdfFont(
            font = stdFont,
            sizeMultiplier = 1.0f,
            isStandardFallback = true,
            source = "standard14",
        )
    }

    fun canEncodeCleanly(font: PDFont, text: String): Boolean {
        if (text.isEmpty()) return true
        return try {
            for (ch in text) {
                if (ch == '\n' || ch == '\r') continue
                val s = ch.toString()
                val encoded = font.encode(s)
                if (encoded.isEmpty()) return false
                val code = if (encoded.size >= 2) {
                    ((encoded[0].toInt() and 0xFF) shl 8) or (encoded[1].toInt() and 0xFF)
                } else {
                    encoded[0].toInt() and 0xFF
                }
                if (font is PDType0Font) {
                    val desc = font.descendantFont
                    if (desc is PDCIDFontType2) {
                        val gid = desc.codeToGID(code)
                        if (gid == 0 && !ch.isWhitespace()) return false
                    }
                }
                if (!ch.isWhitespace() && font.getWidth(code) <= 0f) {
                    return false
                }
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    private fun computeCapHeightScale(origCapHeight: Float, newFont: PDFont): Float {
        if (origCapHeight <= 300f) return 1.0f
        val newCap = try {
            val c = newFont.fontDescriptor?.capHeight ?: 0f
            if (c in 300f..1000f) c else 700f
        } catch (_: Exception) {
            700f
        }
        val ratio = origCapHeight / newCap
        return ratio.coerceIn(0.92f, 1.08f)
    }

    private fun loadType0FontFromFile(path: String): PDFont? {
        loadedFontCache[path]?.let { return it }
        return try {
            val file = File(path)
            if (!file.exists()) return null
            FileInputStream(file).use { stream ->
                val font = PDType0Font.load(document, stream, true)
                loadedFontCache[path] = font
                font
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun loadType0FontFromAsset(assetFileName: String): PDFont? {
        val cacheKey = "asset:$assetFileName"
        loadedFontCache[cacheKey]?.let { return it }
        return try {
            context.assets.open("fonts/$assetFileName").use { stream ->
                val font = PDType0Font.load(document, stream, true)
                loadedFontCache[cacheKey] = font
                font
            }
        } catch (_: Exception) {
            null
        }
    }

    private fun findCachedFontInDir(
        cleanFamily: String,
        isBold: Boolean,
        isItalic: Boolean,
        isSerif: Boolean,
        isMono: Boolean,
        fontWeight: Int,
    ): String? {
        val fontDir = File(context.cacheDir, "resume_fonts")
        if (!fontDir.exists()) return null
        val canonical = mapToCanonicalFamily(cleanFamily, isSerif, isMono)
            .lowercase().replace(Regex("[^a-z0-9]"), "")
        val styleSuffix = "${if (isBold || fontWeight >= 600) "700" else "400"}_${if (isItalic) "italic" else "normal"}"
        val exact = File(fontDir, "${canonical}_${styleSuffix}.ttf")
        if (exact.exists()) return exact.absolutePath
        val normal = File(fontDir, "${canonical}_400_normal.ttf")
        return if (normal.exists()) normal.absolutePath else null
    }

    private fun resolveMontserratAsset(isBold: Boolean, isItalic: Boolean, weight: Int): String {
        return when {
            isBold && isItalic -> "Montserrat-BoldItalic.ttf"
            isItalic && weight >= 600 -> "Montserrat-SemiBoldItalic.ttf"
            isItalic && weight >= 500 -> "Montserrat-MediumItalic.ttf"
            isItalic -> "Montserrat-Italic.ttf"
            weight >= 800 -> "Montserrat-ExtraBold.ttf"
            isBold || weight >= 700 -> "Montserrat-Bold.ttf"
            weight >= 600 -> "Montserrat-SemiBold.ttf"
            weight >= 500 -> "Montserrat-Medium.ttf"
            weight <= 300 -> "Montserrat-Light.ttf"
            else -> "Montserrat-Regular.ttf"
        }
    }

    private fun getSystemFontCandidates(
        isBold: Boolean,
        isItalic: Boolean,
        isSerif: Boolean,
        isMono: Boolean,
        weight: Int,
    ): List<String> {
        return when {
            isMono -> listOf(
                "/system/fonts/DroidSansMono.ttf",
                "/system/fonts/RobotoMono-Regular.ttf",
                "/system/fonts/CutiveMono.ttf",
            )
            isSerif -> when {
                isBold && isItalic -> listOf(
                    "/system/fonts/NotoSerif-BoldItalic.ttf",
                    "/system/fonts/DroidSerif-BoldItalic.ttf",
                    "/system/fonts/NotoSerif-Bold.ttf",
                )
                isBold -> listOf(
                    "/system/fonts/NotoSerif-Bold.ttf",
                    "/system/fonts/DroidSerif-Bold.ttf",
                )
                isItalic -> listOf(
                    "/system/fonts/NotoSerif-Italic.ttf",
                    "/system/fonts/DroidSerif-Italic.ttf",
                )
                else -> listOf(
                    "/system/fonts/NotoSerif-Regular.ttf",
                    "/system/fonts/DroidSerif-Regular.ttf",
                )
            }
            else -> when {
                isBold && isItalic -> listOf(
                    "/system/fonts/Roboto-BoldItalic.ttf",
                    "/system/fonts/NotoSans-BoldItalic.ttf",
                    "/system/fonts/Roboto-Bold.ttf",
                )
                weight >= 600 || isBold -> listOf(
                    "/system/fonts/Roboto-Bold.ttf",
                    "/system/fonts/NotoSans-Bold.ttf",
                    "/system/fonts/Roboto-Medium.ttf",
                )
                weight >= 500 -> listOf(
                    "/system/fonts/Roboto-Medium.ttf",
                    "/system/fonts/Roboto-Regular.ttf",
                )
                isItalic -> listOf(
                    "/system/fonts/Roboto-Italic.ttf",
                    "/system/fonts/NotoSans-Italic.ttf",
                )
                else -> listOf(
                    "/system/fonts/Roboto-Regular.ttf",
                    "/system/fonts/NotoSans-Regular.ttf",
                    "/system/fonts/DroidSans.ttf",
                )
            }
        }
    }

    companion object {
        fun buildStyleKey(family: String, isBold: Boolean, isItalic: Boolean, weight: Int): String {
            val clean = family.lowercase().replace(Regex("[^a-z0-9]"), "")
            val w = if (isBold || weight >= 600) "700" else if (weight >= 500) "500" else "400"
            val i = if (isItalic) "italic" else "normal"
            return "${clean}_${w}_${i}"
        }

        fun mapToCanonicalFamily(family: String, isSerif: Boolean, isMono: Boolean): String {
            val lower = family.lowercase().replace(Regex("[^a-z0-9]"), "")
            return when {
                lower.contains("calibri") -> "Carlito"
                lower.contains("cambria") -> "Caladea"
                lower.contains("arial") || lower.contains("helvetica") || lower.contains("liberationsans") -> "Arimo"
                lower.contains("times") || lower.contains("liberationserif") -> "Tinos"
                lower.contains("courier") || lower.contains("consolas") || lower.contains("liberationmono") -> "Cousine"
                lower.contains("montserrat") -> "Montserrat"
                lower.contains("roboto") -> "Roboto"
                lower.contains("lato") -> "Lato"
                lower.contains("opensans") -> "Open Sans"
                lower.contains("poppins") -> "Poppins"
                lower.contains("inter") -> "Inter"
                lower.contains("sourcesans") -> "Source Sans 3"
                lower.contains("raleway") -> "Raleway"
                lower.contains("nunito") -> "Nunito"
                lower.contains("merriweather") -> "Merriweather"
                lower.contains("lora") -> "Lora"
                lower.contains("garamond") || lower.contains("cmr") || lower.contains("lmroman") -> "EB Garamond"
                lower.contains("georgia") -> "Lora"
                lower.contains("playfair") -> "Playfair Display"
                isMono -> "Cousine"
                isSerif -> "Tinos"
                else -> "Arimo"
            }
        }

        fun sanitizeForStandard14(text: String): String {
            val sb = StringBuilder()
            for (ch in text) {
                when (ch) {
                    '•', '●', '◦', '▪', '▫', '‣' -> sb.append('-')
                    '–', '—' -> sb.append('-')
                    '’', '‘' -> sb.append('\'')
                    '“', '”' -> sb.append('"')
                    '→' -> sb.append("->")
                    '✓', '✔' -> sb.append('*')
                    else -> if (ch.code in 32..126 || ch.code in 160..255) sb.append(ch) else sb.append(' ')
                }
            }
            return sb.toString()
        }
    }
}
