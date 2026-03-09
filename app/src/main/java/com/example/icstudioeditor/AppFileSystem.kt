package com.example.icstudioeditor

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.documentfile.provider.DocumentFile
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import org.json.JSONObject
import java.net.URL

data class FileItem(
    val name: String,
    val content: String = "",
    val uri: Uri? = null,
    val isDirectory: Boolean = false,
    val children: List<FileItem> = emptyList(),
    val parentUri: Uri? = null
)

data class UpdateInfo(
    val version: String,
    val description: String,
    val downloadUrl: String
)

class FileViewModel : ViewModel() {
    var workspaceFiles = mutableStateListOf<FileItem>()
    var openFiles = mutableStateListOf<FileItem>()
    var activeFile by mutableStateOf<FileItem?>(null)
    var rootPathUri by mutableStateOf<Uri?>(null)
    var saveIndicator by mutableStateOf("Ready")
    var isSidebarVisible by mutableStateOf(false)
    
    // Update state
    var showUpdateDialog by mutableStateOf<UpdateInfo?>(null)
    var isDownloading by mutableStateOf(false)

    fun loadLastFolder(context: Context) {
        val prefs = context.getSharedPreferences("editor_prefs", Context.MODE_PRIVATE)
        prefs.getString("last_folder_uri", null)?.let { loadDirectory(context, Uri.parse(it)) }
    }

    fun saveLastFolder(context: Context, uri: Uri) {
        context.getSharedPreferences("editor_prefs", Context.MODE_PRIVATE).edit().putString("last_folder_uri", uri.toString()).apply()
    }

    fun loadDirectory(context: Context, uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val rootDoc = DocumentFile.fromTreeUri(context, uri)
                rootPathUri = uri
                val files = rootDoc?.listFiles()
                    ?.sortedWith(compareBy({ !it.isDirectory }, { it.name?.lowercase() }))
                    ?.map { mapDocToFileItem(it, uri) } ?: emptyList()
                
                launch(Dispatchers.Main) {
                    workspaceFiles.clear()
                    workspaceFiles.addAll(files)
                }
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    private fun mapDocToFileItem(doc: DocumentFile, parent: Uri): FileItem {
        val children = if (doc.isDirectory) {
            doc.listFiles()?.sortedWith(compareBy({ !it.isDirectory }, { it.name?.lowercase() }))
                ?.map { mapDocToFileItem(it, doc.uri) } ?: emptyList()
        } else emptyList()
        return FileItem(doc.name ?: "Unknown", "", doc.uri, doc.isDirectory, children, parent)
    }

    fun openFile(context: Context, file: FileItem) {
        if (file.isDirectory || file.uri == null) return
        val existing = openFiles.find { it.uri == file.uri }
        if (existing == null) {
            viewModelScope.launch(Dispatchers.IO) {
                try {
                    val content = context.contentResolver.openInputStream(file.uri)?.bufferedReader()?.use { it.readText() } ?: ""
                    launch(Dispatchers.Main) {
                        val newFile = file.copy(content = content)
                        openFiles.add(newFile)
                        activeFile = newFile
                    }
                } catch (e: Exception) { e.printStackTrace() }
            }
        } else activeFile = existing
    }

    fun closeFile(file: FileItem) {
        val index = openFiles.indexOfFirst { it.uri == file.uri }
        if (index != -1) {
            openFiles.removeAt(index)
            if (activeFile?.uri == file.uri) activeFile = openFiles.lastOrNull()
        }
    }

    fun saveFile(context: Context, fileItem: FileItem? = null) {
        val file = fileItem ?: activeFile ?: return
        if (file.uri == null) return
        viewModelScope.launch(Dispatchers.IO) {
            try {
                context.contentResolver.openOutputStream(file.uri)?.bufferedWriter()?.use { it.write(file.content) }
                launch(Dispatchers.Main) { saveIndicator = "Saved" }
                delay(2000)
                launch(Dispatchers.Main) { if (saveIndicator == "Saved") saveIndicator = "All saved" }
            } catch (e: Exception) { launch(Dispatchers.Main) { saveIndicator = "Error!" } }
        }
    }

    fun createNewItem(context: Context, parentUri: Uri, name: String, isFolder: Boolean) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val parentDoc = DocumentFile.fromSingleUri(context, parentUri) ?: return@launch
                val targetFolderUri = if (parentDoc.isDirectory) parentUri else parentDoc.parentFile?.uri ?: rootPathUri ?: return@launch
                
                val mime = if (isFolder) DocumentsContract.Document.MIME_TYPE_DIR else getMimeType(name)
                val newUri = DocumentsContract.createDocument(context.contentResolver, targetFolderUri, mime, name)
                
                if (newUri != null) {
                    loadDirectory(context, rootPathUri!!)
                    if (!isFolder) {
                        val newDoc = DocumentFile.fromSingleUri(context, newUri)
                        newDoc?.let { launch(Dispatchers.Main) { openFile(context, mapDocToFileItem(it, targetFolderUri)) } }
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun deleteItem(context: Context, uri: Uri) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                DocumentsContract.deleteDocument(context.contentResolver, uri)
                loadDirectory(context, rootPathUri!!)
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun checkForUpdates(context: Context) {
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val repoUrl = "https://api.github.com/repos/RidhoAlAmin/Instailer-Ide-Code/releases/latest"
                val response = URL(repoUrl).readText()
                val json = JSONObject(response)
                val latestVersion = json.getString("tag_name").replace("v", "")
                val currentVersion = context.packageManager.getPackageInfo(context.packageName, 0).versionName

                if (latestVersion != currentVersion) {
                    val body = json.optString("body", "Versi baru tersedia!")
                    val assets = json.getJSONArray("assets")
                    if (assets.length() > 0) {
                        val downloadUrl = assets.getJSONObject(0).getString("browser_download_url")
                        launch(Dispatchers.Main) {
                            showUpdateDialog = UpdateInfo(latestVersion, body, downloadUrl)
                        }
                    }
                }
            } catch (e: Exception) { e.printStackTrace() }
        }
    }

    fun downloadUpdate(context: Context, url: String) {
        isDownloading = true
        val request = DownloadManager.Request(Uri.parse(url))
            .setTitle("Ide Code Update")
            .setDescription("Mengunduh versi terbaru...")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "IdeCode-Update.apk")
            .setAllowedOverMetered(true)
            .setAllowedOverRoaming(true)

        val dm = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        dm.enqueue(request)
        
        // Catatan: Proses install biasanya ditangani oleh OS setelah download selesai dari notifikasi
        // Namun kita bisa mempercantik dengan BroadcastReceiver di MainActivity
    }

