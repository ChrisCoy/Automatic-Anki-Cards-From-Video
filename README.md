I created this based on my own needs, but you can easily adapt it to suit yours.

## Overview

This project downloads a YouTube video's audio and Japanese subtitles, cuts audio snippets for each subtitle, translates the Japanese text to Brazilian Portuguese using OpenAI (via LangChain), and creates Anki cards (with audio) via AnkiConnect.

Key files:

- `src/main.ts` — orchestrates the flow (download, translate, slice audio, create Anki notes).
- `src/translate-with-ai.ts` — uses OpenAI via `@langchain` to produce translation, hiragana and furigana.
- `src/call-anki-connect.ts` — small helper to call AnkiConnect at `http://127.0.0.1:8765`.

## Requirements

- Node 24+ (node 24 only because the typescript support, but you can set up it apart) (or a recent LTS).
- `npm` or `pnpm`.
- ffmpeg installed and available on PATH (used by `fluent-ffmpeg`).
- Anki desktop with the AnkiConnect add-on installed and enabled (listening on `127.0.0.1:8765`).
- An OpenAI API key (set as `OPENAI_API_KEY` in an `.env` file or environment).

IMPORTANT: Anki + AnkiConnect

- This project calls Anki through the AnkiConnect add-on. You must have the Anki desktop application installed and running when you run the script.
- Install the AnkiConnect add-on in Anki (search for "AnkiConnect" in the add-on manager or use the add-on ID from AnkiWeb), enable it, then start Anki so it listens on `http://127.0.0.1:8765`.
- If Anki is closed or AnkiConnect is not enabled the script will fail with connection errors when attempting to create decks/notes.

  Install link / add-on ID:

  - AnkiWeb: https://ankiweb.net/shared/info/2055492159
  - Add-on ID: `2055492159` — in Anki go to Tools → Add-ons → Get Add-ons... and paste this code, or open the AnkiWeb page in your browser.

Optional but recommended:

- Make sure `yt-dlp` (or the bundled `yt-dlp` helper) is available; the repo already includes a `yt-dlp` helper folder.

## Environment

Create a `.env` file at the repository root with at least:

```
OPENAI_API_KEY=sk-....
```

The `start` script in `package.json` loads `.env` automatically (see the `--env-file .env` usage in the `start` script).

## Install

1. From the project root, install dependencies:

```bash
npm install
```

2. Ensure `ffmpeg` is installed and on your PATH. On Windows you can download static builds and add to PATH.
3. Launch Anki and confirm AnkiConnect is enabled (it listens on `http://127.0.0.1:8765`).

## Usage

Basic run (the repository includes a `start` script):

```bash
npm run start
```

That script runs:

```
node --env-file .env src/main.ts download=false url=https://youtu.be/PCp2iXA1uLE
```

You can run `src/main.ts` with custom arguments. The app expects a `url` argument with the YouTube video URL. Example:

```bash
node --env-file .env src/main.ts url=https://youtu.be/VIDEO_ID
```

Notes on arguments:

- `url` — the YouTube video URL to process.
- `download` — optional; when set to `false` the script may skip downloading if you already have content saved (the project includes logic around `downloadAudioAndSubs`).

Adjust these arguments directly on the command line as shown.

## Anki model & deck naming

- The Anki model name is set in `src/main.ts` by the `modelName` constant (currently `音楽::Model`). Change it there if you want a different model name.
- The script creates a deck named `音楽::<video title>` (so each video gets its own deck). To change the deck naming you can edit the `createDeck` call in `src/main.ts`.

## What the script does per subtitle

1. Download audio and japanese subtitles (saved under `content/` with a `fileId`).
2. For each Japanese subtitle it:
   - Calls the translation chain in `src/translate-with-ai.ts` to produce `translation`, `hiragana`, and `furigana`.
   - Cuts the audio snippet for the subtitle using `fluent-ffmpeg`.
   - Calls AnkiConnect (`src/call-anki-connect.ts`) to create a note with audio attached.

## Troubleshooting

- If you get ffmpeg errors: check that the `ffmpeg` binary is installed and reachable from your shell (run `ffmpeg -version`).
- If AnkiConnect requests time out or connection refused: make sure Anki is running and that the AnkiConnect add-on is installed and enabled. Also verify the port `8765` is free and not blocked by firewall.
- If translations produce errors: confirm `OPENAI_API_KEY` is set and has sufficient quota. The project uses `@langchain/openai`.

## Customization tips

- To change the LLM model or parameters, edit `src/translate-with-ai.ts` (the `ChatOpenAI` constructor).
- To change the note fields or card template, edit `createAnkiModelIfNotExists` in `src/main.ts`.
- To change file storage or output format, inspect `download-audio-and-subs.ts` and `cutAudio` in `src/main.ts`.

## Development and testing

- There are no automated tests included. If you add tests, follow the project's `type: "module"` setup.
- When changing Anki-related code, you can test with a small video or short subtitle segment and observe Anki's debug console or network.

## Final notes

This README was created to match how I used the project. Feel free to adapt commands, deck/model names, or language/translation behavior to your workflow.
