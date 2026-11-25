package com.preprole.pdf

import android.content.Context
import android.graphics.RectF
import com.tom_roush.pdfbox.contentstream.operator.Operator
import com.tom_roush.pdfbox.cos.COSArray
import com.tom_roush.pdfbox.cos.COSBase
import com.tom_roush.pdfbox.cos.COSFloat
import com.tom_roush.pdfbox.cos.COSInteger
import com.tom_roush.pdfbox.cos.COSName
import com.tom_roush.pdfbox.cos.COSNumber
import com.tom_roush.pdfbox.cos.COSString
import com.tom_roush.pdfbox.pdfparser.PDFStreamParser
import com.tom_roush.pdfbox.pdfwriter.ContentStreamWriter
import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.pdmodel.PDPageContentStream
import com.tom_roush.pdfbox.pdmodel.PDResources
import com.tom_roush.pdfbox.pdmodel.common.PDStream
import com.tom_roush.pdfbox.pdmodel.font.PDFont
import com.tom_roush.pdfbox.pdmodel.graphics.form.PDFormXObject
import com.tom_roush.pdfbox.util.Matrix
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Stack
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

data class PdfEditInstruction(
    val id: String,
    val action: String, // "replace" | "insert_after"
    val targetLineIds: List<String>,
    val newText: String,
    val preserveBoldPrefix: Boolean = true,
)

data class PdfEditResult(
    val outputPath: String,
    val outputUri: String,
    val appliedCount: Int,
    val pageCount: Int,
    val fontMatchDetails: List<String>,
)

private data class RemovalBox(
    val xMin: Float,
    val xMax: Float,
    val yBaselineMin: Float,
    val yBaselineMax: Float,
)

private data class ShiftZone(
    val afterY: Float,
    val colLeft: Float,
    val colRight: Float,
    val deltaY: Float,
)

private data class StyledSegment(
    val text: String,
    val font: PDFont,
    val fontSize: Float,
    val colorHex: String,
    val isStandardFallback: Boolean,
)

private data class WrappedLineDraw(
    val segments: List<StyledSegment>,
    val x: Float,
    val yBaseline: Float,
)

private data class PendingBlockDraw(
    val lines: List<WrappedLineDraw>,
    val origTopY: Float,
    val colLeft: Float,
    val colRight: Float,
)

object PdfSurgicalEditor {

    private val BULLET_PREFIXES = listOf("• ", "● ", "◦ ", "▪ ", "▫ ", "‣ ", "- ", "– ", "* ")

