package com.ossv2.musicbridge

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.text.InputType

class MainActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val migrationSucceeded = runCatching { SecureBridgePrefs.migrateLegacy(this) }.isSuccess
        if (!migrationSucceeded) {
            android.widget.Toast.makeText(this, "Old device credentials could not be migrated. Please pair this device again.", android.widget.Toast.LENGTH_LONG).show()
        }
        val pad = (20 * resources.displayMetrics.density).toInt()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        root.addView(TextView(this).apply {
            text = "OSSv2 Music Bridge"
            textSize = 24f
        })
        root.addView(TextView(this).apply {
            text = "Reads Spotify's Android media-session metadata only. No microphone or audio recording is used."
            textSize = 14f
        })

        val server = EditText(this).apply {
            hint = "OSSv2 URL (https://your-site.example)"
            setSingleLine(true)
            setText(SecureBridgePrefs.read(this@MainActivity, "server"))
        }
        val token = EditText(this).apply {
            hint = "Device token from OSSv2"
            setSingleLine(true)
            setText(SecureBridgePrefs.read(this@MainActivity, "token"))
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        root.addView(server, ViewGroup.LayoutParams(-1, -2))
        root.addView(token, ViewGroup.LayoutParams(-1, -2))
        root.addView(Button(this).apply {
            text = "Save device connection"
            setOnClickListener {
                try {
                    SecureBridgePrefs.write(this@MainActivity, "server", server.text.toString().trim().trimEnd('/'))
                    SecureBridgePrefs.write(this@MainActivity, "token", token.text.toString().trim())
                    android.widget.Toast.makeText(this@MainActivity, "Encrypted connection saved.", android.widget.Toast.LENGTH_SHORT).show()
                } catch (_: Exception) {
                    android.widget.Toast.makeText(this@MainActivity, "Could not securely save the connection. Please try again.", android.widget.Toast.LENGTH_LONG).show()
                }
            }
        })
        root.addView(Button(this).apply {
            text = "Grant media notification access"
            setOnClickListener { startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)) }
        })
        root.addView(TextView(this).apply {
            text = "After saving, enable OSSv2 Music Bridge in Notification access. Start Spotify playback; the song will be sent automatically."
            textSize = 14f
        })
        setContentView(root)
    }
}
