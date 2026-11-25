# LIFE OS custom font files

This folder is reserved for the custom font files supplied for LIFE OS.

When adding a font, place the optimized `.woff2` file here and register it with an `@font-face` rule in `src/app/globals.css`.

Suggested names:
- `arabic-custom.woff2` — Arabic typeface
- `english-custom.woff2` — English typeface

Use `font-display: swap`, include only the weights actually supplied, and keep Arabic and English font stacks separate so changing the language does not apply a Latin-only font to Arabic text.

The current Google Fonts setup already includes Playpen Sans Arabic, Sniglet, Kavoon, Merienda and Shantell Sans. This directory is ready for the additional font files when they are provided.
