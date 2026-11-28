# Focus Zone live wallpapers

The six Focus Zone backgrounds in `public/focus-wallpapers/` are original, self-contained SVG scenes authored for this project:

- `aurora.svg` — northern lights and mountain silhouettes
- `forest.svg` — layered forest, filtered light and drifting mist
- `ocean.svg` — sunset horizon and slow wave motion
- `rain.svg` — night skyline, rain and soft city lights
- `sunset.svg` — warm horizon, drifting clouds and mountain layers
- `cosmos.svg` — nebula, stars and a ringed planet

They do not download media from MyLiveWallpapers, Wallsflow, Unsplash, Mixkit, Pixabay, or another third-party host. No third-party footage or photography is embedded in these files, so there are no external stock-media licensing dependencies. The artwork is source-controlled alongside the application and is served from the same origin.

Each SVG contains its own lightweight animation and a `prefers-reduced-motion` fallback. The application also renders a static CSS fallback when the user's app-level reduced-motion preference is enabled or an asset fails to load.

The Focus preferences parser maps previously saved photo-wallpaper identifiers to the nearest new scene so existing accounts do not lose their selected background.
