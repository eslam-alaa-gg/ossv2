using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using Windows.Media.Control;
using Windows.Storage.Streams;

var server = Environment.GetEnvironmentVariable("OSSV2_BRIDGE_URL")?.TrimEnd('/');
var token = Environment.GetEnvironmentVariable("OSSV2_BRIDGE_TOKEN");
if (string.IsNullOrWhiteSpace(server) || string.IsNullOrWhiteSpace(token))
{
    Console.Error.WriteLine("Set OSSV2_BRIDGE_URL and OSSV2_BRIDGE_TOKEN before starting the bridge.");
    return;
}
if (!Uri.TryCreate(server, UriKind.Absolute, out var serverUri) || serverUri.Scheme != Uri.UriSchemeHttps)
{
    Console.Error.WriteLine("OSSV2_BRIDGE_URL must be an absolute HTTPS URL so the device token is never sent in cleartext.");
    return;
}

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(10) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
var manager = await GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
Console.WriteLine("OSSv2 Music Bridge is running. Press Ctrl+C to stop.");

using var stop = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; stop.Cancel(); };

while (!stop.IsCancellationRequested)
{
    try
    {
        var session = manager.GetSessions().FirstOrDefault(s =>
            s.SourceAppUserModelId.Contains("Spotify", StringComparison.OrdinalIgnoreCase));

        var payload = new NowPlayingPayload { AppName = "Spotify" };
        if (session is not null)
        {
            var media = await session.TryGetMediaPropertiesAsync();
            var playback = session.GetPlaybackInfo();
            var timeline = session.GetTimelineProperties();
            payload.Title = media.Title ?? "";
            payload.Artist = media.Artist ?? "";
            payload.Album = media.AlbumTitle ?? "";
            payload.IsPlaying = playback.PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
            payload.PositionMs = Math.Max(0, (long)timeline.Position.TotalMilliseconds);
            payload.DurationMs = Math.Max(0, (long)(timeline.EndTime - timeline.StartTime).TotalMilliseconds);
            payload.Artwork = await ReadArtworkAsync(media.Thumbnail);
        }

        using var response = await http.PostAsJsonAsync($"{server}/api/music-bridge/push", payload, stop.Token);
        if (!response.IsSuccessStatusCode)
            Console.Error.WriteLine($"OSSv2 returned HTTP {(int)response.StatusCode}; check the pairing token and site URL.");
    }
    catch (OperationCanceledException) when (stop.IsCancellationRequested) { break; }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Bridge update failed: {ex.Message}");
    }

    try { await Task.Delay(TimeSpan.FromSeconds(5), stop.Token); }
    catch (OperationCanceledException) { break; }
}

static async Task<string?> ReadArtworkAsync(RandomAccessStreamReference? thumbnail)
{
    if (thumbnail is null) return null;
    try
    {
        using var stream = await thumbnail.OpenReadAsync();
        if (stream.Size == 0 || stream.Size > 350_000) return null;
        using var reader = new DataReader(stream.GetInputStreamAt(0));
        await reader.LoadAsync((uint)stream.Size);
        var bytes = new byte[(int)stream.Size];
        reader.ReadBytes(bytes);
        return "data:image/jpeg;base64," + Convert.ToBase64String(bytes);
    }
    catch { return null; }
}

internal sealed class NowPlayingPayload
{
    public string Title { get; set; } = "";
    public string Artist { get; set; } = "";
    public string Album { get; set; } = "";
    public string? Artwork { get; set; }
    public string? Url { get; set; }
    public string AppName { get; set; } = "Spotify";
    public bool IsPlaying { get; set; }
    public long PositionMs { get; set; }
    public long DurationMs { get; set; }
}
