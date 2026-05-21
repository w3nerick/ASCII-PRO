# ASCII-PRO

> Cyberpunk-styled ASCII art generator for images, videos and webcam streams. 100% client-side.

Inspired by [ascii-magic.com](https://www.ascii-magic.com/), reimagined with a Neo-Tokyo aesthetic: neon glow, scanlines, glitch text, and `Share Tech Mono`.

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fw3nerick%2FASCII-PRO&project-name=ascii-pro&repository-name=ascii-pro)

Click the button above to deploy your own copy in less than a minute.
The repo ships with a `vercel.json`, so Vercel auto-detects Vite and you don't need to configure anything.

## Features

### Input
- Drag & drop image upload (PNG / JPG / WEBP / GIF).
- Video upload with frame-by-frame conversion (MP4 / WEBM).
- Live webcam ASCII stream.

### Image pipeline
- Resolution slider (32–300 columns).
- Brightness, contrast, saturation, blur sliders.
- Sobel edge detection with adjustable threshold.
- Floyd-Steinberg dithering for high-detail output.
- Color / mono / inverted modes.
- Configurable background and foreground colors.

### Charsets
11 ramps: standard, detailed, blocks, binary, minimal, matrix, cyberpunk, glitch, braille, shades, and **custom** (type your own ramp).

### Output
- Adjustable font size (zoom).
- Live preview with cyberpunk styling.
- Fullscreen mode.

### Export
- Copy text to clipboard.
- Download as `.txt`.
- Download as `.html` (with inline color preserved).
- Download as `.png` (rendered to your chosen colors).
- Open standalone preview in a new tab.
- **Record live ASCII video to `.webm`** (works for video files and webcam).

### Privacy
Zero backend, zero tracking, zero uploads. Everything runs in your browser using the Canvas 2D API.

## Tech stack

| Layer | Tool |
|---|---|
| Build | Vite 5 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS + custom cyberpunk theme |
| Icons | lucide-react |
| Image processing | Canvas 2D + custom Sobel / Floyd-Steinberg |
| Video recording | MediaRecorder + canvas.captureStream() |

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Build for production

```bash
npm run build
npm run preview
```

The `dist/` folder is fully static and can be deployed to any free host
(Vercel, Netlify, GitHub Pages, Cloudflare Pages).

## Project structure

```
src/
├── components/   UI: Header, Dropzone, ControlPanel, MediaStage, AsciiViewer, ExportBar, GlitchText
├── lib/          asciiConverter, charsets, exporters, loadMedia, videoRecorder
├── styles/       Cyberpunk theme (neon, scanlines, glitch)
├── App.tsx
└── main.tsx
```

## License

MIT
