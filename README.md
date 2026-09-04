# Vernacular Pedagogy Assistant

A responsive web application designed for primary classroom educators to translate lesson plans and English phrases into Hindi with real-time text-to-speech support.

## Features

- **Dual-Engine Translation**: Primary translation via Google Translate endpoint with automatic fallback to MyMemory API for fault tolerance.
- **Resilient Hindi TTS**: Cloud audio playback paired with local browser Web Speech API (`hi-IN`) synthesis fallback.
- **Classroom Utility**: Single-click copy to clipboard, clear canvas, and real-time audio playback controls.
- **Continuous Deployment**: Automated CI/CD pipeline deployed on Netlify directly from GitHub.

## Tech Stack

- **Framework**: React 18, Vite
- **Styling**: Tailwind CSS
- **APIs**: Google GTX / MyMemory Translation APIs, Web Speech API
- **Deployment**: Netlify

## Getting Started Locally

1. Clone the repository:
   ```bash
   git clone https://github.com/abdulrayyan0/vernacular-translator.git
   cd vernacular-translator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open the app in your browser at the URL shown in the terminal (default: `http://localhost:5173`).

## Project Structure

```
vernacular-translator/
├── public/             # Static assets
├── src/
│   ├── App.jsx         # Main application component
│   ├── main.jsx        # React entry point
│   └── index.css       # Global styles
├── index.html          # HTML shell
├── vite.config.js      # Vite configuration
└── package.json        # Dependencies and scripts
```

## Translation Flow

1. User enters English text in the input card.
2. On clicking **Translate Lesson**, the app attempts translation via the Google GTX endpoint.
3. If the Google endpoint fails (network error, CORS, etc.), the app automatically retries with the MyMemory API.
4. If both services fail, a user-friendly error message is displayed.

## Text-to-Speech Flow

1. On clicking **Read Aloud**, the app attempts playback via the Google Translate TTS audio endpoint.
2. If the audio fails to load or play, the app falls back to the browser's native `window.speechSynthesis` with a Hindi (`hi-IN`) voice.
3. The **Stop reading** button cancels both HTML5 Audio and `speechSynthesis` playback.

## License

This project is open source and available under the [MIT License](LICENSE).
