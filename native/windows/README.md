# OSSv2 Windows Music Bridge

This small Windows helper reads Spotify's current Windows media session through the Windows Global System Media Transport Controls API. It sends track metadata to the paired OSSv2 account over HTTPS.

## Requirements

- Windows 10 version 1903 or newer (Windows 11 recommended).
- .NET 8 SDK.
- Spotify desktop app.
- A device token created from the OSSv2 Music Detection page.

## Run

In PowerShell, set the values from the OSSv2 device pairing page:

    $env:OSSV2_BRIDGE_URL = "https://your-ossv2-domain"
    $env:OSSV2_BRIDGE_TOKEN = "paste-device-token"
    dotnet run --project .\OSSv2MusicBridge.csproj

Keep the helper running while Spotify is playing. It polls the current Spotify media session every five seconds. Stop it with Ctrl+C.

The helper does not capture audio, use a microphone, or send playback-control commands. The device can be revoked from OSSv2 at any time.

## Limitations

This is source code, not a signed installer. Windows may not expose a media session if Spotify is not publishing one. Artwork may be omitted when Windows does not provide a thumbnail.
