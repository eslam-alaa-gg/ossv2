package com.ossv2.musicbridge

import android.content.ComponentName
import android.graphics.Bitmap
import android.media.MediaMetadata
import android.media.session.MediaSessionManager
import android.media.session.PlaybackState
import android.os.Handler
import android.os.Looper
import android.service.notification.NotificationListenerService
import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

class MusicNotificationListener : NotificationListenerService() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private var manager: MediaSessionManager? = null
    private val poll = object : Runnable {
        override fun run() {
            publishCurrentSpotifySession()
            mainHandler.postDelayed(this, 5_000)
        }
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        manager = getSystemService(MEDIA_SESSION_SERVICE) as MediaSessionManager
        mainHandler.removeCallbacks(poll)
        mainHandler.post(poll)
    }

    override fun onListenerDisconnected() {
        mainHandler.removeCallbacks(poll)
        super.onListenerDisconnected()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(poll)
        io.shutdown()
        super.onDestroy()
    }

    private fun publishCurrentSpotifySession() {
        val sessions = try {
            manager?.getActiveSessions(ComponentName(this, MusicNotificationListener::class.java)).orEmpty()
        } catch (_: SecurityException) {
            return
        }
        val spotify = sessions.firstOrNull { it.packageName == "com.spotify.music" }
        if (spotify == null) {
            send(JSONObject().apply {
                put("title", "")
                put("isPlaying", false)
                put("appName", "Spotify")
            })
            return
        }

        val metadata = spotify.metadata
        val state = spotify.playbackState
        val title = metadata?.getString(MediaMetadata.METADATA_KEY_TITLE).orEmpty()
        val artist = metadata?.getString(MediaMetadata.METADATA_KEY_ARTIST)
            ?: metadata?.getString(MediaMetadata.METADATA_KEY_AUTHOR).orEmpty()
        val album = metadata?.getString(MediaMetadata.METADATA_KEY_ALBUM).orEmpty()
        val duration = metadata?.getLong(MediaMetadata.METADATA_KEY_DURATION) ?: 0L
        val position = state?.position ?: 0L
        val playing = state?.state == PlaybackState.STATE_PLAYING

        val payload = JSONObject().apply {
            put("title", title)
            put("artist", artist)
            put("album", album)
            put("appName", "Spotify")
            put("isPlaying", playing)
            put("positionMs", position.coerceAtLeast(0))
            put("durationMs", duration.coerceAtLeast(0))
            val artwork = metadata?.getBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART)
                ?: metadata?.getBitmap(MediaMetadata.METADATA_KEY_ART)
            if (artwork != null) put("artwork", artworkDataUrl(artwork))
        }
        send(payload)
    }

    private fun artworkDataUrl(source: Bitmap): String? {
        return try {
            val scale = minOf(1f, 512f / maxOf(source.width, source.height))
            val bitmap = if (scale < 1f) Bitmap.createScaledBitmap(
                source, (source.width * scale).toInt(), (source.height * scale).toInt(), true
            ) else source
            val out = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.JPEG, 72, out)
            if (bitmap !== source) bitmap.recycle()
            val bytes = out.toByteArray()
            if (bytes.size > 400_000) return null
            "data:image/jpeg;base64," + Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (_: Exception) {
            null
        }
    }

    private fun send(payload: JSONObject) {
        val server = SecureBridgePrefs.read(this, "server").trimEnd('/')
        val token = SecureBridgePrefs.read(this, "token")
        if (server.isBlank() || token.isBlank()) return
        io.execute {
            var connection: HttpURLConnection? = null
            try {
                connection = URL("$server/api/music-bridge/push").openConnection() as HttpURLConnection
                connection.requestMethod = "POST"
                connection.connectTimeout = 8_000
                connection.readTimeout = 8_000
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Authorization", "Bearer $token")
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                (if (code in 200..299) connection.inputStream else connection.errorStream)?.close()
            } catch (_: Exception) {
                // Keep the listener alive; the next media poll retries.
            } finally {
                connection?.disconnect()
            }
        }
    }
}
