package com.example.icstudioeditor

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.animation.*
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File

class MainActivity : ComponentActivity() {
    private val fileViewModel: FileViewModel by viewModels()

    private val onDownloadComplete = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
            if (id != -1L) {
                installApk(context)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        registerReceiver(onDownloadComplete, IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), RECEIVER_EXPORTED)
        
        setContent {
            val settings = remember { SettingsProvider(this@MainActivity) }
            LaunchedEffect(Unit) { 
                fileViewModel.loadLastFolder(this@MainActivity)
                fileViewModel.checkForUpdates(this@MainActivity)
            }
            
            MaterialTheme(
                colorScheme = darkColorScheme(
                    primary = AccentPrimary,
                    secondary = AccentSecondary,
                    background = BgDark,
                    surface = BgSidebar
                )
            ) {
                Box {
                    MainUIShell(fileViewModel, settings)
                    
                    // Update Dialog UI
                    fileViewModel.showUpdateDialog?.let { info ->
                        AlertDialog(
                            onDismissRequest = { fileViewModel.showUpdateDialog = null },
                            containerColor = BgSidebar,
                            shape = RoundedCornerShape(16.dp),
                            icon = { Icon(Icons.Rounded.Update, null, tint = AccentPrimary) },
                            title = { Text("Versi Baru ${info.version}", color = TextHigh, fontWeight = FontWeight.Bold) },
                            text = { Text(info.description, color = TextMed) },
                            confirmButton = {
                                Button(
                                    onClick = { 
                                        fileViewModel.downloadUpdate(this@MainActivity, info.downloadUrl)
                                        fileViewModel.showUpdateDialog = null
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = AccentPrimary)
                                ) { Text("UPDATE SEKARANG") }
                            },
                            dismissButton = {
                                TextButton(onClick = { fileViewModel.showUpdateDialog = null }) {
                                    Text("NANTI", color = TextLow)
                                }
                            }
                        )
                    }

                    if (fileViewModel.isDownloading) {
                        Surface(
                            modifier = Modifier.align(Alignment.BottomCenter).padding(16.dp),
                            color = BgSidebar,
                            shape = RoundedCornerShape(8.dp),
                            shadowElevation = 8.dp
                        ) {
                            Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = AccentPrimary)
                                Spacer(Modifier.width(12.dp))
                                Text("Mengunduh pembaruan...", color = TextHigh, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    private fun installApk(context: Context) {
        val file = File(context.getExternalFilesDir(null), "../Download/IdeCode-Update.apk") // Sesuai dengan folder download manager
        // Karena DownloadManager di FileViewModel simpan di Public Downloads, kita cari di sana
        val publicFile = File(android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_DOWNLOADS), "IdeCode-Update.apk")
        
        if (publicFile.exists()) {
            val uri = FileProvider.getUriForFile(context, "${context.packageName}.provider", publicFile)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            fileViewModel.isDownloading = false
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        unregisterReceiver(onDownloadComplete)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainUIShell(viewModel: FileViewModel, settings: SettingsProvider) {
    val context = LocalContext.current
    val folderPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocumentTree(),
        onResult = { uri: Uri? -> 
            uri?.let { 
                try {
                    val takeFlags: Int = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    context.contentResolver.takePersistableUriPermission(it, takeFlags)
                } catch (e: Exception) { e.printStackTrace() }
                viewModel.saveLastFolder(context, it)
                viewModel.loadDirectory(context, it) 
            }
        }
    )

    Scaffold(
        containerColor = BgDark,
        topBar = {
            if (viewModel.workspaceFiles.isNotEmpty()) {
                Surface(color = BgSidebar, shadowElevation = 8.dp) {
                    Row(
                        modifier = Modifier.fillMaxWidth().height(48.dp).padding(horizontal = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = { viewModel.isSidebarVisible = !viewModel.isSidebarVisible }) {
                            Icon(if (viewModel.isSidebarVisible) Icons.Rounded.MenuOpen else Icons.Rounded.Menu, null, tint = TextHigh)
                        }
                        Text("Ide Code", modifier = Modifier.weight(1f).padding(horizontal = 12.dp), color = TextHigh, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold)
                        IconButton(onClick = { viewModel.checkForUpdates(context) }) { Icon(Icons.Rounded.CloudDownload, null, tint = TextMed) }
                        IconButton(onClick = { }) { Icon(Icons.Rounded.MoreVert, null, tint = TextMed) }
                    }
                }
            }
        }
    ) { padding ->
        Box(modifier = Modifier.padding(padding).fillMaxSize()) {
            if (viewModel.workspaceFiles.isNotEmpty()) {
                viewModel.activeFile?.let {
                    CodeEditorCore(it, settings.fontSize, viewModel.openFiles, viewModel.activeFile, { f -> 
                        val i = viewModel.openFiles.indexOfFirst { it.uri == f.uri }
                        if (i != -1) viewModel.openFiles[i] = f
                        viewModel.activeFile = f
                    }, { f -> viewModel.closeFile(f) }, {}, viewModel)
                }
            } else {
                WelcomeScreen { folderPickerLauncher.launch(null) }
            }

            // Animated Sidebar & Overlay
            AnimatedVisibility(visible = viewModel.isSidebarVisible, enter = fadeIn(), exit = fadeOut()) {
                Box(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.5f)).clickable(interactionSource = remember { MutableInteractionSource() }, indication = null) { viewModel.isSidebarVisible = false })
            }
            AnimatedVisibility(visible = viewModel.isSidebarVisible, enter = slideInHorizontally(animationSpec = tween(300)) { -it }, exit = slideOutHorizontally(animationSpec = tween(300)) { -it }) {
                Box(modifier = Modifier.fillMaxHeight().width(280.dp).background(BgSidebar).clickable(enabled = false) {}) {
                    ExplorerUI(viewModel) { viewModel.isSidebarVisible = false }
                }
            }
        }
    }
}
