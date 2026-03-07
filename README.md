# Parlor

An AI roleplaying frontend built with React, TypeScript, and Vite, backed by a Node/Express server for data persistence.

## Features

- **Character Management** - Create, import (PNG/JSON), and export characters in TavernAI/SillyTavern format
- **Chat Interface** - Streaming responses with swipe navigation for alternate responses, message editing, regeneration
- **Multi-Provider Support** - Connect to OpenAI, Anthropic, OpenRouter, or any OpenAI-compatible API
- **Personas** - User profiles for roleplay with per-character defaults
- **Presets** - Generation parameter presets with SillyTavern-compatible prompt configuration
- **Per-Chat Overrides** - Override temperature, context size, and other parameters on a per-chat basis
- **Reasoning Support** - Extended thinking for OpenAI o1/o3, DeepSeek R1, GLM, and Anthropic models
- **Lorebook** - Keyword-triggered world info entries per character
- **Regex Scripts** - Custom find/replace rules for input and output processing
- **Bookmarks** - Pin and quickly navigate to important messages
- **Backup & Restore** - Quick and full backup/restore of all data

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

Start the app in development mode (frontend + API server in one command):

```bash
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production

Build and run:

```bash
npm run build
npm start
```

The full app (frontend + API) runs on `http://localhost:3001`.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
- **State**: Zustand for cross-component state, local state for page-level data
- **Backend**: Express.js REST API with JSON file storage in `data/`
- **Styling**: Tailwind CSS with custom glass morphism theme

## Project Structure

```
src/
  components/    # Reusable UI components
    layout/      # Layout, Sidebar, BottomNav
    ui/          # Avatar, Button, Input, Modal
    chat/        # Chat-specific components
  pages/         # Route-level page components
  services/      # API client, AI provider integration
  stores/        # Zustand state stores
  types/         # TypeScript type definitions
  utils/         # Utility functions (character import, etc.)
  hooks/         # Custom React hooks
  db/            # IndexedDB operations
server.cjs       # Express REST API server
data/            # JSON file storage (created at runtime)
```

## License

MIT
