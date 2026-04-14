# Hermes Desktop

Hermes Desktop is a Tauri-based desktop client for Hermes Agent.

It turns Hermes' CLI-first workflow into a native desktop experience with:

- chat-first conversation UI
- onboarding and environment checks
- channel management
- skill management
- scheduled task management
- preference-style settings

The current product direction is intentionally not "AI workbench" or "control center".  
The goal is a calmer desktop client where conversation stays primary, and system complexity appears only when needed.

## Current Status

This repository is already runnable and includes real Hermes integration through the Tauri backend.

Implemented:

- Hermes installation and environment detection
- desktop chat shell with session loading
- channel configuration UI, including embedded WeChat QR flow
- skill inventory and enable/disable management
- cron task management
- settings shell backed by real Hermes config snapshot reads/writes

Still being refined:

- settings page depth for custom providers and model discovery
- more complete bilingual support
- finer interaction polish across chat artifacts, task states, and management pages

## Stack

- Tauri v2
- React 18
- TypeScript
- Vite
- Tailwind CSS

## Run Locally

### Requirements

- Node.js 18+
- Rust toolchain
- Hermes Agent installed and available in your login shell

### Install

```bash
npm install
```

### Start Desktop App

```bash
npm run tauri dev
```

### Start Frontend Only

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm run tauri build
```

## Project Structure

```text
src/
  components/         Shared UI components
  hooks/              Runtime and app hooks
  lib/                Shared helpers
  pages/              Chat, channels, skills, tasks, settings
  styles/             Global theme and component styles
src-tauri/
  src/                Tauri Rust backend
  icons/              App icons
docs/plans/           Product and UI planning documents
ui/                   High-fidelity static reference explorations
```

## Product Notes

The current UI direction is documented in:

- `docs/plans/2026-04-14-desktop-page-requirements-reset.md`
- `docs/plans/2026-04-14-settings-page-reset-requirements.md`

These documents define the current product judgment:

- chat-first
- simple-first
- desktop-client-first
- real-capability-first

## Open Source Notes

This project is under active product and UI iteration.  
Expect visible changes in naming, information architecture, and interaction details as the desktop client continues to stabilize.
