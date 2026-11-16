# Motioncraft — Local AI Video Studio

Motioncraft is a local-first AI animation video maker that lets users enter their own API key, choose a supported model provider, describe the video they want, and generate a short animated storyboard with captions, narration, and exportable video output. The app supports OpenAI-compatible providers, lets users control video duration, adds optional AI voice-over, and renders a preview in the browser before exporting a WebM video file.

This project is designed for local desktop use. It includes an offline demo mode that works without an API key, plus a full AI generation flow for users who want to connect to supported providers such as OpenAI, OpenRouter, Groq, Together AI, Mistral, DeepSeek, and Fireworks AI.

A small, local-first MVP for turning a prompt into a short animated video. Choose an OpenAI-compatible provider and model, enter your own API key, generate a scene plan with narration and captions, and export the result as a downloadable animation.

## Quick start

### Windows

1. Install Node.js 18 or newer from [nodejs.org](https://nodejs.org/) if needed.
2. Download this repository and extract the ZIP, or clone it with Git.
3. Open the extracted `Video-Render` folder.
4. Double-click `start.bat`. It starts the local server and opens the app in your browser.

Alternatively, open Command Prompt or PowerShell in the folder and run:

```powershell
node --version
npm start
```

### macOS or Linux

1. Install Node.js 18 or newer from [nodejs.org](https://nodejs.org/) if needed.
2. Download and extract this repository, or clone it with Git.
3. Open Terminal in the `Video-Render` folder and run:

```bash
chmod +x start.sh
./start.sh
```

Or run `npm start` directly. Keep the terminal open while using the app.

Then visit **http://localhost:3000** on the same computer. Stop the server with `Ctrl+C`.

> Opening `index.html` directly or viewing the GitHub page does not start the server. `localhost` is the computer running Node.js.

## Test it without an API key

Click **Demo prompt**. This loads a sample animated storyboard locally. You can preview it and export a WebM without connecting to a provider. The demo renderer runs offline; external fonts may be unavailable without internet, in which case fallback fonts are used.

## Generate an AI storyboard

1. Enter a prompt, select duration/style, provider, and a model ID supported by that provider.
2. Enter your provider API key.
3. Click **Build my video**. The app creates scenes, visual descriptions, captions, and narration.
4. Optional voice-over uses a compatible text-to-speech API. It can incur separate provider charges.
5. Preview and export. Browser export is WebM; MP4 conversion requires a video editor/converter.

Supported OpenAI-compatible endpoints: OpenAI, OpenRouter, Groq, Together AI, Mistral, DeepSeek, and Fireworks AI. Model IDs and TTS availability vary by provider. This app makes scene plans and renders them with its built-in Canvas engine; it does not generate photorealistic video clips.

## API key privacy

Keys are held in the page memory and sent to the local Node server only while making a provider request. They are **not written to local storage, project files, or logs**. Saved project preferences and scene data stay in this browser. Only use API keys on a computer you trust; a local process with access to the browser or device may still inspect in-memory data.

## Troubleshooting

- **`node` or `npm` not found:** install Node.js 18+ and reopen the terminal.
- **Port 3000 is already in use:** close the other app, or run `PORT=3001 npm start` (macOS/Linux) / `$env:PORT=3001; npm start` (PowerShell), then open `http://localhost:3001`.
- **Blank page / 404:** start the server from the repository folder and open `http://localhost:3000`, not a GitHub URL or a `file://` path. Refresh after the server reports it is ready.
- **AI request fails:** check internet access, API key, provider account/billing, model ID, and whether that provider supports chat completions. A demo works without these.
- **Voice-over fails:** the selected provider must support its configured speech endpoint/model. Storyboards can still be exported without a voice track.
- **Export unavailable:** use a current desktop Chrome, Edge, or Firefox browser and keep the tab open during rendering.

## Health check

With the server running, open [http://localhost:3000/api/health](http://localhost:3000/api/health). A working server returns JSON with `"ok": true`.
