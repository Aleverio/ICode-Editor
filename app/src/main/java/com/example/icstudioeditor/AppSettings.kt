package com.example.icstudioeditor

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.Terminal
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ========== PREMIUM ELEGANT THEME TOKENS ==========
val BgDark = Color(0xFF0D0D0D)          // Jet Black
val BgSidebar = Color(0xFF141414)       // Deep Charcoal
val BgEditor = Color(0xFF0D0D0D)        // Editor background
val BgTabActive = Color(0xFF1E1E1E)     // Active tab
val AccentPrimary = Color(0xFF3B82F6)   // Modern Blue
val AccentSecondary = Color(0xFFF59E0B) // Amber
val TextHigh = Color(0xFFF3F4F6)        // Off White
val TextMed = Color(0xFF9CA3AF)         // Cool Gray
val TextLow = Color(0xFF4B5563)         // Dark Gray
val BorderColor = Color(0xFF262626)     // Subtle Border

class SettingsProvider(context: Context) {
    private val prefs = context.getSharedPreferences("app_settings", Context.MODE_PRIVATE)
    
    var fontSize by mutableIntStateOf(prefs.getInt("font_size", 15))
    var isDarkTheme by mutableStateOf(prefs.getBoolean("dark_theme", true))

    fun save() {
        prefs.edit().apply {
            putInt("font_size", fontSize)
            putBoolean("dark_theme", isDarkTheme)
            apply()
        }
    }
}

@Composable
fun WelcomeScreen(onOpenFolder: () -> Unit) {
    Box(modifier = Modifier.fillMaxSize().background(BgDark), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.padding(32.dp)) {
            Surface(
                shape = RoundedCornerShape(24.dp),
                color = AccentPrimary.copy(alpha = 0.1f),
                modifier = Modifier.size(120.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, AccentPrimary.copy(alpha = 0.2f))
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        Icons.Rounded.Terminal, 
                        null, 
                        modifier = Modifier.size(60.dp), 
                        tint = AccentPrimary
                    )
                }
            }
            Spacer(Modifier.height(32.dp))
            Text(
                "IC Studio Editor", 
                fontSize = 32.sp, 
                fontWeight = FontWeight.ExtraBold, 
                color = TextHigh,
                letterSpacing = (-1).sp
            )
            Text(
                "Experience elegance in coding", 
                fontSize = 16.sp, 
                color = TextMed, 
                modifier = Modifier.padding(top = 8.dp)
            )
            Spacer(Modifier.height(56.dp))
            Button(
                onClick = onOpenFolder,
                colors = ButtonDefaults.buttonColors(containerColor = AccentPrimary),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.height(50.dp).fillMaxWidth(0.8f),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
            ) {
                Text("OPEN WORKSPACE", fontWeight = FontWeight.Bold, letterSpacing = 1.sp)
            }
        }
    }
}