    fun applyEdits(
        context: Context,
        inputFile: File,
        outputFile: File,
        edits: List<PdfEditInstruction>,
        downloadedFontPaths: Map<String, String>,
    ): PdfEditResult {
        PDDocument.load(inputFile).use { document ->
            val structure = PdfStructureExtractor.extract(document)
            val fontResolver = PdfFontResolver(context, document, downloadedFontPaths)
            val fontDetails = linkedSetOf<String>()

            val lineMap = mutableMapOf<String, LineModel>()
            for (page in structure.pages) {
                for (line in page.lines) {
                    lineMap[line.id] = line
                }
            }

            // Group edits by pageIndex
            val editsByPage = mutableMapOf<Int, MutableList<Pair<PdfEditInstruction, List<LineModel>>>>()
            for (edit in edits) {
                if (edit.newText.isBlank()) continue
                val targets = edit.targetLineIds.mapNotNull { lineMap[it] }
                if (targets.isEmpty()) continue
                val pageIdx = targets.first().pageIndex
                val samePageTargets = targets
                    .filter { it.pageIndex == pageIdx }
                    .sortedWith(compareBy<LineModel> { it.yBaseline }.thenBy { it.x })
                if (samePageTargets.isEmpty()) continue
                editsByPage.getOrPut(pageIdx) { mutableListOf() }.add(edit to samePageTargets)
            }

            var totalApplied = 0
            // Track shared FormXObjects across pages so modifying one page never alters another
            val xObjectUsageCounts = countFormXObjectUsages(document)

            for ((pageIdx, pageEdits) in editsByPage) {
                if (pageIdx < 0 || pageIdx >= document.numberOfPages) continue
                val page = document.getPage(pageIdx)
                val pageModel = structure.pages[pageIdx]

                // Sort edits top-to-bottom so vertical reflow accumulates accurately
                val sortedEdits = pageEdits.sortedBy { it.second.first().yBaseline }

                val removalBoxes = mutableListOf<RemovalBox>()
                val shiftZones = mutableListOf<ShiftZone>()
                val pendingDraws = mutableListOf<PendingBlockDraw>()

                val replacedLineIds = mutableSetOf<String>()
                for ((edit, targets) in sortedEdits) {
                    if (edit.action != "insert_after") {
                        targets.forEach { replacedLineIds.add(it.id) }
                    }
                }

                for ((edit, targets) in sortedEdits) {
                    val primaryLine = targets.first()
                    val lastLine = targets.last()
                    val isInsertAfter = edit.action == "insert_after"

                    // Calculate prior shifts above this block in the same column
                    val priorShift = cumulativeShiftAt(
                        y = primaryLine.yBaseline,
                        x = primaryLine.x,
                        shiftZones = shiftZones,
                    )

                    val colLeft = targets.minOf { it.colLeft }
                    val colRight = targets.maxOf { it.colRight }
                    val baseX = primaryLine.x
                    val availableWidth = max(48f, colRight - baseX)

                    // Hanging indent detection for wrapped bullet items
                    val bulletPrefix = BULLET_PREFIXES.firstOrNull { edit.newText.startsWith(it) }
                        ?: primaryLine.leadingBullet
                    val continuationX = when {
                        targets.size >= 2 && targets[1].x > baseX + 4f && targets[1].x < baseX + 32f -> targets[1].x
                        bulletPrefix.isNotEmpty() -> baseX + max(7f, primaryLine.fontSize * 0.85f)
                        else -> baseX
                    }

                    // Resolve fonts (including optional bold-prefix + regular-body pair)
                    val firstRun = primaryLine.runs.firstOrNull()
                    val secondRun = primaryLine.runs.getOrNull(1)
                    val hasBoldPrefixStyle = edit.preserveBoldPrefix &&
                        firstRun != null && secondRun != null &&
                        firstRun.isBold && !secondRun.isBold &&
                        firstRun.text.trimEnd().endsWith(":")

                    val colonIdx = if (hasBoldPrefixStyle) edit.newText.indexOf(':') else -1
                    val useSplitBold = hasBoldPrefixStyle && colonIdx in 1..48

                    val primaryRun = if (useSplitBold) secondRun!! else (firstRun ?: primaryLine.runs.first())
                    val bodyResolved = fontResolver.resolveForRun(
                        originalFont = primaryRun.pdfFont,
                        cleanFamily = primaryRun.cleanFamily,
                        fontName = primaryRun.fontName,
                        isBold = primaryRun.isBold,
                        isItalic = primaryRun.isItalic,
                        isSerif = primaryRun.isSerif,
                        isMono = primaryRun.isMono,
                        fontWeight = primaryRun.fontWeight,
                        origCapHeight = primaryRun.capHeight,
                        textToRender = edit.newText,
                    )
                    fontDetails.add("${primaryRun.cleanFamily} -> ${bodyResolved.source}")

                    val prefixResolved = if (useSplitBold) {
                        val prefixText = edit.newText.substring(0, colonIdx + 1)
                        fontResolver.resolveForRun(
                            originalFont = firstRun.pdfFont,
                            cleanFamily = firstRun.cleanFamily,
                            fontName = firstRun.fontName,
                            isBold = firstRun.isBold,
                            isItalic = firstRun.isItalic,
                            isSerif = firstRun.isSerif,
                            isMono = firstRun.isMono,
                            fontWeight = firstRun.fontWeight,
                            origCapHeight = firstRun.capHeight,
                            textToRender = prefixText,
                        )
                    } else {
                        null
                    }

                    var effectiveFontSize = primaryLine.fontSize * bodyResolved.sizeMultiplier
                    var effectiveLineSpacing = max(effectiveFontSize * 1.12f, primaryLine.lineSpacing)

                    // Wrap lines
                    var wrapped = wrapStyledText(
                        fullText = edit.newText.trim(),
                        splitBoldAt = if (useSplitBold) colonIdx + 1 else -1,
                        prefixResolved = prefixResolved,
                        prefixOrigRun = firstRun,
                        bodyResolved = bodyResolved,
                        bodyColorHex = primaryLine.colorHex,
                        fontSize = effectiveFontSize,
                        firstLineX = baseX,
                        continuationX = continuationX,
                        colRight = colRight,
                    )

                    if (wrapped.isEmpty()) continue

                    if (!isInsertAfter) {
                        // Record removal boxes for every targeted line
                        for (tLine in targets) {
                            val tolY = max(3.2f, tLine.fontSize * 0.45f)
                            removalBoxes.add(
                                RemovalBox(
                                    xMin = tLine.x - 2.5f,
                                    xMax = tLine.x + tLine.width + 3.0f,
                                    yBaselineMin = tLine.yBaseline - tolY,
                                    yBaselineMax = tLine.yBaseline + tolY,
                                ),
                            )
                        }
                    }

                    val origFirstY = if (isInsertAfter) {
                        lastLine.yBaseline + effectiveLineSpacing
                    } else {
                        primaryLine.yBaseline
                    }

                    val origBlockHeight = if (isInsertAfter) {
                        0f
                    } else {
                        max(effectiveLineSpacing, (lastLine.yBaseline - primaryLine.yBaseline) + effectiveLineSpacing)
                    }

                    // Measure natural gap to next untouched line below in same column
                    val nextUntouchedLine = pageModel.lines.firstOrNull { candidate ->
                        !replacedLineIds.contains(candidate.id) &&
                            candidate.yBaseline > lastLine.yBaseline + 2f &&
                            candidate.x < colRight - 4f &&
                            (candidate.x + candidate.width) > colLeft + 4f
                    }

                    val lowestInColumn = pageModel.lines
                        .filter { it.x < colRight - 4f && (it.x + it.width) > colLeft + 4f }
                        .maxOfOrNull { it.yBottom } ?: lastLine.yBottom

                    val bottomMargin = max(24f, pageModel.height * 0.035f)
                    val maxAdditionalPageRoom = max(0f, (pageModel.height - bottomMargin) - (lowestInColumn + totalShiftInColumn(shiftZones, colLeft, colRight)))

                    val naturalGapBelow = if (nextUntouchedLine != null) {
                        max(0f, (nextUntouchedLine.yBaseline - lastLine.yBaseline) - effectiveLineSpacing)
                    } else {
                        maxAdditionalPageRoom
                    }

                    var neededHeight = wrapped.size * effectiveLineSpacing
                    var extraNeeded = max(0f, neededHeight - origBlockHeight)

                    // Gently tighten spacing / font size slightly if needed to avoid overflowing page bottom
                    if (extraNeeded > naturalGapBelow + maxAdditionalPageRoom) {
                        effectiveLineSpacing = max(effectiveFontSize * 1.05f, effectiveLineSpacing * 0.90f)
                        effectiveFontSize *= 0.94f
                        wrapped = wrapStyledText(
                            fullText = edit.newText.trim(),
                            splitBoldAt = if (useSplitBold) colonIdx + 1 else -1,
                            prefixResolved = prefixResolved,
                            prefixOrigRun = firstRun,
                            bodyResolved = bodyResolved,
                            bodyColorHex = primaryLine.colorHex,
                            fontSize = effectiveFontSize,
                            firstLineX = baseX,
                            continuationX = continuationX,
                            colRight = colRight,
                        )
                        neededHeight = wrapped.size * effectiveLineSpacing
                        extraNeeded = max(0f, neededHeight - origBlockHeight)
                    }

                    // Compute how much lines below in this column need to shift down
                    val usableGap = naturalGapBelow * 0.72f
                    val rawShiftDown = max(0f, extraNeeded - usableGap)
                    val safeShiftDown = min(rawShiftDown, maxAdditionalPageRoom)

                    // If page has zero remaining room and we'd collide, compress spacing so we fit above next line
                    if (rawShiftDown > safeShiftDown + 2f && nextUntouchedLine != null) {
                        val maxAllowedBlockH = origBlockHeight + usableGap + safeShiftDown
                        if (wrapped.size > 1 && maxAllowedBlockH > effectiveFontSize) {
                            effectiveLineSpacing = max(effectiveFontSize * 0.98f, maxAllowedBlockH / wrapped.size)
                        }
                    }

                    val draws = wrapped.mapIndexed { idx, wLine ->
                        WrappedLineDraw(
                            segments = wLine.segments,
                            x = wLine.x,
                            yBaseline = origFirstY + priorShift + (idx * effectiveLineSpacing),
                        )
                    }

                    pendingDraws.add(
                        PendingBlockDraw(
                            lines = draws,
                            origTopY = origFirstY,
                            colLeft = colLeft,
                            colRight = colRight,
                        ),
                    )

                    if (safeShiftDown > 0.5f) {
                        shiftZones.add(
                            ShiftZone(
                                afterY = lastLine.yBaseline + 1.5f,
                                colLeft = colLeft,
                                colRight = colRight,
                                deltaY = safeShiftDown,
                            ),
                        )
                    }

                    totalApplied++
                }

                if (removalBoxes.isEmpty() && shiftZones.isEmpty() && pendingDraws.isEmpty()) {
                    continue
                }

                // Step A: Clone any Form XObjects shared with other pages before rewriting
                isolateSharedFormXObjects(document, page, xObjectUsageCounts)

                // Step B: Rewrite page content stream (strip removed text operators, shift lower blocks)
                rewritePageContentStream(document, page, pageModel, removalBoxes, shiftZones)

                // Step C: Draw replacement / inserted lines onto page with exact colors & matched fonts
                PDPageContentStream(
                    document,
                    page,
                    PDPageContentStream.AppendMode.APPEND,
                    true,
                    true,
                ).use { cs ->
                    for (block in pendingDraws) {
                        for (lineDraw in block.lines) {
                            var cursorX = lineDraw.x
                            val yDraw = lineDraw.yBaseline
                            for (seg in lineDraw.segments) {
                                val textToDraw = if (seg.isStandardFallback) {
                                    PdfFontResolver.sanitizeForStandard14(seg.text)
                                } else {
                                    seg.text
                                }
                                if (textToDraw.isEmpty()) continue

                                val (r, g, b) = parseHexRgb(seg.colorHex)
                                cs.setNonStrokingColor(r / 255f, g / 255f, b / 255f)
                                cs.beginText()
                                cs.setFont(seg.font, seg.fontSize)
                                val tm = visualToPdfTextMatrix(pageModel, cursorX, yDraw)
                                cs.setTextMatrix(tm)
                                cs.showText(textToDraw)
                                cs.endText()

                                val adv = try {
                                    (seg.font.getStringWidth(textToDraw) / 1000f) * seg.fontSize
                                } catch (_: Exception) {
                                    textToDraw.length * seg.fontSize * 0.48f
                                }
                                cursorX += adv
                            }
                        }
                    }
                }
            }

            if (outputFile.parentFile?.exists() == false) {
                outputFile.parentFile?.mkdirs()
            }
            document.save(outputFile)

            return PdfEditResult(
                outputPath = outputFile.absolutePath,
                outputUri = "file://${outputFile.absolutePath}",
                appliedCount = totalApplied,
                pageCount = document.numberOfPages,
                fontMatchDetails = fontDetails.toList(),
            )
        }
    }

