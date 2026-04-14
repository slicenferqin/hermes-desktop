# Desktop Shell Polish and Runtime Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the current Tauri desktop shell into a higher-signal desktop workspace with clearer visual hierarchy, cleaner session presentation, and a more trustworthy Hermes runtime surface.

**Architecture:** Keep the existing three-zone desktop information architecture, but rebalance emphasis so the chat canvas is the primary surface, the left rail is navigation-only, and the right rail becomes a contextual inspector instead of a static card stack. Runtime checks stay Rust-first and are surfaced to the React shell through `invoke`, so UI state reflects the actual local Hermes environment instead of guessing from frontend shell behavior.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Tauri v2, Rust command bridge

---

## Current State

The repo already has the following pieces in place:

- A desktop shell layout in `src/components/Layout.tsx`
- A three-column chat workspace in `src/pages/Chat.tsx`
- Rust-backed Hermes detection and command execution in `src-tauri/src/lib.rs`
- An install wizard that now reads runtime state from the Rust bridge in `src/pages/InstallWizard.tsx`

The remaining problems are product and UX focused:

- The UI has weak contrast and too many equally weighted panels.
- The session list exposes raw filenames and JSON-like previews.
- The top bar consumes space without enough utility.
- The right rail occupies width but carries low-value content.
- The composer does not visually dominate enough for a chat-first product.
- Runtime state is technically available, but not yet integrated into the main desktop shell as a first-class status model.

## Constraints

- Keep the current route structure and avoid a routing rewrite.
- Keep the forced onboarding toggle behavior intact for acceptance testing.
- Do not reintroduce frontend `plugin-shell` probing for Hermes detection.
- Prefer polishing the existing shell over creating a brand-new page system.
- Do not add heavy dependencies for layout, state, or testing.

## Out of Scope

- Full settings CRUD for `config.yaml`, `.env`, and `SOUL.md`
- Streaming chat transport or gateway websocket work
- Skill/task/channel backend completion
- End-to-end test framework setup

## Verification Strategy

There is no existing UI test suite, so validation should combine build checks with manual smoke checks:

- `npm run build`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run tauri dev`
- Manual desktop checklist:
  - Sidebar navigation works across all pages
  - Hermes version/path/install state renders correctly
  - Sending a single chat message uses `hermes chat -Q -q ...`
  - Session continuation resumes the same Hermes session
  - Session list no longer shows debug-like `request_dump` noise by default
  - Main chat canvas reads as the primary focus on a 1440px-wide window

### Task 1: Establish Desktop Visual Tokens

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tailwind.config.js` only if new semantic utilities are needed

**Step 1: Add explicit surface hierarchy tokens**

Introduce distinct semantic tokens for:

- `--color-surface-shell`
- `--color-surface-sidebar`
- `--color-surface-panel`
- `--color-surface-canvas`
- `--color-border-subtle`
- `--color-shadow-soft`
- `--color-shadow-strong`

These should reduce the current “all panels are the same gray” problem without changing the overall light/dark theme direction.

**Step 2: Rework common primitives**

Adjust the shared `.card`, `.input`, `.btn-primary`, `.btn-secondary`, and `.glass` recipes so they support:

- Lower default border contrast
- More intentional elevation
- Better separation between container surfaces and interactive controls

**Step 3: Verify token changes do not break existing pages**

Run:

```bash
npm run build
```

Expected: build succeeds and all pages still render with the updated token system.

**Step 4: Commit**

```bash
git add src/styles/global.css tailwind.config.js
git commit -m "style: establish desktop surface hierarchy tokens"
```

### Task 2: Compress and Clarify Global Shell Chrome

**Files:**
- Modify: `src/components/Layout.tsx`

**Step 1: Reduce top toolbar height and noise**

Change the current workspace header so it behaves like a desktop toolbar rather than a secondary hero panel:

- Shrink vertical padding
- Remove placeholder copy that does not provide action
- Keep only route title, runtime status, and one compact utility cluster

**Step 2: Strengthen sidebar navigation**

Refine the left rail so it behaves more like app navigation and less like a card list:

- Tighten item spacing
- Reduce explanatory subtext weight
- Make active state more decisive
- Preserve app identity block at the top

**Step 3: Make shell status useful**

Add space for a concise runtime badge derived from actual Hermes state:

- Connected
- Not installed
- Misconfigured
- Degraded

This should be render-ready even if the full state hook is introduced in a later task.

**Step 4: Smoke test navigation**

Run:

```bash
npm run build
```

Manual check:

- Switch between `对话 / 渠道 / 技能 / 任务 / 设置`
- Confirm the shell does not visually overpower page content

