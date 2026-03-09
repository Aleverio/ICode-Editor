package com.example.icstudioeditor

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.*
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.*
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * FILE 1: APP EDITOR CORE
 * Optimized for Acode-like experience: Premium Look, Quick Actions, Auto-save, Proactive Smart Scroll.
 */

object NativeEngine {
    init { try { System.loadLibrary("icstudioeditor") } catch(e: Exception) {} }
    external fun updateBuffer(text: String)
    external fun undo(): String
    external fun redo(): String
}

@Composable
fun CodeEditorCore(
    file: FileItem,
    fontSize: Int,
    openFiles: List<FileItem>,
    activeFile: FileItem?,
    onFileChange: (FileItem) -> Unit,
    onFileClose: (FileItem) -> Unit,
    onTextChange: (String) -> Unit,
    viewModel: FileViewModel
) {
    val commonLineHeight = (fontSize + 6).sp
    var textFieldValue by remember(file.uri) { mutableStateOf(TextFieldValue(file.content)) }
    val verticalScrollState = rememberScrollState()
    val horizontalScrollState = rememberScrollState()
    var showSearch by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    val coroutineScope = rememberCoroutineScope()
    
    val clipboardManager = LocalClipboardManager.current
    val context = LocalContext.current
    val density = LocalDensity.current
    
    val searchMatches: List<Pair<Int, Int>> = remember(searchQuery, textFieldValue.text) {
        findAllMatches(searchQuery, textFieldValue.text)
    }
    
    val currentLine = remember(textFieldValue.selection, textFieldValue.text) {
        val start = textFieldValue.selection.start.coerceIn(0, textFieldValue.text.length)
        textFieldValue.text.take(start).count { it == '\n' }
    }
    
    val currentColumn = remember(textFieldValue.selection, textFieldValue.text) {
        val start = textFieldValue.selection.start.coerceIn(0, textFieldValue.text.length)
        val lastNewline = textFieldValue.text.lastIndexOf('\n', start - 1)
        start - lastNewline - 1
    }

    // PROACTIVE SMART SCROLL: Immediately follow cursor line changes
    LaunchedEffect(currentLine) {
        val lineHeightPx = with(density) { commonLineHeight.toPx() }
        val cursorY = currentLine * lineHeightPx
        val viewportHeight = verticalScrollState.viewportSize
        
        if (viewportHeight > 0) {
            val scrollTop = verticalScrollState.value
            val scrollBottom = scrollTop + viewportHeight
            
            // If line changed, ensure it's in a "Comfort Zone" (middle of screen)
            // If it's too close to the edge, center it immediately
            val threshold = viewportHeight * 0.2f // 20% margin
            
            if (cursorY < scrollTop + threshold || cursorY + lineHeightPx > scrollBottom - threshold) {
                val targetScroll = (cursorY - (viewportHeight / 3)).toInt().coerceAtLeast(0)
                coroutineScope.launch {
                    verticalScrollState.animateScrollTo(targetScroll)
                }
            }
        }
    }

    // Improved Auto-save Logic
    LaunchedEffect(textFieldValue.text) {
        if (textFieldValue.text != file.content) {
            viewModel.saveIndicator = "Typing..."
            delay(1500) // Debounce
            val updatedFile = file.copy(content = textFieldValue.text)
            onFileChange(updatedFile)
            viewModel.saveFile(context, updatedFile)
        }
    }

    val editorTextStyle = TextStyle(
        color = TextHigh,
        fontSize = fontSize.sp,
        fontFamily = FontFamily.Monospace,
        lineHeight = commonLineHeight,
        platformStyle = PlatformTextStyle(includeFontPadding = false),
        lineHeightStyle = LineHeightStyle(
            alignment = LineHeightStyle.Alignment.Center,
            trim = LineHeightStyle.Trim.None
        )
    )

    Column(modifier = Modifier.fillMaxSize().background(BgEditor)) {
        AcodeTabBar(openFiles, activeFile, onFileChange, onFileClose)
        HorizontalDivider(color = BorderColor)
        
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
            BasicTextField(
                value = textFieldValue,
                onValueChange = {
                    textFieldValue = it
                    onTextChange(it.text)
                },
                modifier = Modifier.fillMaxSize(),
                textStyle = editorTextStyle,
                cursorBrush = SolidColor(AccentPrimary),
                visualTransformation = NativeHighlightTransformation(file.name, searchQuery, searchMatches),
                decorationBox = { innerTextField ->
                    CompositionLocalProvider(
                        LocalTextSelectionColors provides TextSelectionColors(
                            handleColor = AccentPrimary,
                            backgroundColor = AccentPrimary.copy(alpha = 0.3f)
                        )
                    ) {
                        Row(modifier = Modifier.fillMaxSize().verticalScroll(verticalScrollState)) {
                            // Line Numbers Column
                            Column(
                                modifier = Modifier
                                    .width(52.dp)
                                    .padding(top = 12.dp)
                                    .background(BgEditor),
                                horizontalAlignment = Alignment.End
                            ) {
                                val lineCount = textFieldValue.text.count { it == '\n' } + 1
                                val lineHeightDp = with(density) { commonLineHeight.toDp() }
                                
                                for (i in 1..lineCount) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .height(lineHeightDp),
                                        contentAlignment = Alignment.CenterEnd
                                    ) {
                                        Text(
                                            text = "$i",
                                            style = editorTextStyle.copy(
                                                color = if (i - 1 == currentLine) AccentPrimary else TextLow,
                                                fontSize = (fontSize - 3).coerceAtLeast(10).sp,
                                                textAlign = TextAlign.End,
                                                fontWeight = if (i-1 == currentLine) FontWeight.Bold else FontWeight.Normal
                                            ),
                                            modifier = Modifier.padding(end = 12.dp)
                                        )
                                    }
                                }
                                Spacer(Modifier.height(400.dp)) // Massive space for comfort
                            }
                            
                            VerticalDivider(color = BorderColor)
                            
                            // Editor Area
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .horizontalScroll(horizontalScrollState)
                                    .padding(top = 12.dp, start = 12.dp, end = 100.dp)
                            ) {
                                innerTextField()
                                Spacer(Modifier.height(500.dp)) // Extra space to scroll past end
                            }
                        }
                    }
                }
            )
            
            AcodeQuickTools(
                onToolClick = { char ->
                    val start = textFieldValue.selection.start
                    val end = textFieldValue.selection.end
                    val newText = textFieldValue.text.substring(0, start) + char + textFieldValue.text.substring(end)
                    textFieldValue = textFieldValue.copy(
                        text = newText,
                        selection = TextRange(start + char.length)
                    )
                },
                onActionClick = { action ->
                    when(action) {
                        "CUT" -> {
                            val selectedText = textFieldValue.text.substring(textFieldValue.selection.start, textFieldValue.selection.end)
                            if (selectedText.isNotEmpty()) {
                                clipboardManager.setText(AnnotatedString(selectedText))
                                val newText = textFieldValue.text.removeRange(textFieldValue.selection.start, textFieldValue.selection.end)
                                textFieldValue = textFieldValue.copy(text = newText, selection = TextRange(textFieldValue.selection.start))
                            }
                        }
                        "COPY" -> {
                            val selectedText = textFieldValue.text.substring(textFieldValue.selection.start, textFieldValue.selection.end)
                            if (selectedText.isNotEmpty()) {
                                clipboardManager.setText(AnnotatedString(selectedText))
                            }
                        }
                        "PASTE" -> {
                            clipboardManager.getText()?.let { clip ->
                                val start = textFieldValue.selection.start
                                val end = textFieldValue.selection.end
                                val newText = textFieldValue.text.substring(0, start) + clip.text + textFieldValue.text.substring(end)
                                textFieldValue = textFieldValue.copy(text = newText, selection = TextRange(start + clip.text.length))
                            }
                        }
                        "SELECT_ALL" -> {
                            textFieldValue = textFieldValue.copy(selection = TextRange(0, textFieldValue.text.length))
                        }
                    }
                },
                modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp)
            )

            if (showSearch) {
                AcodeSearchBar(
                    searchQuery = searchQuery,
                    onSearchChange = { searchQuery = it },
                    onClose = { showSearch = false },
                    modifier = Modifier.align(Alignment.TopEnd).padding(16.dp)
                )
            }
        }
        
        AcodeStatusBar(
            line = currentLine + 1,
            col = currentColumn,
            lang = file.name.substringAfterLast("."),
            saveStatus = viewModel.saveIndicator,
            onSearchToggle = { showSearch = !showSearch }
        )
    }
}

