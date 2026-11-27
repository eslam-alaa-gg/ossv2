# OSSv2 Android Music Bridge

This is the Android-native companion module for the OSSv2 Music Detection page.

## What it reads

- Only the active Spotify media session (package com.spotify.music).
- Track title, artist, album, playback state, position, duration, and available album artwork.
- It does not request microphone access, record audio, or control Spotify playback.

## Build

Open this directory in Android Studio with Android Gradle Plugin 8.7.3+ and JDK 17. Build and install the app module.

## Pair

1. Sign in to OSSv2 and open Music Detection.
2. Create an Android device token and copy it.
3. Open OSSv2 Music Bridge on Android, enter the OSSv2 HTTPS origin and token, then save.
4. Open Android Settings from the app's Grant media notification access button.
5. Explicitly enable notification access for OSSv2 Music Bridge.
6. Start Spotify playback. The bridge sends metadata every five seconds.

The device token and server URL are encrypted with AES-256-GCM using a non-exportable Android Keystore key; only ciphertext is stored in app-private preferences. The app refuses non-HTTPS server URLs. Existing credentials from the older plaintext preference file are migrated and that legacy file is cleared on launch. Revoke the device from OSSv2 to invalidate its token.

## Limitations

Android may suppress or omit artwork/metadata for some Spotify states. The user must explicitly grant notification access. This module is not yet packaged as an APK; build it in Android Studio.