    private data class WrappedLineTmp(
        val segments: List<StyledSegment>,
        val x: Float,
    )

    private fun wrapStyledText(
        fullText: String,
        splitBoldAt: Int,
        prefixResolved: ResolvedPdfFont?,
        prefixOrigRun: StyledRunModel?,
        bodyResolved: ResolvedPdfFont,
        bodyColorHex: String,
        fontSize: Float,
        firstLineX: Float,
        continuationX: Float,
        colRight: Float,
    ): List<WrappedLineTmp> {
        val result = mutableListOf<WrappedLineTmp>()
        val paragraphs = fullText.split("\n")

        var globalCharCursor = 0
        for ((pIdx, para) in paragraphs.withIndex()) {
            val trimmedPara = para.trim()
            if (trimmedPara.isEmpty()) {
                globalCharCursor += para.length + 1
                continue
            }

            val words = trimmedPara.split(Regex("\\s+"))
            val prefixPart = if (pIdx == 0 && splitBoldAt > 0 && trimmedPara.length >= splitBoldAt) {
                trimmedPara.substring(0, splitBoldAt)
            } else {
                null
            }

            // Build token list with style info
            val styledTokens = mutableListOf<Pair<String, Boolean>>() // word to isPrefixBold
            if (prefixPart != null && prefixResolved != null && prefixOrigRun != null) {
                val prefixWords = prefixPart.trim().split(Regex("\\s+"))
                val restStr = trimmedPara.substring(splitBoldAt).trimStart()
                val restWords = if (restStr.isEmpty()) emptyList() else restStr.split(Regex("\\s+"))
                prefixWords.forEach { styledTokens.add(it to true) }
                restWords.forEach { styledTokens.add(it to false) }
            } else {
                words.forEach { styledTokens.add(it to false) }
            }

            var currentLineTokens = mutableListOf<Pair<String, Boolean>>()
            var isFirstVisualLine = (pIdx == 0 && result.isEmpty())

            fun lineMaxW(firstLine: Boolean): Float {
                val startX = if (firstLine) firstLineX else continuationX
                return max(40f, colRight - startX)
            }

            fun measureTokensWidth(tokens: List<Pair<String, Boolean>>): Float {
                var w = 0f
                for ((i, tok) in tokens.withIndex()) {
                    val wordText = if (i == 0) tok.first else " ${tok.first}"
                    val isPfx = tok.second && prefixResolved != null && prefixOrigRun != null
                    val f = if (isPfx) prefixResolved!!.font else bodyResolved.font
                    val fSize = if (isPfx) (prefixOrigRun!!.fontSize * prefixResolved!!.sizeMultiplier) else fontSize
                    val safeText = if ((isPfx && prefixResolved!!.isStandardFallback) || (!isPfx && bodyResolved.isStandardFallback)) {
                        PdfFontResolver.sanitizeForStandard14(wordText)
                    } else {
                        wordText
                    }
                    w += try {
                        (f.getStringWidth(safeText) / 1000f) * fSize
                    } catch (_: Exception) {
                        safeText.length * fSize * 0.5f
                    }
                }
                return w
            }

            fun flushCurrentLine(firstLine: Boolean) {
                if (currentLineTokens.isEmpty()) return
                val startX = if (firstLine) firstLineX else continuationX
                val segs = mutableListOf<StyledSegment>()
                var curIsBoldPfx = currentLineTokens.first().second
                var sb = StringBuilder()

                for ((i, tok) in currentLineTokens.withIndex()) {
                    val piece = if (i == 0) tok.first else " ${tok.first}"
                    if (tok.second != curIsBoldPfx && sb.isNotEmpty()) {
                        val isPfx = curIsBoldPfx && prefixResolved != null && prefixOrigRun != null
                        segs.add(
                            StyledSegment(
                                text = sb.toString(),
                                font = if (isPfx) prefixResolved!!.font else bodyResolved.font,
                                fontSize = if (isPfx) (prefixOrigRun!!.fontSize * prefixResolved!!.sizeMultiplier) else fontSize,
                                colorHex = if (isPfx) prefixOrigRun!!.colorHex else bodyColorHex,
                                isStandardFallback = if (isPfx) prefixResolved!!.isStandardFallback else bodyResolved.isStandardFallback,
                            ),
                        )
                        sb = StringBuilder()
                        curIsBoldPfx = tok.second
                    }
                    sb.append(piece)
                }
                if (sb.isNotEmpty()) {
                    val isPfx = curIsBoldPfx && prefixResolved != null && prefixOrigRun != null
                    segs.add(
                        StyledSegment(
                            text = sb.toString(),
                            font = if (isPfx) prefixResolved!!.font else bodyResolved.font,
                            fontSize = if (isPfx) (prefixOrigRun!!.fontSize * prefixResolved!!.sizeMultiplier) else fontSize,
                            colorHex = if (isPfx) prefixOrigRun!!.colorHex else bodyColorHex,
                            isStandardFallback = if (isPfx) prefixResolved!!.isStandardFallback else bodyResolved.isStandardFallback,
                        ),
                    )
                }

                result.add(WrappedLineTmp(segments = segs, x = startX))
                currentLineTokens = mutableListOf()
            }

            for (tok in styledTokens) {
                val candidate = currentLineTokens + tok
                if (currentLineTokens.isNotEmpty() && measureTokensWidth(candidate) > lineMaxW(isFirstVisualLine)) {
                    flushCurrentLine(isFirstVisualLine)
                    isFirstVisualLine = false
                }
                currentLineTokens.add(tok)
            }
            flushCurrentLine(isFirstVisualLine)
            globalCharCursor += para.length + 1
        }

        return result
    }