    private fun getMimeType(name: String): String = when (name.substringAfterLast(".", "").lowercase()) {
        "html" -> "text/html"
        "css" -> "text/css"
        "js" -> "application/javascript"
        "py" -> "text/x-python"
        "kt" -> "text/x-kotlin"
        else -> "application/octet-stream"
    }
}

@Composable
fun ExplorerUI(viewModel: FileViewModel, onFileOpen: (FileItem) -> Unit) {
    var searchQuery by remember { mutableStateOf("") }
    val context = androidx.compose.ui.platform.LocalContext.current
    var showCreateDialog by remember { mutableStateOf<Triple<String, Uri, Boolean>?>(null) }
    var newName by remember { mutableStateOf("") }

    Column(modifier = Modifier.fillMaxSize().background(BgSidebar)) {
        Row(
            Modifier.padding(horizontal = 20.dp, vertical = 24.dp), 
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(Icons.Rounded.Terminal, null, tint = AccentPrimary, modifier = Modifier.size(22.dp))
            Spacer(Modifier.width(12.dp))
            Text(
                "EXPLORER", 
                fontSize = 12.sp, 
                fontWeight = FontWeight.Black, 
                color = TextHigh, 
                letterSpacing = 1.5.sp
            )
        }

        Surface(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
            color = BgDark,
            shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, BorderColor)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                Icon(Icons.Rounded.Search, null, tint = TextLow, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                BasicTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    textStyle = TextStyle(color = TextHigh, fontSize = 13.sp),
                    cursorBrush = SolidColor(AccentPrimary),
                    modifier = Modifier.weight(1f),
                    decorationBox = { if (searchQuery.isEmpty()) Text("Search workspace...", color = TextLow, fontSize = 13.sp); it() }
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        HorizontalDivider(color = BorderColor)

        LazyColumn(Modifier.fillMaxSize()) {
            items(viewModel.workspaceFiles) { file ->
                if (searchQuery.isEmpty() || file.name.contains(searchQuery, true)) {
                    FileNodeUI(file, 0, viewModel.activeFile?.uri == file.uri, { viewModel.openFile(context, it); onFileOpen(it) }, 
                    { action, item -> 
                        when(action) {
                            "file" -> showCreateDialog = Triple("File", item.uri!!, false)
                            "folder" -> showCreateDialog = Triple("Folder", item.uri!!, true)
                            "delete" -> viewModel.deleteItem(context, item.uri!!)
                        }
                    })
                }
            }
        }
    }

    if (showCreateDialog != null) {
        AlertDialog(
            onDismissRequest = { showCreateDialog = null; newName = "" },
            containerColor = BgSidebar,
            shape = RoundedCornerShape(16.dp),
            title = { Text("New ${showCreateDialog?.first}", color = TextHigh, fontWeight = FontWeight.Bold) },
            text = {
                OutlinedTextField(
                    value = newName, 
                    onValueChange = { newName = it },
                    placeholder = { Text("Name...", color = TextLow) },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = AccentPrimary,
                        unfocusedBorderColor = BorderColor,
                        focusedTextColor = TextHigh,
                        unfocusedTextColor = TextHigh
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                Button(
                    onClick = {
                        if (newName.isNotEmpty()) viewModel.createNewItem(context, showCreateDialog!!.second, newName, showCreateDialog!!.third)
                        showCreateDialog = null; newName = ""
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = AccentPrimary),
                    shape = RoundedCornerShape(8.dp)
                ) { Text("CREATE") }
            },
            dismissButton = {
                TextButton(onClick = { showCreateDialog = null; newName = "" }) {
                    Text("CANCEL", color = TextMed)
                }
            }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun FileNodeUI(file: FileItem, level: Int, isSelected: Boolean, onSelect: (FileItem) -> Unit, onAction: (String, FileItem) -> Unit) {
    var isExpanded by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    
    Column(Modifier.animateContentSize()) {
        Row(
            modifier = Modifier.fillMaxWidth().height(42.dp)
                .background(if (isSelected) AccentPrimary.copy(0.12f) else Color.Transparent)
                .combinedClickable(
                    onClick = { if (file.isDirectory) isExpanded = !isExpanded else onSelect(file) }, 
                    onLongClick = { showMenu = true }
                )
                .padding(start = (level * 16 + 16).dp, end = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                if (file.isDirectory) (if (isExpanded) Icons.Rounded.KeyboardArrowDown else Icons.Rounded.KeyboardArrowRight) else getFileIcon(file.name), 
                null, 
                tint = if (isSelected) AccentPrimary else if (file.isDirectory) TextMed else getIconColor(file.name), 
                modifier = Modifier.size(18.dp)
            )
            if (file.isDirectory) {
                Spacer(Modifier.width(6.dp))
                Icon(if (isExpanded) Icons.Rounded.FolderOpen else Icons.Rounded.Folder, null, tint = AccentSecondary, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.width(10.dp))
            Text(
                file.name, 
                fontSize = 14.sp, 
                color = if (isSelected) TextHigh else TextHigh.copy(0.9f),
                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                maxLines = 1
            )

            DropdownMenu(
                expanded = showMenu, 
                onDismissRequest = { showMenu = false }, 
                modifier = Modifier.background(BgSidebar).border(1.dp, BorderColor, RoundedCornerShape(8.dp))
            ) {
                DropdownMenuItem(
                    text = { Text("New File", color = TextHigh, fontSize = 13.sp) }, 
                    leadingIcon = { Icon(Icons.Rounded.NoteAdd, null, tint = AccentPrimary, modifier = Modifier.size(18.dp)) }, 
                    onClick = { showMenu = false; onAction("file", file) }
                )
                DropdownMenuItem(
                    text = { Text("New Folder", color = TextHigh, fontSize = 13.sp) }, 
                    leadingIcon = { Icon(Icons.Rounded.CreateNewFolder, null, tint = AccentSecondary, modifier = Modifier.size(18.dp)) }, 
                    onClick = { showMenu = false; onAction("folder", file) }
                )
                HorizontalDivider(color = BorderColor)
                DropdownMenuItem(
                    text = { Text("Delete", color = Color(0xFFEF4444), fontSize = 13.sp) }, 
                    leadingIcon = { Icon(Icons.Rounded.Delete, null, tint = Color(0xFFEF4444), modifier = Modifier.size(18.dp)) }, 
                    onClick = { showMenu = false; onAction("delete", file) }
                )
            }
        }
        if (isExpanded && file.isDirectory) {
            file.children.forEach { FileNodeUI(it, level + 1, isSelected, onSelect, onAction) }
        }
    }
}

fun getFileIcon(name: String): ImageVector = when {
    name.endsWith(".kt") -> Icons.Rounded.Code
    name.endsWith(".java") -> Icons.Rounded.Terminal
    name.endsWith(".html") -> Icons.Rounded.Html
    name.endsWith(".css") -> Icons.Rounded.Css
    name.endsWith(".js") -> Icons.Rounded.Javascript
    else -> Icons.Rounded.Description
}

fun getIconColor(name: String): Color = when {
    name.endsWith(".kt") -> Color(0xFF3B82F6)
    name.endsWith(".java") -> Color(0xFFF59E0B)
    name.endsWith(".html") -> Color(0xFFEF4444)
    name.endsWith(".css") -> Color(0xFF3B82F6)
    name.endsWith(".js") -> Color(0xFFFACC15)
    else -> TextMed
}
