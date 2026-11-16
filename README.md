# Motioncraft — AI Video Studio

A small, local-first MVP for turning a prompt into a short animated video. Choose an OpenAI-compatible provider and model, enter your own API key, generate a scene plan with narration and captions, then preview and export a WebM video.

## Run locally

Requires Node.js 18 or newer. No package install is required.

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. The selected model creates a structured scene plan: visuals, titles, narration, captions, duration, and colors.
2. The app renders those declarative scene instructions using its built-in Canvas animation engine. Model-generated content is treated as data; generated JavaScript is never executed.
3. Optional voice-over is generated using the provider's OpenAI-compatible `/audio/speech` endpoint.
4. Captions are included in the animation, and the browser records the Canvas and narration into a downloadable WebM file.

The **Scene code** tab displays the editable JSON-like blueprint used by the renderer. It does not evaluate arbitrary model-produced code.

## Providers

OpenAI, OpenRouter, Groq, Together AI, Mistral, DeepSeek, and Fireworks AI are included. Enter a model ID accepted by the selected provider. Chat generation requires an OpenAI-compatible chat-completions API. Voice-over is optional and requires that provider to support an OpenAI-compatible `/audio/speech` API with the chosen voice model.

Provider model names and TTS availability change over time; consult your provider's documentation for current model IDs and access requirements. Provider API usage may incur charges.

## API key handling

The API key is held in the page only until you leave or refresh it. For each generation request it is sent to this app's local Node server in memory and forwarded to the selected provider. The app does not save it, log it, or put it in a URL. Use only a trusted deployment, since the server operator can technically inspect requests while they are being processed. Avoid entering keys on public or untrusted hosts.

## Export notes

Video rendering runs in the browser. The output is WebM; use a video editor or converter if you need MP4. Export works in current browsers that support Canvas capture and MediaRecorder (for example, Chrome, Edge, and Firefox). Keep the tab open during rendering.
