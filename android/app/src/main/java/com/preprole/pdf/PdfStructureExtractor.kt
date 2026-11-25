package com.preprole.pdf

import android.graphics.RectF
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.font.PDFont
import com.tom_roush.pdfbox.pdmodel.graphics.color.PDColor
import com.tom_roush.pdfbox.pdmodel.graphics.state.RenderingMode
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.TextPosition
import java.io.StringWriter
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class StyledRunModel(
    val text: String,
    val x: Float,
    val width: Float,
    val fontName: String,
    val cleanFamily: String,
    val fontSize: Float,
    val isBold: Boolean,
    val isItalic: Boolean,
    val isSerif: Boolean,
    val isMono: Boolean,
    val fontWeight: Int,
    val colorHex: String,
    val capHeight: Float,
    val pdfFont: PDFont?,
)

data class LineModel(
    val id: String,
    val pageIndex: Int,
    val x: Float,
    val yBaseline: Float,
    val yTop: Float,
    val yBottom: Float,
    val width: Float,
    val height: Float,
    val fontName: String,
    val cleanFamily: String,
    val fontSize: Float,
    val isBold: Boolean,
    val isItalic: Boolean,
    val isSerif: Boolean,
    val isMono: Boolean,
    val fontWeight: Int,
    val colorHex: String,
    val capHeight: Float,
    val text: String,
    val colLeft: Float,
    val colRight: Float,
    val colMaxWidth: Float,
    val lineSpacing: Float,
    val leadingBullet: String,
    val textStartX: Float,
    val runs: List<StyledRunModel>,
)

data class PageStructureModel(
    val pageIndex: Int,
    val width: Float,
    val height: Float,
    val rotation: Int,
    val cropLeft: Float,
    val cropBottom: Float,
    val cropRight: Float,
    val cropTop: Float,
    val lines: List<LineModel>,
)

data class DocumentStructureModel(
    val pageCount: Int,
    val pages: List<PageStructureModel>,
)

private data class RawGlyph(
    val unicode: String,
    val x: Float,
    val yBaseline: Float,
    val width: Float,
    val height: Float,
    val spaceWidth: Float,
    val fontSize: Float,
    val font: PDFont?,
    val fontName: String,
    val cleanFamily: String,
    val isBold: Boolean,
    val isItalic: Boolean,
    val isSerif: Boolean,
    val isMono: Boolean,
    val fontWeight: Int,
    val colorHex: String,
    val capHeight: Float,
)

object PdfStructureExtractor {

    private val SUBSET_PREFIX_REGEX = Regex("^[A-Z]{6}\\+")
    private val BULLET_PREFIXES = listOf("• ", "● ", "◦ ", "▪ ", "▫ ", "‣ ", "- ", "– ", "* ")

    fun cleanFontName(rawName: String?): String {
        if (rawName.isNullOrBlank()) return "Helvetica"
        return rawName.replace(SUBSET_PREFIX_REGEX, "").trim()
    }