    private fun cumulativeShiftAt(y: Float, x: Float, shiftZones: List<ShiftZone>): Float {
        var total = 0f
        for (z in shiftZones) {
            if (y >= z.afterY && x >= z.colLeft - 10f && x <= z.colRight + 10f) {
                total += z.deltaY
            }
        }
        return total
    }

    private fun totalShiftInColumn(shiftZones: List<ShiftZone>, colLeft: Float, colRight: Float): Float {
        return shiftZones
            .filter { it.colLeft < colRight && it.colRight > colLeft }
            .sumOf { it.deltaY.toDouble() }
            .toFloat()
    }

    private fun countFormXObjectUsages(document: PDDocument): Map<com.tom_roush.pdfbox.cos.COSStream, Int> {
        val counts = mutableMapOf<com.tom_roush.pdfbox.cos.COSStream, Int>()
        for (i in 0 until document.numberOfPages) {
            val res = document.getPage(i).resources ?: continue
            for (name in res.xObjectNames) {
                val xobj = try { res.getXObject(name) } catch (_: Exception) { null }
                if (xobj is PDFormXObject) {
                    val key = xobj.cosObject
                    counts[key] = (counts[key] ?: 0) + 1
                }
            }
        }
        return counts
    }

    private fun isolateSharedFormXObjects(
        document: PDDocument,
        page: PDPage,
        usageCounts: Map<com.tom_roush.pdfbox.cos.COSStream, Int>,
    ) {
        val res = page.resources ?: return
        for (name in res.xObjectNames.toList()) {
            val xobj = try { res.getXObject(name) } catch (_: Exception) { null }
            if (xobj is PDFormXObject && (usageCounts[xobj.cosObject] ?: 0) > 1) {
                val bytes = xobj.contentStream.createInputStream().use { it.readBytes() }
                val cloned = PDFormXObject(PDStream(document, bytes.inputStream(), COSName.FLATE_DECODE))
                cloned.bBox = xobj.bBox
                cloned.setMatrix(xobj.matrix.createAffineTransform())
                cloned.resources = xobj.resources
                res.put(name, cloned)
            }
        }
    }