**Step 5: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat: simplify desktop shell chrome"
```

### Task 3: Turn the Session List into a User-Facing Browser

**Files:**
- Modify: `src/pages/Chat.tsx`
- Modify: `src/api/hermes.ts` only if extra session metadata helpers are needed

**Step 1: Normalize session titles**

Replace raw filename-like display such as:

- `20260411 204252 6fb99...`
- `request dump ...`
- `session 20260411 ...`

with cleaner UI labels:

- Derived title from session content if possible
- Fallback “未命名会话”
- Optional secondary metadata line for timestamp/source

**Step 2: Filter or de-prioritize debug artifacts**

Hide or move low-value internal session records out of the default list view:

- `request_dump*`
- empty export artifacts
- machine-only rows with no meaningful preview

If they must remain accessible, they should live behind an explicit debug filter.

**Step 3: Improve preview extraction**

Strip obvious JSON fragments and metadata noise from session previews. Prefer:

- last assistant reply summary
- first meaningful plain-text line
- fallback “暂无消息”

**Step 4: Verify session continuity**

Manual check after `npm run tauri dev`:

- Open an existing session
- Send one message
- Confirm the active session continues instead of creating an unrelated duplicate row

**Step 5: Commit**

```bash
git add src/pages/Chat.tsx src/api/hermes.ts
git commit -m "feat: clean up session browser presentation"
```

### Task 4: Rebalance the Chat Canvas and Composer

**Files:**
- Modify: `src/pages/Chat.tsx`
- Modify: `src/styles/global.css`

**Step 1: Make the message canvas the primary visual surface**

Reduce frame noise around the main conversation area:

- Fewer heavy borders
- Stronger background separation from side rails
- Clearer spacing above and below messages

**Step 2: Promote the composer**

The input area should become the second-most important visual element after the chat content:

- Increase contrast against the canvas
- Make send action more legible
- Reduce the “disabled gray bar” feeling
- Keep the command/attachment affordances secondary

**Step 3: Tighten message bubble ergonomics**

Review:

- bubble max width
- timestamp emphasis
- assistant/user contrast
- empty state prompts

The target is to feel like a desktop workspace, not a stretched mobile messenger.

**Step 4: Build and manually review**

Run:

```bash
npm run build
```

Manual check:

- empty state
- one-message state
- long assistant error message
- multiline composer input

**Step 5: Commit**

```bash
git add src/pages/Chat.tsx src/styles/global.css
git commit -m "style: refocus chat canvas and composer"
```

### Task 5: Convert the Right Rail into a Real Inspector

**Files:**
- Modify: `src/pages/Chat.tsx`
- Create: `src/components/ChatInspector.tsx` if extraction improves clarity

**Step 1: Define inspector sections**

The right rail should expose context that helps a desktop user reason about the active session:

- runtime status
- active Hermes session id
- resolved Hermes binary path
- source/platform tag
- last meaningful session summary
- current error state if the last send failed

**Step 2: Make the rail adaptive**

Behavior target:

- visible on wide desktop widths
- hidden or collapsible on narrower windows
- no duplicate information that already exists in the main header

**Step 3: Wire inspector data from existing state**

Do not add a full global store. Reuse:

- current chat state
- Hermes runtime response from the install/runtime surface
- active session metadata

**Step 4: Manual review**

Check at approximately:

- 1280px width
- 1440px width
- 1728px width

Expected: the rail helps, rather than squeezing the conversation.

**Step 5: Commit**

```bash
git add src/pages/Chat.tsx src/components/ChatInspector.tsx
git commit -m "feat: add contextual desktop chat inspector"
```

### Task 6: Surface Runtime State in the Main Shell

**Files:**
- Modify: `src/api/hermes.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/InstallWizard.tsx`
- Modify: `src-tauri/src/lib.rs` only if an additional aggregate status endpoint is required

**Step 1: Define the UI state model**

Create a minimal state shape for the desktop shell:

```ts
type HermesRuntimeState = {
  installed: boolean;
  version: string | null;
  path: string | null;
  statusLabel: "connected" | "missing" | "degraded";
};
```

**Step 2: Reuse backend-first detection**

Do not add frontend shell probing. Use existing Rust-backed information from:

- `check_command`
- `get_hermes_status`

Optionally add one aggregate endpoint if the shell needs a single request payload.

**Step 3: Show runtime state outside onboarding**

Make the main layout and chat workspace aware of runtime health so users are not forced to infer failure from message errors alone.

**Step 4: Regression test**

Run:

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Manual check:

- Hermes installed path shows as healthy state
- Missing Hermes path shows as warning/error state
- Install wizard and main shell do not contradict each other

**Step 5: Commit**

```bash
git add src/api/hermes.ts src/components/Layout.tsx src/pages/InstallWizard.tsx src-tauri/src/lib.rs
git commit -m "feat: surface hermes runtime state in shell"
```

### Task 7: Final Smoke Pass and Documentation Sync

**Files:**
- Modify: `README.md` if screenshots or layout notes are updated
- Modify: `IMPLEMENTATION.md` if it still describes outdated shell behavior

**Step 1: Run full static verification**

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

Expected: both pass without new warnings introduced by this work.

**Step 2: Run desktop smoke test**

```bash
npm run tauri dev
```

Manual checklist:

- app window appears
- shell layout reads cleanly
- onboarding still opens for acceptance testing
- sending “你好” no longer triggers `unrecognized arguments`
- response body renders without trailing `session_id:` noise

**Step 3: Sync docs**

Update any stale documentation that still claims:

- mobile-like navigation
- frontend shell-based Hermes detection
- outdated Tauri plugin shell config expectations

**Step 4: Commit**

```bash
git add README.md IMPLEMENTATION.md docs/plans/2026-04-13-desktop-shell-polish-and-runtime-hardening.md
git commit -m "docs: sync desktop shell implementation plan"
```

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7

## Notes for Execution

- Prefer incremental commits after each task.
- Avoid introducing a global state library unless runtime status propagation becomes unmanageable.
- Preserve current onboarding forcing behavior until acceptance testing is complete.
- Keep the design language Chinese-first and desktop-first.
- If session parsing becomes unreliable, add an explicit sanitization helper rather than further complicating the JSX render path.