    fun inferFontStyle(font: PDFont?, rawName: String?): FontMeta {
        val cleaned = cleanFontName(rawName)
        val lower = cleaned.lowercase()
        val desc = try { font?.fontDescriptor } catch (_: Exception) { null }

        val descWeight = try { desc?.fontWeight ?: 0f } catch (_: Exception) { 0f }
        val isItalic = (try { desc?.isItalic == true } catch (_: Exception) { false }) ||
            lower.contains("italic") || lower.contains("oblique") || lower.endsWith("-it") || lower.endsWith("it")

        val isBold = (try { desc?.isForceBold == true } catch (_: Exception) { false }) ||
            descWeight >= 600f ||
            lower.contains("bold") || lower.contains("semibold") || lower.contains("demi") ||
            lower.contains("heavy") || lower.contains("black") || lower.contains("extrab") ||
            lower.contains("cmbx")

        val weight = when {
            lower.contains("black") || lower.contains("heavy") -> 900
            lower.contains("extrabold") || lower.contains("ultrabold") -> 800
            lower.contains("bold") && !lower.contains("semibold") -> 700
            lower.contains("semibold") || lower.contains("demibold") || lower.contains("demi") -> 600
            lower.contains("medium") -> 500
            lower.contains("light") -> 300
            lower.contains("thin") -> 200
            descWeight >= 100f -> descWeight.roundToInt()
            isBold -> 700
            else -> 400
        }

        val isMono = (try { desc?.isFixedPitch == true } catch (_: Exception) { false }) ||
            lower.contains("mono") || lower.contains("courier") || lower.contains("consolas") ||
            lower.contains("menlo") || lower.contains("cousine") || lower.contains("code")

        val isSerif = !isMono && (
            (try { desc?.isSerif == true } catch (_: Exception) { false }) ||
                lower.contains("times") || lower.contains("serif") || lower.contains("georgia") ||
                lower.contains("garamond") || lower.contains("cambria") || lower.contains("caladea") ||
                lower.contains("tinos") || lower.contains("palatino") || lower.contains("merriweather") ||
                lower.contains("lora") || lower.contains("playfair") || lower.contains("baskerville") ||
                lower.contains("cmr") || lower.contains("lmroman") || lower.contains("charter")
            )

        // Normalize family base name (strip style suffixes like -Bold, ,Italic, PS-BoldMT)
        var family = cleaned
            .replace(Regex("[,\\-_ ]?(ExtraBold|SemiBold|DemiBold|UltraBold|BoldItalic|BoldOblique|SemiBoldItalic|MediumItalic|LightItalic|Regular|Italic|Oblique|Bold|Medium|Light|Thin|Black|Heavy|MT|PSMT|PS)$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("[,\\-_ ]?(Bold|Italic|Regular|Medium|SemiBold)$", RegexOption.IGNORE_CASE), "")
            .replace(Regex("\\s+"), " ")
            .trim()
        if (family.isEmpty()) family = cleaned

        val capHeight = try {
            val ch = desc?.capHeight ?: 0f
            if (ch in 300f..1000f) ch else 700f
        } catch (_: Exception) {
            700f
        }

        return FontMeta(
            cleanName = cleaned,
            family = family,
            isBold = isBold,
            isItalic = isItalic,
            isSerif = isSerif,
            isMono = isMono,
            weight = weight,
            capHeight = capHeight,
        )
    }

    data class FontMeta(
        val cleanName: String,
        val family: String,
        val isBold: Boolean,
        val isItalic: Boolean,
        val isSerif: Boolean,
        val isMono: Boolean,
        val weight: Int,
        val capHeight: Float,
    )

    private fun pdColorToHex(color: PDColor?): String {
        if (color == null) return "#111111"
        return try {
            val rgb = color.colorSpace.toRGB(color.components)
            val r = (rgb[0].coerceIn(0f, 1f) * 255f).roundToInt().coerceIn(0, 255)
            val g = (rgb[1].coerceIn(0f, 1f) * 255f).roundToInt().coerceIn(0, 255)
            val b = (rgb[2].coerceIn(0f, 1f) * 255f).roundToInt().coerceIn(0, 255)
            String.format("#%02X%02X%02X", r, g, b)
        } catch (_: Exception) {
            "#111111"
        }
    }

    fun extract(document: PDDocument): DocumentStructureModel {
        val pagesOut = mutableListOf<PageStructureModel>()

        for (pageIdx in 0 until document.numberOfPages) {
            val page = document.getPage(pageIdx)
            val crop = page.cropBox ?: page.mediaBox
            val rotation = ((page.rotation % 360) + 360) % 360
            val pageW = if (rotation == 90 || rotation == 270) crop.height else crop.width
            val pageH = if (rotation == 90 || rotation == 270) crop.width else crop.height

            val rawGlyphs = mutableListOf<RawGlyph>()

            val stripper = object : PDFTextStripper() {
                init {
                    sortByPosition = false
                    startPage = pageIdx + 1
                    endPage = pageIdx + 1
                }

                override fun processTextPosition(text: TextPosition) {
                    val unicode = text.unicode ?: ""
                    if (unicode.isEmpty()) return

                    val gs = graphicsState
                    val renderMode = gs.textState.renderingMode
                    // Skip invisible text (RenderingMode.NEITHER = 3)
                    if (renderMode == RenderingMode.NEITHER) return

                    val pdColor = if (renderMode == RenderingMode.STROKE) {
                        gs.strokingColor
                    } else {
                        gs.nonStrokingColor
                    }
                    val colorHex = pdColorToHex(pdColor)

                    val font = text.font
                    val meta = inferFontStyle(font, font?.name)
                    val fontSize = max(4f, text.fontSizeInPt)
                    val isFakeBold = meta.isBold || renderMode == RenderingMode.FILL_STROKE

                    rawGlyphs.add(
                        RawGlyph(
                            unicode = unicode,
                            x = text.xDirAdj,
                            yBaseline = text.yDirAdj,
                            width = max(0.2f, text.widthDirAdj),
                            height = max(fontSize * 0.75f, text.heightDir),
                            spaceWidth = max(fontSize * 0.25f, text.widthOfSpace),
                            fontSize = fontSize,
                            font = font,
                            fontName = meta.cleanName,
                            cleanFamily = meta.family,
                            isBold = isFakeBold,
                            isItalic = meta.isItalic,
                            isSerif = meta.isSerif,
                            isMono = meta.isMono,
                            fontWeight = if (isFakeBold && meta.weight < 600) 700 else meta.weight,
                            colorHex = colorHex,
                            capHeight = meta.capHeight,
                        ),
                    )
                }
            }

            // Execute extraction
            stripper.getText(document)

            val lines = groupGlyphsIntoLines(pageIdx, pageW, pageH, rawGlyphs)
            pagesOut.add(
                PageStructureModel(
                    pageIndex = pageIdx,
                    width = pageW,
                    height = pageH,
                    rotation = rotation,
                    cropLeft = crop.lowerLeftX,
                    cropBottom = crop.lowerLeftY,
                    cropRight = crop.upperRightX,
                    cropTop = crop.upperRightY,
                    lines = lines,
                ),
            )
        }

        return DocumentStructureModel(
            pageCount = document.numberOfPages,
            pages = pagesOut,
        )
    }

    private fun groupGlyphsIntoLines(
        pageIdx: Int,
        pageW: Float,
        pageH: Float,
        rawGlyphs: List<RawGlyph>,
    ): List<LineModel> {
        if (rawGlyphs.isEmpty()) return emptyList()

        // Sort top-to-bottom, left-to-right
        val sorted = rawGlyphs.sortedWith(compareBy<RawGlyph> { it.yBaseline }.thenBy { it.x })

        // Cluster into horizontal rows
        val rows = mutableListOf<MutableList<RawGlyph>>()
        for (g in sorted) {
            // Skip pure whitespace-only glyphs at row start if we want clean trimming later
            val matchingRow = rows.lastOrNull()?.let { lastRow ->
                val rowAvgY = lastRow.map { it.yBaseline }.average().toFloat()
                val tol = max(2.2f, min(g.fontSize, lastRow.first().fontSize) * 0.35f)
                if (abs(g.yBaseline - rowAvgY) <= tol) lastRow else null
            }
            if (matchingRow != null) {
                matchingRow.add(g)
            } else {
                rows.add(mutableListOf(g))
            }
        }

        // Split rows at large horizontal column gaps
        val interimLines = mutableListOf<InterimLine>()
        for (row in rows) {
            row.sortBy { it.x }
            val segments = mutableListOf<MutableList<RawGlyph>>()
            var currentSeg = mutableListOf<RawGlyph>()

            for (g in row) {
                if (currentSeg.isEmpty()) {
                    currentSeg.add(g)
                    continue
                }
                val prev = currentSeg.last()
                val gap = g.x - (prev.x + prev.width)
                val colSplitThreshold = max(18f, max(prev.fontSize, g.fontSize) * 2.2f)
                if (gap > colSplitThreshold) {
                    segments.add(currentSeg)
                    currentSeg = mutableListOf(g)
                } else {
                    currentSeg.add(g)
                }
            }
            if (currentSeg.isNotEmpty()) {
                segments.add(currentSeg)
            }

            for (seg in segments) {
                buildInterimLine(seg)?.let { interimLines.add(it) }
            }
        }

        if (interimLines.isEmpty()) return emptyList()

        // Sort final lines top-to-bottom, left-to-right
        interimLines.sortWith(compareBy<InterimLine> { it.yBaseline }.thenBy { it.x })

        // Infer columns and line spacing for each line
        val defaultLeftMargin = max(20f, interimLines.minOf { it.x })
        val defaultRightMargin = min(pageW - 20f, interimLines.maxOf { it.x + it.width })

        // Detect potential two-column vertical gutter in page center region [25% .. 65% of pageW]
        val gutterX = detectColumnGutter(interimLines, pageW)

        return interimLines.mapIndexed { idx, line ->
            // Determine column bounds
            var colLeft = defaultLeftMargin
            var colRight = defaultRightMargin

            if (gutterX != null) {
                if (line.x + line.width <= gutterX + 6f) {
                    colLeft = defaultLeftMargin
                    colRight = gutterX - 8f
                } else if (line.x >= gutterX - 6f) {
                    colLeft = gutterX + 8f
                    colRight = defaultRightMargin
                }
            }

            // Also prevent colliding with a right-aligned sibling on the exact same row (e.g., job title vs date)
            for (otherIdx in interimLines.indices) {
                if (otherIdx == idx) continue
                val other = interimLines[otherIdx]
                if (abs(other.yBaseline - line.yBaseline) <= max(3f, line.fontSize * 0.45f)) {
                    if (other.x > line.x + line.width + 6f && other.x - 10f < colRight) {
                        colRight = max(line.x + line.width, other.x - 10f)
                    }
                }
            }

            colLeft = min(colLeft, line.x)
            colRight = max(colRight, line.x + line.width)
            val colMaxWidth = max(40f, colRight - line.x)

            // Measure nearest line below in same column to estimate lineSpacing
            var measuredSpacing = line.fontSize * 1.32f
            for (nextIdx in (idx + 1) until interimLines.size) {
                val nextLine = interimLines[nextIdx]
                val dy = nextLine.yBaseline - line.yBaseline
                if (dy < 3f) continue
                val overlapsHoriz = nextLine.x < colRight && (nextLine.x + nextLine.width) > colLeft
                if (overlapsHoriz && abs(nextLine.fontSize - line.fontSize) <= 2.5f) {
                    if (dy in (line.fontSize * 0.95f)..(line.fontSize * 2.1f)) {
                        measuredSpacing = dy
                    }
                    break
                }
            }

            val bulletMatch = BULLET_PREFIXES.firstOrNull { line.text.startsWith(it) } ?: ""
            val textStartX = if (bulletMatch.isNotEmpty()) {
                line.x + (line.fontSize * 0.85f)
            } else {
                line.x
            }

            LineModel(
                id = "p${pageIdx}_l$idx",
                pageIndex = pageIdx,
                x = line.x,
                yBaseline = line.yBaseline,
                yTop = max(0f, line.yBaseline - line.fontSize * 0.88f),
                yBottom = min(pageH, line.yBaseline + line.fontSize * 0.30f),
                width = line.width,
                height = line.height,
                fontName = line.primaryRun.fontName,
                cleanFamily = line.primaryRun.cleanFamily,
                fontSize = line.primaryRun.fontSize,
                isBold = line.primaryRun.isBold,
                isItalic = line.primaryRun.isItalic,
                isSerif = line.primaryRun.isSerif,
                isMono = line.primaryRun.isMono,
                fontWeight = line.primaryRun.fontWeight,
                colorHex = line.primaryRun.colorHex,
                capHeight = line.primaryRun.capHeight,
                text = line.text,
                colLeft = colLeft,
                colRight = colRight,
                colMaxWidth = colMaxWidth,
                lineSpacing = measuredSpacing,
                leadingBullet = bulletMatch,
                textStartX = textStartX,
                runs = line.runs,
            )
        }
    }

    private data class InterimLine(
        val x: Float,
        val yBaseline: Float,
        val width: Float,
        val height: Float,
        val fontSize: Float,
        val text: String,
        val primaryRun: StyledRunModel,
        val runs: List<StyledRunModel>,
    )

    private fun buildInterimLine(glyphs: List<RawGlyph>): InterimLine? {
        // Trim leading/trailing pure whitespace glyphs
        val nonBlank = glyphs.dropWhile { it.unicode.isBlank() }.dropLastWhile { it.unicode.isBlank() }
        if (nonBlank.isEmpty()) return null

        val runs = mutableListOf<StyledRunModel>()
        val fullText = StringBuilder()

        var curRunText = StringBuilder()
        var curRunStart = nonBlank.first()
        var curRunEndX = curRunStart.x + curRunStart.width
        var prevGlyph: RawGlyph? = null

        fun flushRun() {
            val s = curRunText.toString()
            if (s.isNotEmpty()) {
                runs.add(
                    StyledRunModel(
                        text = s,
                        x = curRunStart.x,
                        width = max(0.5f, curRunEndX - curRunStart.x),
                        fontName = curRunStart.fontName,
                        cleanFamily = curRunStart.cleanFamily,
                        fontSize = curRunStart.fontSize,
                        isBold = curRunStart.isBold,
                        isItalic = curRunStart.isItalic,
                        isSerif = curRunStart.isSerif,
                        isMono = curRunStart.isMono,
                        fontWeight = curRunStart.fontWeight,
                        colorHex = curRunStart.colorHex,
                        capHeight = curRunStart.capHeight,
                        pdfFont = curRunStart.font,
                    ),
                )
            }
            curRunText = StringBuilder()
        }

        for (g in nonBlank) {
            if (prevGlyph != null) {
                val gap = g.x - (prevGlyph.x + prevGlyph.width)
                val spaceThreshold = max(1.0f, prevGlyph.spaceWidth * 0.36f)
                val needsSpace = gap > spaceThreshold &&
                    !prevGlyph.unicode.endsWith(" ") &&
                    !g.unicode.startsWith(" ")

                val sameStyle = prevGlyph.fontName == g.fontName &&
                    abs(prevGlyph.fontSize - g.fontSize) < 0.6f &&
                    prevGlyph.colorHex == g.colorHex &&
                    prevGlyph.isBold == g.isBold &&
                    prevGlyph.isItalic == g.isItalic

                if (!sameStyle) {
                    if (needsSpace) {
                        curRunText.append(' ')
                        fullText.append(' ')
                    }
                    flushRun()
                    curRunStart = g
                } else if (needsSpace) {
                    curRunText.append(' ')
                    fullText.append(' ')
                }
            }

            curRunText.append(g.unicode)
            fullText.append(g.unicode)
            curRunEndX = max(curRunEndX, g.x + g.width)
            prevGlyph = g
        }
        flushRun()

        val textStr = fullText.toString().trim()
        if (textStr.isEmpty() || runs.isEmpty()) return null

        // Choose dominant run (longest non-space text, excluding 1-char bullet symbol)
        val primaryRun = runs
            .filter { it.text.trim().length > 1 }
            .maxByOrNull { it.text.length }
            ?: runs.maxByOrNull { it.text.length }
            ?: runs.first()

        val minX = nonBlank.minOf { it.x }
        val maxX = nonBlank.maxOf { it.x + it.width }
        val avgY = nonBlank.map { it.yBaseline }.average().toFloat()
        val maxFontSize = nonBlank.maxOf { it.fontSize }
        val maxH = nonBlank.maxOf { it.height }

        return InterimLine(
            x = minX,
            yBaseline = avgY,
            width = max(1f, maxX - minX),
            height = maxH,
            fontSize = maxFontSize,
            text = textStr,
            primaryRun = primaryRun,
            runs = runs,
        )
    }

    private fun detectColumnGutter(lines: List<InterimLine>, pageW: Float): Float? {
        if (lines.size < 8) return null
        val startSearch = (pageW * 0.25f).roundToInt()
        val endSearch = (pageW * 0.68f).roundToInt()
        if (endSearch <= startSearch + 14) return null

        var bestStart = -1
        var bestLen = 0
        var curStart = -1
        var curLen = 0

        for (x in startSearch..endSearch) {
            val xf = x.toFloat()
            val crossed = lines.count { it.x < xf && (it.x + it.width) > xf }
            // Allow at most 1 wide title/header crossing at top of resume
            if (crossed <= 1) {
                if (curStart == -1) curStart = x
                curLen++
                if (curLen > bestLen) {
                    bestLen = curLen
                    bestStart = curStart
                }
            } else {
                curStart = -1
                curLen = 0
            }
        }

        if (bestLen < 14 || bestStart == -1) return null
        val center = bestStart + bestLen / 2f
        val leftCount = lines.count { (it.x + it.width) <= center }
        val rightCount = lines.count { it.x >= center }
        return if (leftCount >= 4 && rightCount >= 4) center else null
    }
}
