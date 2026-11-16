# Motioncraft — Full AI Video Studio

Motioncraft is a browser-based AI video studio for creating short animated explainers and cinematic scenes from a text prompt. It supports multiple OpenAI-compatible providers, generates a storyboard with narration and captions, adds optional AI voice-over, and exports the final animation as a WebM video.

## Full feature set

- Any OpenAI-compatible provider
- Custom API key entry per request
- Prompt-driven storyboard generation
- Scene durations and total video length control
- Animated canvas preview with captions and generated shapes
- Optional voice-over generation using TTS endpoints
- Saved project library in local storage
- Demo prompt for quick testing
- Downloadable WebM export

## Run locally

Requires Node.js 18+

```bash
npm start
```

Open:

```text
http://localhost:3000
```

## Supported providers

- OpenAI
- OpenRouter
- Groq
- Together AI
- Mistral
- DeepSeek
- Fireworks AI

Use the provider's model name and API key as accepted by that service. Chat models must support OpenAI-compatible chat completions, and voice-over must support an OpenAI-compatible text-to-speech endpoint.

## Notes

- The API key is only used in-browser and is sent to the selected provider during the request.
- It is not saved to disk.
- The app stores generated project metadata locally in the browser for convenience.
- Export is currently WebM because it is generated directly from the browser MediaRecorder.

## Security warning

Use this app only on trusted machines and networks. Any request sent to the local Node server includes the API key entered in the browser. The local server operator can technically inspect request data while it is being processed.

## Typical flow

1. Write a prompt.
2. Choose a model and provider.
3. Enter your API key.
4. Generate the storyboard.
5. Preview the animation.
6. Optionally generate voice-over.
7. Export the final WebM file.

## Example prompt

"A tiny astronaut discovers a glowing garden on Mars, learns to fly, and returns with a dream of home."

## License

This project is a local prototype for experimentation and learning.
