# TTS Web App

A local-first text-to-speech web app built with FastAPI, premium Edge neural voices, and Piper.

## Features

- Upload a plain text file, paste text, or drag and drop a file
- Queue TTS jobs and watch chunk-by-chunk processing progress
- Choose between more natural premium neural voices and offline local voices
- Keep completed tracks in a selectable list
- Play, pause, skip forward/back 5 seconds, and scrub on a timeline

## Run

```bash
python3 -m pip install -r requirements.txt
python3 -m uvicorn main:app --reload
```

Open `http://127.0.0.1:8000`.

## Notes

- The app offers higher-quality Microsoft Edge neural voices by default. These require internet access during synthesis.
- The app also keeps local Piper fallback voices in `./models`, including `en_US-ryan-high` and `en_US-lessac-medium`.
- Uploaded files must be UTF-8 plain text and under 5 MB.