    private fun rewritePageContentStream(
        document: PDDocument,
        page: PDPage,
        pageModel: PageStructureModel,
        removalBoxes: List<RemovalBox>,
        shiftZones: List<ShiftZone>,
    ) {
        val parser = PDFStreamParser(page)
        parser.parse()
        val tokens = parser.tokens
        val rewritten = processTokenList(
            document = document,
            tokens = tokens,
            resources = page.resources,
            pageModel = pageModel,
            initialCtm = Matrix(),
            removalBoxes = removalBoxes,
            shiftZones = shiftZones,
        )

        val newStream = PDStream(document)
        newStream.createOutputStream(COSName.FLATE_DECODE).use { out ->
            ContentStreamWriter(out).writeTokens(rewritten)
        }
        page.setContents(newStream)
    }

    private data class GraphicsSnapshot(
        val ctm: Matrix,
        val fontName: COSName?,
        val fontSize: Float,
        val charSpacing: Float,
        val wordSpacing: Float,
        val horizScaling: Float,
        val leading: Float,
    )

    private fun processTokenList(
        document: PDDocument,
        tokens: List<Any>,
        resources: PDResources?,
        pageModel: PageStructureModel,
        initialCtm: Matrix,
        removalBoxes: List<RemovalBox>,
        shiftZones: List<ShiftZone>,
    ): List<Any> {
        val out = mutableListOf<Any>()
        val operands = mutableListOf<Any>()

        val stateStack = Stack<GraphicsSnapshot>()
        var ctm = initialCtm.clone()
        var currentFontName: COSName? = null
        var currentFontSize = 10f
        var charSpacing = 0f
        var wordSpacing = 0f
        var horizScaling = 100f
        var leading = 0f

        var inText = false
        var tm = Matrix()
        var tlm = Matrix()
        var emittedDeltaY = 0f

        // Track simple path commands so horizontal divider rules in shifted zones move down too
        val pendingPathOps = mutableListOf<Pair<List<Any>, String>>()

        fun flushPathOps() {
            for ((ops, opName) in pendingPathOps) {
                out.addAll(ops)
                out.add(Operator.getOperator(opName))
            }
            pendingPathOps.clear()
        }

        fun getFont(): PDFont? {
            return if (currentFontName != null && resources != null) {
                try { resources.getFont(currentFontName) } catch (_: Exception) { null }
            } else null
        }

        fun advanceMatrix(strBytes: ByteArray): Float {
            val font = getFont()
            if (font == null) {
                return strBytes.size * currentFontSize * 0.5f * (horizScaling / 100f)
            }
            return try {
                val input = java.io.ByteArrayInputStream(strBytes)
                var totalDisp = 0f
                while (input.available() > 0) {
                    val code = font.readCode(input)
                    val glyphW = font.getWidth(code)
                    totalDisp += (glyphW / 1000f) * currentFontSize * (horizScaling / 100f) + charSpacing
                    if (code == 32) {
                        totalDisp += wordSpacing
                    }
                }
                totalDisp
            } catch (_: Exception) {
                strBytes.size * currentFontSize * 0.5f * (horizScaling / 100f)
            }
        }

        fun visualPointOf(m: Matrix): Pair<Float, Float> {
            val trm = m.multiply(ctm)
            return pdfUserToVisual(pageModel, trm.translateX, trm.translateY)
        }

        fun emitAdjustedTmIfNeeded(wantedDeltaY: Float) {
            if (abs(wantedDeltaY - emittedDeltaY) < 0.05f) return
            val shifted = shiftVisualDeltaOntoTm(tm, ctm, pageModel, wantedDeltaY)
            out.add(COSFloat(shifted.scaleX))
            out.add(COSFloat(shifted.shearY))
            out.add(COSFloat(shifted.shearX))
            out.add(COSFloat(shifted.scaleY))
            out.add(COSFloat(shifted.translateX))
            out.add(COSFloat(shifted.translateY))
            out.add(Operator.getOperator("Tm"))
            emittedDeltaY = wantedDeltaY
        }

        for (token in tokens) {
            if (token !is Operator) {
                operands.add(token)
                continue
            }

            val opName = token.name

            // Collect simple line/rect path construction ops to optionally shift horizontal dividers
            if (opName == "m" || opName == "l" || opName == "re") {
                pendingPathOps.add(operands.toList() to opName)
                operands.clear()
                continue
            }
            if (pendingPathOps.isNotEmpty() && (opName == "S" || opName == "s" || opName == "f" || opName == "F" || opName == "f*" || opName == "B")) {
                if (shiftZones.isNotEmpty()) {
                    shiftPathOpsIfHorizontalDivider(pendingPathOps, ctm, pageModel, shiftZones)
                }
                flushPathOps()
                out.addAll(operands)
                out.add(token)
                operands.clear()
                continue
            }
            if (pendingPathOps.isNotEmpty()) {
                flushPathOps()
            }

            when (opName) {
                "q" -> {
                    stateStack.push(
                        GraphicsSnapshot(
                            ctm = ctm.clone(),
                            fontName = currentFontName,
                            fontSize = currentFontSize,
                            charSpacing = charSpacing,
                            wordSpacing = wordSpacing,
                            horizScaling = horizScaling,
                            leading = leading,
                        ),
                    )
                    out.addAll(operands)
                    out.add(token)
                }
                "Q" -> {
                    if (stateStack.isNotEmpty()) {
                        val snap = stateStack.pop()
                        ctm = snap.ctm
                        currentFontName = snap.fontName
                        currentFontSize = snap.fontSize
                        charSpacing = snap.charSpacing
                        wordSpacing = snap.wordSpacing
                        horizScaling = snap.horizScaling
                        leading = snap.leading
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "cm" -> {
                    if (operands.size >= 6) {
                        val m = matrixFromOperands(operands)
                        ctm = m.multiply(ctm)
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "BT" -> {
                    inText = true
                    tm = Matrix()
                    tlm = Matrix()
                    emittedDeltaY = 0f
                    out.addAll(operands)
                    out.add(token)
                }
                "ET" -> {
                    inText = false
                    emittedDeltaY = 0f
                    out.addAll(operands)
                    out.add(token)
                }
                "Tf" -> {
                    if (operands.size >= 2) {
                        currentFontName = operands[0] as? COSName
                        currentFontSize = (operands[1] as? COSNumber)?.floatValue() ?: currentFontSize
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "Tc" -> {
                    if (operands.isNotEmpty()) charSpacing = (operands[0] as? COSNumber)?.floatValue() ?: charSpacing
                    out.addAll(operands)
                    out.add(token)
                }
                "Tw" -> {
                    if (operands.isNotEmpty()) wordSpacing = (operands[0] as? COSNumber)?.floatValue() ?: wordSpacing
                    out.addAll(operands)
                    out.add(token)
                }
                "Tz" -> {
                    if (operands.isNotEmpty()) horizScaling = (operands[0] as? COSNumber)?.floatValue() ?: horizScaling
                    out.addAll(operands)
                    out.add(token)
                }
                "TL" -> {
                    if (operands.isNotEmpty()) leading = (operands[0] as? COSNumber)?.floatValue() ?: leading
                    out.addAll(operands)
                    out.add(token)
                }
                "Tm" -> {
                    if (operands.size >= 6) {
                        tm = matrixFromOperands(operands)
                        tlm = tm.clone()
                        emittedDeltaY = 0f
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "Td" -> {
                    if (operands.size >= 2) {
                        val tx = (operands[0] as? COSNumber)?.floatValue() ?: 0f
                        val ty = (operands[1] as? COSNumber)?.floatValue() ?: 0f
                        tlm = Matrix.getTranslateInstance(tx, ty).multiply(tlm)
                        tm = tlm.clone()
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "TD" -> {
                    if (operands.size >= 2) {
                        val tx = (operands[0] as? COSNumber)?.floatValue() ?: 0f
                        val ty = (operands[1] as? COSNumber)?.floatValue() ?: 0f
                        leading = -ty
                        tlm = Matrix.getTranslateInstance(tx, ty).multiply(tlm)
                        tm = tlm.clone()
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                "T*" -> {
                    tlm = Matrix.getTranslateInstance(0f, -leading).multiply(tlm)
                    tm = tlm.clone()
                    out.addAll(operands)
                    out.add(token)
                }
                "Tj", "'", "\"" -> {
                    if (opName == "'") {
                        tlm = Matrix.getTranslateInstance(0f, -leading).multiply(tlm)
                        tm = tlm.clone()
                    } else if (opName == "\"" && operands.size >= 3) {
                        wordSpacing = (operands[0] as? COSNumber)?.floatValue() ?: wordSpacing
                        charSpacing = (operands[1] as? COSNumber)?.floatValue() ?: charSpacing
                        tlm = Matrix.getTranslateInstance(0f, -leading).multiply(tlm)
                        tm = tlm.clone()
                    }

                    val cosStr = operands.lastOrNull() as? COSString
                    if (cosStr != null) {
                        val (vx, vy) = visualPointOf(tm)
                        val strBytes = cosStr.bytes
                        val disp = advanceMatrix(strBytes)
                        val isRemoved = isPointInRemovalBoxes(vx, vy, disp, ctm, tm, removalBoxes)

                        if (isRemoved) {
                            // Keep vertical line move for ' / " while stripping rendered text completely
                            if (opName == "'") {
                                out.add(Operator.getOperator("T*"))
                            } else if (opName == "\"" && operands.size >= 3) {
                                out.add(operands[0])
                                out.add(Operator.getOperator("Tw"))
                                out.add(operands[1])
                                out.add(Operator.getOperator("Tc"))
                                out.add(Operator.getOperator("T*"))
                            }
                            out.add(COSString(ByteArray(0)))
                            out.add(Operator.getOperator("Tj"))
                        } else {
                            if (opName == "'") {
                                out.add(Operator.getOperator("T*"))
                            } else if (opName == "\"" && operands.size >= 3) {
                                out.add(operands[0])
                                out.add(Operator.getOperator("Tw"))
                                out.add(operands[1])
                                out.add(Operator.getOperator("Tc"))
                                out.add(Operator.getOperator("T*"))
                            }
                            val wantedShift = cumulativeShiftAt(vy, vx, shiftZones)
                            if (inText) {
                                emitAdjustedTmIfNeeded(wantedShift)
                            }
                            out.add(cosStr)
                            out.add(Operator.getOperator("Tj"))
                        }
                        tm = Matrix.getTranslateInstance(disp, 0f).multiply(tm)
                    } else {
                        out.addAll(operands)
                        out.add(token)
                    }
                }
                "TJ" -> {
                    val arr = operands.firstOrNull() as? COSArray
                    if (arr != null) {
                        val newArr = COSArray()
                        var anyKept = false
                        var firstKeptShift = 0f
                        var hasFirstKeptShift = false

                        for (elem in arr) {
                            when (elem) {
                                is COSString -> {
                                    val (vx, vy) = visualPointOf(tm)
                                    val disp = advanceMatrix(elem.bytes)
                                    val removed = isPointInRemovalBoxes(vx, vy, disp, ctm, tm, removalBoxes)
                                    if (removed) {
                                        // Preserve horizontal positioning for trailing elements in same TJ
                                        val tjKern = if (currentFontSize != 0f) {
                                            -(disp / (currentFontSize * (horizScaling / 100f))) * 1000f
                                        } else 0f
                                        if (abs(tjKern) > 0.1f) {
                                            newArr.add(COSFloat(tjKern))
                                        }
                                    } else {
                                        if (!hasFirstKeptShift) {
                                            firstKeptShift = cumulativeShiftAt(vy, vx, shiftZones)
                                            hasFirstKeptShift = true
                                        }
                                        newArr.add(elem)
                                        anyKept = true
                                    }
                                    tm = Matrix.getTranslateInstance(disp, 0f).multiply(tm)
                                }
                                is COSNumber -> {
                                    val kernDisp = -(elem.floatValue() / 1000f) * currentFontSize * (horizScaling / 100f)
                                    tm = Matrix.getTranslateInstance(kernDisp, 0f).multiply(tm)
                                    newArr.add(elem)
                                }
                                else -> newArr.add(elem)
                            }
                        }

                        if (!anyKept) {
                            out.add(COSArray())
                            out.add(token)
                        } else {
                            if (inText) {
                                emitAdjustedTmIfNeeded(firstKeptShift)
                            }
                            out.add(newArr)
                            out.add(token)
                        }
                    } else {
                        out.addAll(operands)
                        out.add(token)
                    }
                }
                "Do" -> {
                    val xObjName = operands.firstOrNull() as? COSName
                    val xObj = if (xObjName != null && resources != null) {
                        try { resources.getXObject(xObjName) } catch (_: Exception) { null }
                    } else null

                    if (xObj is PDFormXObject) {
                        val formParser = PDFStreamParser(xObj)
                        formParser.parse()
                        val formCtm = xObj.matrix.multiply(ctm)
                        val rewrittenFormTokens = processTokenList(
                            document = document,
                            tokens = formParser.tokens,
                            resources = xObj.resources ?: resources,
                            pageModel = pageModel,
                            initialCtm = formCtm,
                            removalBoxes = removalBoxes,
                            shiftZones = shiftZones,
                        )
                        xObj.cosObject.createOutputStream(COSName.FLATE_DECODE).use { fOut ->
                            ContentStreamWriter(fOut).writeTokens(rewrittenFormTokens)
                        }
                    }
                    out.addAll(operands)
                    out.add(token)
                }
                else -> {
                    out.addAll(operands)
                    out.add(token)
                }
            }

            operands.clear()
        }

        if (pendingPathOps.isNotEmpty()) {
            flushPathOps()
        }

        return out
    }

    private fun isPointInRemovalBoxes(
        vx: Float,
        vy: Float,
        disp: Float,
        ctm: Matrix,
        tm: Matrix,
        removalBoxes: List<RemovalBox>,
    ): Boolean {
        val trm = tm.multiply(ctm)
        val endX = vx + abs(disp * trm.scaleX)
        val minX = min(vx, endX)
        val maxX = max(vx, endX)
        for (box in removalBoxes) {
            if (vy in box.yBaselineMin..box.yBaselineMax) {
                // Check horizontal overlap (or exact start inside box)
                if (maxX >= box.xMin && minX <= box.xMax) {
                    return true
                }
            }
        }
        return false
    }

    private fun shiftPathOpsIfHorizontalDivider(
        pathOps: MutableList<Pair<List<Any>, String>>,
        ctm: Matrix,
        pageModel: PageStructureModel,
        shiftZones: List<ShiftZone>,
    ) {
        if (pathOps.isEmpty()) return
        // Check 1: Single thin horizontal rectangle `x y w h re`
        if (pathOps.size == 1 && pathOps[0].second == "re" && pathOps[0].first.size >= 4) {
            val ops = pathOps[0].first
            val x = (ops[0] as? COSNumber)?.floatValue() ?: return
            val y = (ops[1] as? COSNumber)?.floatValue() ?: return
            val w = (ops[2] as? COSNumber)?.floatValue() ?: return
            val h = (ops[3] as? COSNumber)?.floatValue() ?: return
            val p1 = ctm.transformPoint(x, y)
            val p2 = ctm.transformPoint(x + w, y + h)
            val (vx1, vy1) = pdfUserToVisual(pageModel, p1.x, p1.y)
            val (vx2, vy2) = pdfUserToVisual(pageModel, p2.x, p2.y)
            if (abs(vy2 - vy1) <= 3.5f && abs(vx2 - vx1) >= 24f) {
                val shift = cumulativeShiftAt(min(vy1, vy2), min(vx1, vx2) + 4f, shiftZones)
                if (shift > 0.5f && pageModel.rotation == 0) {
                    val newY = y - shift
                    pathOps[0] = listOf(ops[0], COSFloat(newY), ops[2], ops[3]) to "re"
                }
            }
            return
        }
        // Check 2: Horizontal line `x1 y1 m x2 y2 l`
        if (pathOps.size == 2 && pathOps[0].second == "m" && pathOps[1].second == "l") {
            val mOps = pathOps[0].first
            val lOps = pathOps[1].first
            if (mOps.size >= 2 && lOps.size >= 2) {
                val x1 = (mOps[0] as? COSNumber)?.floatValue() ?: return
                val y1 = (mOps[1] as? COSNumber)?.floatValue() ?: return
                val x2 = (lOps[0] as? COSNumber)?.floatValue() ?: return
                val y2 = (lOps[1] as? COSNumber)?.floatValue() ?: return
                val p1 = ctm.transformPoint(x1, y1)
                val p2 = ctm.transformPoint(x2, y2)
                val (vx1, vy1) = pdfUserToVisual(pageModel, p1.x, p1.y)
                val (vx2, vy2) = pdfUserToVisual(pageModel, p2.x, p2.y)
                if (abs(vy2 - vy1) <= 2.5f && abs(vx2 - vx1) >= 24f) {
                    val shift = cumulativeShiftAt(vy1, min(vx1, vx2) + 4f, shiftZones)
                    if (shift > 0.5f && pageModel.rotation == 0) {
                        pathOps[0] = listOf(mOps[0], COSFloat(y1 - shift)) to "m"
                        pathOps[1] = listOf(lOps[0], COSFloat(y2 - shift)) to "l"
                    }
                }
            }
        }
    }

    private fun shiftVisualDeltaOntoTm(
        tm: Matrix,
        ctm: Matrix,
        pageModel: PageStructureModel,
        visualDeltaY: Float,
    ): Matrix {
        if (abs(visualDeltaY) < 0.01f) return tm
        // Compute desired user-space shift corresponding to +visualDeltaY down
        val (dux, duy) = when (pageModel.rotation) {
            90 -> visualDeltaY to 0f
            180 -> 0f to visualDeltaY
            270 -> -visualDeltaY to 0f
            else -> 0f to -visualDeltaY
        }
        // Apply user-space shift onto trm = tm * ctm -> tm_new = trm_shifted * ctm.inverse()
        val trm = tm.multiply(ctm)
        val shiftedTrm = trm.clone()
        shiftedTrm.setValue(2, 0, trm.translateX + dux)
        shiftedTrm.setValue(2, 1, trm.translateY + duy)
        // Compute ctm^-1 explicitly: row-major [a b 0; c d 0; e f 1]
        val a = ctm.scaleX
        val b = ctm.shearY
        val c = ctm.shearX
        val d = ctm.scaleY
        val e = ctm.translateX
        val f = ctm.translateY
        val det = a * d - b * c
        if (abs(det) < 1e-6f) {
            val fallback = tm.clone()
            fallback.setValue(2, 1, tm.translateY + duy)
            return fallback
        }
        val invDet = 1f / det
        val ia = d * invDet
        val ib = -b * invDet
        val ic = -c * invDet
        val id = a * invDet
        val ie = (c * f - d * e) * invDet
        val iff = (b * e - a * f) * invDet
        val invCtm = Matrix(ia, ib, ic, id, ie, iff)
        return shiftedTrm.multiply(invCtm)
    }

    private fun pdfUserToVisual(page: PageStructureModel, xUser: Float, yUser: Float): Pair<Float, Float> {
        return when (page.rotation) {
            90 -> (yUser - page.cropBottom) to (xUser - page.cropLeft)
            180 -> (page.cropRight - xUser) to (yUser - page.cropBottom)
            270 -> (page.cropTop - yUser) to (page.cropRight - xUser)
            else -> (xUser - page.cropLeft) to (page.cropTop - yUser)
        }
    }

    private fun visualToPdfTextMatrix(page: PageStructureModel, xVisual: Float, yBaselineVisual: Float): Matrix {
        return when (page.rotation) {
            90 -> {
                val ux = page.cropLeft + yBaselineVisual
                val uy = page.cropBottom + xVisual
                val m = Matrix.getRotateInstance(Math.PI / 2.0, ux, uy)
                m
            }
            180 -> {
                val ux = page.cropRight - xVisual
                val uy = page.cropBottom + yBaselineVisual
                Matrix.getRotateInstance(Math.PI, ux, uy)
            }
            270 -> {
                val ux = page.cropRight - yBaselineVisual
                val uy = page.cropTop - xVisual
                Matrix.getRotateInstance(-Math.PI / 2.0, ux, uy)
            }
            else -> {
                val ux = page.cropLeft + xVisual
                val uy = page.cropTop - yBaselineVisual
                Matrix.getTranslateInstance(ux, uy)
            }
        }
    }

    private fun matrixFromOperands(ops: List<Any>): Matrix {
        val a = (ops[0] as? COSNumber)?.floatValue() ?: 1f
        val b = (ops[1] as? COSNumber)?.floatValue() ?: 0f
        val c = (ops[2] as? COSNumber)?.floatValue() ?: 0f
        val d = (ops[3] as? COSNumber)?.floatValue() ?: 1f
        val e = (ops[4] as? COSNumber)?.floatValue() ?: 0f
        val f = (ops[5] as? COSNumber)?.floatValue() ?: 0f
        return Matrix(a, b, c, d, e, f)
    }

    private fun parseHexRgb(hex: String): Triple<Int, Int, Int> {
        return try {
            val clean = hex.removePrefix("#")
            if (clean.length == 6) {
                Triple(
                    clean.substring(0, 2).toInt(16),
                    clean.substring(2, 4).toInt(16),
                    clean.substring(4, 6).toInt(16),
                )
            } else {
                Triple(17, 17, 17)
            }
        } catch (_: Exception) {
            Triple(17, 17, 17)
        }
    }
}