@Composable
fun AcodeQuickTools(
    onToolClick: (String) -> Unit, 
    onActionClick: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val symbols = listOf("{", "}", "(", ")", "[", "]", ";", ",", ".", "\"", "'", ":", "=", "+", "-", "*", "/", "<", ">", "!")
    val actions = listOf(
        "CUT" to Icons.Rounded.ContentCut,
        "COPY" to Icons.Rounded.ContentCopy,
        "PASTE" to Icons.Rounded.ContentPaste,
        "SELECT_ALL" to Icons.Rounded.SelectAll
    )

    Surface(
        modifier = modifier.padding(horizontal = 16.dp),
        color = BgSidebar.copy(alpha = 0.95f),
        shape = RoundedCornerShape(12.dp),
        shadowElevation = 8.dp,
        border = BorderStroke(1.dp, BorderColor)
    ) {
        Row(
            modifier = Modifier.padding(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Action Buttons First
            actions.forEach { (action, icon) ->
                IconButton(onClick = { onActionClick(action) }, modifier = Modifier.size(36.dp)) {
                    Icon(icon, null, tint = AccentPrimary, modifier = Modifier.size(18.dp))
                }
            }
            
            VerticalDivider(modifier = Modifier.height(24.dp).padding(horizontal = 4.dp), color = BorderColor)
            
            LazyRow(
                modifier = Modifier.weight(1f, fill = false),
                verticalAlignment = Alignment.CenterVertically
            ) {
                items(symbols) { tool ->
                    Box(
                        modifier = Modifier
                            .size(36.dp)
                            .clickable { onToolClick(tool) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(tool, color = TextHigh, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    }
                }
            }
        }
    }
}

@Composable
fun AcodeTabBar(
    openFiles: List<FileItem>,
    activeFile: FileItem?,
    onFileChange: (FileItem) -> Unit,
    onFileClose: (FileItem) -> Unit
) {
    LazyRow(
        modifier = Modifier.fillMaxWidth().height(44.dp).background(BgSidebar),
        verticalAlignment = Alignment.CenterVertically
    ) {
        items(openFiles) { file ->
            val isActive = activeFile?.uri == file.uri
            Row(
                modifier = Modifier
                    .fillMaxHeight()
                    .background(if (isActive) BgTabActive else Color.Transparent)
                    .clickable { onFileChange(file) }
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    getFileIcon(file.name), 
                    null, 
                    tint = if (isActive) getIconColor(file.name) else TextMed, 
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = file.name,
                    fontSize = 12.sp,
                    color = if (isActive) TextHigh else TextMed,
                    fontWeight = if (isActive) FontWeight.Bold else FontWeight.Normal
                )
                IconButton(onClick = { onFileClose(file) }, modifier = Modifier.size(20.dp)) {
                    Icon(Icons.Rounded.Close, null, tint = TextLow, modifier = Modifier.size(14.dp))
                }
            }
            VerticalDivider(color = BorderColor, modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
fun AcodeStatusBar(
    line: Int,
    col: Int,
    lang: String,
    saveStatus: String,
    onSearchToggle: () -> Unit
) {
    Surface(
        color = BgSidebar,
        modifier = Modifier.fillMaxWidth().height(30.dp),
        border = BorderStroke(1.dp, BorderColor)
    ) {
        Row(
            modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Ln $line, Col $col", fontSize = 11.sp, color = TextMed)
                Text(
                    saveStatus, 
                    fontSize = 11.sp, 
                    color = if (saveStatus == "Saved") Color(0xFF4ADE80) else TextLow,
                    fontWeight = if (saveStatus == "Saved") FontWeight.Bold else FontWeight.Normal
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                IconButton(onClick = onSearchToggle, modifier = Modifier.size(24.dp)) {
                    Icon(Icons.Rounded.Search, null, tint = TextMed, modifier = Modifier.size(16.dp))
                }
                Box(
                    modifier = Modifier
                        .background(AccentPrimary.copy(alpha = 0.1f), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(lang.uppercase(), fontSize = 10.sp, color = AccentPrimary, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun AcodeSearchBar(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    onClose: () -> Unit,
    modifier: Modifier
) {
    Card(
        modifier = modifier.width(260.dp),
        colors = CardDefaults.cardColors(containerColor = BgSidebar),
        elevation = CardDefaults.cardElevation(12.dp),
        border = BorderStroke(1.dp, BorderColor),
        shape = RoundedCornerShape(8.dp)
    ) {
        Row(
            modifier = Modifier.padding(10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Rounded.Search, null, tint = TextLow, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(8.dp))
            BasicTextField(
                value = searchQuery,
                onValueChange = onSearchChange,
                modifier = Modifier.weight(1f),
                textStyle = TextStyle(color = TextHigh, fontSize = 13.sp),
                cursorBrush = SolidColor(AccentPrimary),
                decorationBox = { innerTextField ->
                    Box(modifier = Modifier.fillMaxWidth()) {
                        if (searchQuery.isEmpty()) Text("Find in file...", color = TextLow, fontSize = 13.sp)
                        innerTextField()
                    }
                }
            )
            IconButton(onClick = onClose, modifier = Modifier.size(24.dp)) {
                Icon(Icons.Rounded.Close, null, tint = TextMed, modifier = Modifier.size(18.dp))
            }
        }
    }
}

fun findAllMatches(query: String, text: String): List<Pair<Int, Int>> {
    if (query.isEmpty()) return emptyList()
    val matches = mutableListOf<Pair<Int, Int>>()
    var index = text.indexOf(query, 0, ignoreCase = true)
    while (index != -1) {
        matches.add(index to index + query.length)
        index = text.indexOf(query, index + 1, ignoreCase = true)
    }
    return matches
}

class NativeHighlightTransformation(
    private val fileName: String, 
    private val searchQuery: String,
    private val searchMatches: List<Pair<Int, Int>>
) : VisualTransformation {
    override fun filter(text: AnnotatedString): TransformedText {
        val annotated = buildAnnotatedString {
            append(text.text)
            
            if (searchQuery.isNotEmpty()) {
                searchMatches.forEach { (start, end) ->
                    if (start >= 0 && end <= text.length) {
                        addStyle(SpanStyle(background = AccentPrimary.copy(alpha = 0.4f)), start, end)
                    }
                }
            }
            
            val code = text.text
            // DRACULA-LIKE SYNTAX HIGHLIGHTING
            val keywords = listOf("fun", "val", "var", "import", "package", "class", "if", "else", "return", "for", "while", "true", "false", "null", "this", "super", "interface", "object", "override")
            keywords.forEach { word ->
                var index = code.indexOf(word)
                while (index >= 0) {
                    val before = if (index > 0) code[index - 1] else ' '
                    val after = if (index + word.length < code.length) code[index + word.length] else ' '
                    if (!before.isLetterOrDigit() && !after.isLetterOrDigit()) {
                        addStyle(SpanStyle(color = Color(0xFFFF79C6), fontWeight = FontWeight.Bold), index, index + word.length)
                    }
                    index = code.indexOf(word, index + word.length)
                }
            }
            
            // Strings
            var strStart = code.indexOf("\"")
            while (strStart >= 0) {
                val strEnd = code.indexOf("\"", strStart + 1)
                if (strEnd > strStart) {
                    addStyle(SpanStyle(color = Color(0xFFF1FA8C)), strStart, strEnd + 1)
                    strStart = code.indexOf("\"", strEnd + 1)
                } else break
            }
            
            // Comments
            var commentStart = code.indexOf("//")
            while (commentStart >= 0) {
                val lineEnd = code.indexOf("\n", commentStart)
                val end = if (lineEnd >= 0) lineEnd else code.length
                addStyle(SpanStyle(color = Color(0xFF6272A4)), commentStart, end)
                commentStart = code.indexOf("//", end)
            }
            
            // Numbers
            val numberRegex = "\\b\\d+\\b".toRegex()
            numberRegex.findAll(code).forEach { match ->
                addStyle(SpanStyle(color = Color(0xFFBD93F9)), match.range.first, match.range.last + 1)
            }
        }
        return TransformedText(annotated, OffsetMapping.Identity)
    }
}
