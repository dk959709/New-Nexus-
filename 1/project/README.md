# NEXUS

NEXUS is a web search and weather intelligence workspace built with React, Vite, and an Express API.

## Features

- Server-side real web search and news provider integration.
- Real Open-Meteo geocoding, current weather, hourly forecast, and 7-day forecast.
- Browser geolocation with a city-search fallback.
- Animated condition-aware weather backgrounds with reduced-motion settings.
- Weather map configuration surface that never invents map data when credentials are absent.
- Saved search/news items and search history stored locally on the device.
- Responsive PWA shell and Capacitor Android project.
- Docker image configured for amd64 and arm64 builds.

## Setup

```bash
npm install
cp .env.example .env
```

Weather and geocoding work through Open-Meteo without a key. Real web search and news require a provider that accepts the request shape used by `SEARCH_API_URL`, plus `SEARCH_API_KEY`. The API key stays on the server. Set `MAP_API_KEY` for the map provider integration and optionally set the AI variables for answer summaries.

## Run the web app

Run the Vite frontend and Express API separately:

```bash
npm run dev
npm run dev:server
```

The frontend is served by Vite and proxies `/api` to port 8787. For production, build the frontend and server, then run `npm run start:server`.

## Production

```bash
npm run build
npm run build:server
npm run start:server
```

## Docker

```bash
docker compose up --build
```

The Dockerfile uses a Node Bookworm image supported on amd64 and arm64 Linux hosts.

## Android

See `ANDROID_BUILD.md`. The Android Gradle configuration includes `arm64-v8a`, `armeabi-v7a`, and `x86_64` ABIs.
