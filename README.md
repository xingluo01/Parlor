# Parlor

An AI roleplaying frontend built with React, TypeScript, and Vite, backed by a Node/Express server for data persistence. Designed for deep SillyTavern compatibility with a modern, streamlined interface.

## Features

### Chat & Generation
- **Streaming Responses** - Real-time token streaming with stop/continue controls
- **Swipes** - Navigate alternate response versions with swipe history
- **Message Editing** - Edit any message inline, with swipe-aware editing
- **Regeneration** - Regenerate any assistant message (creates a new swipe)
- **Continue Generation** - Extend the last response with a single click
- **Auto-Continue** - Automatically continue generation when a response hits the token limit
- **Impersonation** - Have the AI write as your character with customizable prompts
- **Conversation Branching** - Branch from any message to explore alternate paths, with tree visualization
- **Bookmarks** - Pin messages and browse them in a dedicated panel
- **Author's Notes** - Inject context at configurable depth in the conversation
- **Chat Summarization** - Auto or manual summarization of long conversations
- **Keyboard Shortcuts** - Ctrl+Enter to send, Ctrl+Shift+Enter to continue, Ctrl+Shift+R to regenerate, Escape to stop

### Characters & World Building
- **Character Management** - Create, import (PNG/JSON), and export characters in TavernAI/SillyTavern V2 format
- **Example Dialogue** - Character example messages (mes_examples) injected as few-shot context
- **Alternate Greetings** - Pick from multiple opening messages when starting a chat
- **Expression System** - Emotion-based avatar variants that change with message content
- **Lorebook / World Info** - Keyword-triggered lore entries with advanced matching:
  - Secondary keywords with AND/OR selective logic
  - Match whole words option to prevent false triggers
  - Case-sensitive matching
  - Per-entry insertion order
  - Configurable World Info format template (wi_format)
- **Global & Per-Character Books** - Manage world info at global or character scope, toggle per chat

### Group Chats
- **Multi-Character Conversations** - Multiple AI characters in a single chat
- **Turn Modes** - Natural (weighted random), list (round-robin), random, or manual selection
- **Group Nudge Prompt** - Customizable template for directing which character responds

### Presets & Prompt Engineering (SillyTavern-Compatible)
- **Full Preset Import** - Import SillyTavern preset JSON files with all fields preserved
- **Prompt System** - Ordered prompt entries with enable/disable, depth injection, and variable substitution
- **Template Variables** - {{char}}, {{user}}, {{description}}, {{personality}}, {{scenario}}, {{persona}}, {{wiBefore}}, {{wiAfter}}, {{mesExamples}}, {{systemPrompt}}, {{jailbreak}}, and more
- **Format Strings** - personality_format, scenario_format, impersonation_prompt, continue_nudge_prompt, new_chat_prompt, new_example_chat_prompt, group_nudge_prompt
- **Forbid Overrides** - Prevent character cards from replacing preset prompt content
- **Post-Prompt Processing** - Message formatting modes for API compatibility: merge consecutive roles, semi-strict/strict alternation, single user message (with and without tools variants)
- **Per-Chat Overrides** - Override temperature, top_p, top_k, min_p, penalties, max tokens, context size, and reasoning parameters per chat

### AI Providers
- **Multi-Provider Support** - OpenAI, Anthropic, OpenRouter, Google Gemini, Mistral, Groq, DeepSeek, GLM (Zhipu), Ollama, LM Studio, and any OpenAI-compatible endpoint
- **Reasoning Models** - Extended thinking support for OpenAI o-series, Anthropic Claude, DeepSeek R1, and GLM models with configurable effort/budget
- **Connection Testing** - Test connections and fetch available models from each provider

### Extras
- **Personas** - Multiple user profiles with descriptions, avatars, and per-character defaults
- **Regex Scripts** - Custom find/replace rules for input/output processing with live preview
- **TTS** - Text-to-speech with per-character voice preferences
- **Image Generation** - DALL-E, Stable Diffusion WebUI, and ComfyUI integration via /imagine
- **Quick Replies** - Shortcut buttons with template variable support
- **Themes** - Built-in themes (Ink & Velvet, Midnight, Lavender, Forest, Crimson, Classic Purple) plus custom theme editor
- **Vector Store / RAG** - Document chunking and retrieval-augmented generation
- **Backup & Restore** - Quick and full backup/restore of all data
- **Multi-Instance Sync** - Sync data between two running instances

## Changelog

### v0.2.0 — SillyTavern Compatibility & Power Features

#### Preset System Overhaul
- **New preset fields**: `new_example_chat_prompt`, `group_nudge_prompt`, `wi_format` — all imported from SillyTavern presets and editable in the Utility tab
- **Forbid Overrides**: `forbid_overrides` on prompt entries now works — prevents character cards from replacing "Main Prompt" or "Post-History Instructions" content
- **Post-Prompt Processing**: 7 message formatting modes matching SillyTavern's dropdown — merge consecutive roles, semi-strict/strict alternation, single user message, with and without tools variants. Configurable per preset in the Parameters tab

#### Lorebook / World Info Upgrades
- **Secondary Keywords**: Entries can now require secondary keywords with AND (all must match) or OR (any matches) logic via the new "Selective" toggle
- **Match Whole Words**: New checkbox prevents false triggers from partial substring matches (e.g., "ant" won't trigger on "pleasant")
- Full UI in both the Lorebook page and World Info settings, with import support from character cards

#### Auto-Continue
- New setting: **Auto-Continue on Token Limit** — when the API returns `finish_reason: length`, Parlor automatically continues generation, appending to the last message. Supports chained auto-continues for very long responses. Toggle in Settings > General

#### Keyboard Shortcuts
- `Ctrl+Enter` — Send message
- `Ctrl+Shift+Enter` — Continue generation
- `Ctrl+Shift+R` — Regenerate last response
- `Escape` — Stop generation
- `Ctrl+L` — Focus input

#### Example Dialogue (mes_examples)
- Character example messages are now injected into the system prompt as few-shot context in the default (non-preset) code path. Previously they were imported but never used

#### Group Chat
- **Group Nudge Prompt**: Customizable prompt template for group chats with `{{char}}`, `{{user}}`, `{{group}}` variables, replacing the hardcoded instruction

### v0.1.0 — Initial Release
- Character import/export, chat interface, multi-provider support, presets, personas, lorebook, regex scripts, bookmarks, backup/restore, sync support

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (includes npm)

### One-Command Launch

Clone the repo and run the start script — it handles dependencies, building, and launching automatically:

**Windows:**
```bash
git clone https://github.com/GhostNoodl/Parlor.git
cd Parlor
start.bat
```

**Mac / Linux:**
```bash
git clone https://github.com/GhostNoodl/Parlor.git
cd Parlor
./start.sh
```

Parlor will be running at `http://localhost:3001`.

### Development Mode

If you want hot-reloading for development:

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`.

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
