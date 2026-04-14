# Chat-First Frontend Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reframe Hermes Desktop into a chat-first product where the user’s default attention is reserved for conversation, session recall, and message composition instead of runtime diagnostics or low-value metadata.

**Architecture:** Keep the existing desktop shell and route structure, but change the information hierarchy from “engineering dashboard with chat in the middle” to “conversation workspace with optional management surfaces.” Runtime health, session files, and technical metadata should become secondary or on-demand layers rather than default visual anchors.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, Tauri v2, Rust command bridge

---

## Product Premise

The current chat page shows too much engineering-visible information by default:

- Hermes version
- executable path
- session id
- session filename
- runtime cards
- current message count
- repeated context cards

These details are useful for debugging, but most users do not open the chat page to inspect infrastructure. They open it to:

1. Continue a prior conversation
2. Start a new conversation
3. Send a message confidently

Anything that does not directly support those jobs should be visually downgraded, hidden behind disclosure, or moved to a management page.

## Product Principles

### 1. Default Surface = Chat, not Diagnostics

The conversation canvas is the product. System details should not compete with it unless they block task completion.

### 2. Healthy State Should Be Quiet

When Hermes is installed and ready, the UI should not repeatedly announce version/path/runtime details. Normal state should be visually calm. Abnormal state should become explicit and actionable.

### 3. Recognition Beats Raw Data

Users should identify sessions by meaning:

- what it was about
- when it was updated
- where it came from

They should not need to decode file names or session ids.

### 4. Secondary Information Must Be User-Pulled

Inspector data, runtime details, session files, and debug metadata should appear only when the user explicitly asks for context or troubleshooting help.

### 5. One Primary Task per Screen

On the chat page, that task is conversation. Channels, skills, tasks, and settings are valid product areas, but they are secondary to the core conversational workflow.

## User Jobs

### Primary

- Start a new chat quickly
- Continue a recent chat without thinking about storage or file semantics
- Understand whether sending a message will work
- Focus on message history and composition

### Secondary

- Find an older session by title or summary
- Check whether Hermes is connected
- View additional conversation context when troubleshooting

### Low-Priority / Debug

- Inspect exact session file name
- Inspect session id
- Inspect local executable path
- Inspect version number
- Inspect runtime internals when nothing is broken

## Information Value Hierarchy

### Tier A: Always Visible

- New chat action
- Search sessions
- Recent session list
- Active conversation title
- Message history
- Composer
- Minimal ready/error state

### Tier B: Contextual / Conditionally Visible

- Session source label
- Relative updated time
- Recoverable error banner
- Active session summary

### Tier C: On-Demand Only

- Hermes version
- Executable path
- Session id
- Session filename
- Runtime detail panel
- Raw technical status

## Reference Direction

The desired interaction style is closer to Claude’s desktop experience than to a monitoring console:

- left rail for navigation and recents
- large calm conversation canvas
- composer as the main control surface
- very little repeated metadata
- healthy state mostly invisible

This does **not** mean visually copying Claude. It means copying the product judgment:

- protect attention
- remove repeated low-value information
- let chat dominate the page

## Page-Level Recommendations

### 1. Global Shell

Keep the left app rail, but reduce the “dashboard” feeling.

Recommendations:

- Keep product identity at the top
- Keep one clear active-state treatment for the selected nav item
- Reduce explanatory copy density in the nav
- Remove decorative labels like `Desktop` unless they serve a real decision

### 2. Chat Page

The chat page should use a two-level hierarchy:

- Left: recent sessions and search
- Center: conversation and composer

Optional third level:

- Right-side inspector only when manually opened or when an error exists

### 3. Runtime State

Runtime state should behave like this:

- Healthy: a small status dot + “已就绪”
- Degraded: compact warning pill with a direct recovery action
- Missing: explicit inline banner near the composer

Do not show full path/version by default in the healthy case.

### 4. Session List

Session cards should show:

- human-readable title
- one meaningful preview line
- relative time
- optional source chip if the list mixes CLI/Feishu/WeChat sessions

Session cards should not show:

- JSON snippets
- session filenames
- request dump artifacts
- verbose technical labels

### 5. Composer

The composer should be the second-most important visual element after the active conversation.

Recommendations:

- stronger surface contrast than surrounding footer
- one obvious send affordance
- disabled states explained inline if Hermes is unavailable
- lightweight attachment affordances

## Interaction Model

### Normal Flow

1. User lands on the chat page
2. Left column shows recent sessions and search
3. Center canvas either shows current conversation or a calm empty state
4. User types and sends
5. Runtime detail stays mostly invisible

### Error Flow

1. User sends a message
2. Hermes fails or is unavailable
3. Error is shown near the composer and optionally mirrored in an inspector
4. Technical detail is available behind “查看详情”, not forced into the main reading path

### Inspection Flow

1. User explicitly opens conversation details
2. Inspector shows source, runtime, session metadata
3. Closing the inspector restores the chat-first canvas

## Visual Direction

Based on the local design-system guidance:

- Warm minimal operational shell
- Soft borders, not heavy card stacking
- Large heading hierarchy
- Minimal repeated labels
- Avoid glassmorphism overuse inside dense chat workflows
- Use one restrained accent color for action and healthy status

## Scope Decisions

### Keep

- Existing route structure
- Existing Tauri/Rust runtime bridge
- Existing sidebar navigation model
- Existing theme toggle

### Change

- Chat page information density
- Runtime visibility rules
- Session list semantics
- Right inspector from default-visible to optional/contextual
- Header from status-heavy to title-first

### Do Not Build Yet

- Full multi-pane developer console
- Persistent always-open right rail
- Detailed file/debug surfacing in the main chat route
- Additional dashboard metrics on the chat page

## Proposed Deliverables

1. A simplified chat-first shell
2. A user-facing session browser
3. A composer-first footer
4. An optional inspector instead of a permanent one
5. A runtime status model with quiet healthy state and explicit unhealthy state

## Verification Criteria

The redesign is successful when:

- A new user can identify where to start a conversation within 2 seconds
- A returning user can identify a recent session without reading file-like ids

## Current Execution Status

Implemented in the current pass:

- Simplified the global desktop shell so the app chrome reads as navigation, not a monitoring dashboard
- Reduced chat-page default information to recent sessions, current conversation, error banner, and composer
- Replaced the icon-only new-chat affordance with a clear primary action in the session pane
- Removed low-value composer chrome and non-functional action buttons from the default chat workflow
- Changed the right inspector from effectively forced visibility to an explicit user-pulled panel
- Shifted the visual system from cool dashboard blue-gray toward warm neutral desktop surfaces with restrained accent usage
- Reduced the session list further so default recents focus on titles instead of avatars, timestamps, and summaries
- Moved session model/context/cost signals into the composer container instead of a separate details surface
- Added markdown rendering for conversation content, including headings, code blocks, tables, and task lists
- Added a dedicated execution-card path for `tool` role messages so tool use no longer appears as blank gaps or raw JSON noise
- Added forward-compatible rendering hooks for richer execution artifacts such as thinking and metadata blocks
- Added timeline-style execution artifacts so adjacent tool events read as a process trail instead of unrelated cards
- Added specialized rendering for task-plan payloads (`todos`) and background-process payloads instead of generic key-value dumps
- Added a quieter treatment for context-compaction reference messages so they stop competing with the active conversation
- Added chat-level view filters for `全部 / 只看对话 / 只看产物` to help users focus on either outcomes or execution flow
- Replaced the mock `渠道` page with a real `~/.hermes/.env` editor plus actual Gateway start/stop/restart controls and persisted runtime-state surfacing
- Replaced the mock `技能` page with a real skills inventory sourced from `~/.hermes/skills`, Hermes config-driven enable/disable state, and actual install/delete actions
- Replaced the mock `任务` page with a real cron dashboard backed by `~/.hermes/cron/jobs.json`, `hermes cron status`, and live create/pause/resume/run/delete actions
- Added a Hermes-Python bridge in Tauri so the desktop client can reuse Hermes' own config/runtime helpers instead of reimplementing brittle YAML logic on the frontend

Still worth validating manually:

- Whether the new warm palette feels calm enough in both light and dark themes
- Whether session cards should become even lighter for long lists
- Whether the conversation header still contains any metadata that can be further demoted
- Whether channel save/install flows behave correctly against the user's real Hermes profile when launched from the packaged desktop shell
- The chat page feels less like a system monitor and more like a conversation product
- Hermes runtime details no longer dominate the healthy-state UI
- Error states are easier to recover from because they are located near the composer

---

## Implementation Tasks

### Task 1: Collapse Low-Value Default Metadata

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/Chat.tsx`
- Modify: `src/components/ChatInspector.tsx`

**Step 1: Remove default-visible low-value data**

Hide or downgrade the following from the default chat view:

- executable path
- session id
- session filename
- current message count
- repeated runtime cards
- decorative platform tags with no user decision value

**Step 2: Preserve technical detail behind inspection**

Retain these details in an explicit inspector, drawer, or details trigger instead of deleting them entirely.

**Step 3: Validate hierarchy**

Run:

```bash
npm run build
```

Manual check:

- Chat canvas is visually dominant
- No repeated runtime information across shell/header/inspector/footer

### Task 2: Redesign the Session List for Recognition

**Files:**
- Modify: `src/pages/Chat.tsx`
- Modify: `src/api/hermes.ts` only if helper types are needed

**Step 1: Use semantic titles**

Generate display titles from:

- first meaningful user intent
- known display name
- fallback conversational label

Avoid exposing raw `session_2026...` strings unless in debug mode.

**Step 2: Use short previews**

Show one short preview line that helps the user recall the session quickly.

**Step 3: Filter debug noise**

Do not include:

- cron artifacts
- request dumps
- storage-only records with no readable content

**Step 4: Validate**

Manual check:

- A user can distinguish at least five recent sessions by meaning alone

### Task 3: Convert Runtime State into a Quiet Service Layer

**Files:**
- Modify: `src/hooks/useHermesRuntime.ts`
- Modify: `src/components/Layout.tsx`
- Modify: `src/pages/Chat.tsx`

**Step 1: Healthy state**

Render only a light healthy indicator in the main flow.

**Step 2: Unhealthy state**

Render an inline warning banner or blocked-composer state when Hermes is missing or degraded.

**Step 3: Recovery affordance**

Pair error copy with one obvious next action:

- open settings
- re-check runtime
- inspect details

**Step 4: Validate**

Manual check:

- Healthy state is quiet
- Broken state is unmissable but localized

### Task 4: Make the Composer the Primary Control Surface

**Files:**
- Modify: `src/pages/Chat.tsx`
- Modify: `src/styles/global.css`

**Step 1: Increase prominence**

Use contrast, spacing, and button clarity to make the composer feel active and central.

**Step 2: Clarify disabled states**

If Hermes is unavailable, explain it in or near the composer.

**Step 3: Keep accessory controls subordinate**

Attachment, emoji, and extra controls should remain discoverable but not dominant.

**Step 4: Validate**

Manual check:

- Composer is the clearest interactive element on the page

### Task 5: Make the Inspector Optional

**Files:**
- Modify: `src/components/ChatInspector.tsx`
- Modify: `src/pages/Chat.tsx`

**Step 1: Change default behavior**

The right inspector should not be the default center-of-gravity when all systems are healthy.

**Step 2: Trigger rules**

Show it when:

- user opens details
- an error occurs
- viewport is wide enough and the information is genuinely useful

**Step 3: Validate**

Manual check:

- Narrower desktop widths preserve chat focus
- Wide layouts still support deeper inspection when needed

### Task 6: Rebalance the Shell Around a Chat-First Product

**Files:**
- Modify: `src/components/Layout.tsx`
- Modify: `src/styles/global.css`

**Step 1: Make “对话” the emotional center**

Keep all nav items accessible, but reduce the feeling that every product area is equally primary.

**Step 2: Simplify top-level chrome**

The header should confirm context, not act like a status dashboard.

**Step 3: Validate**

Manual check:

- The product feels like a chat tool with management areas, not a management tool with a chat area

### Task 7: Final Review and Product QA

**Files:**
- Modify: `README.md` if layout behavior documentation needs updating
- Modify: `docs/plans/2026-04-13-chat-first-frontend-optimization-plan.md` only if notes are refined during implementation

**Step 1: Run static verification**

```bash
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

**Step 2: Manual PM review checklist**

- Can a user start a new chat instantly?
- Can a user recognize a recent session by title/summary alone?
- Is healthy runtime state quiet?
- Are errors visible close to the place where the user is blocked?
- Does the page still feel calm when there are many historical sessions?

**Step 3: Commit**

```bash
git add src/components/Layout.tsx src/pages/Chat.tsx src/components/ChatInspector.tsx src/hooks/useHermesRuntime.ts src/styles/global.css docs/plans/2026-04-13-chat-first-frontend-optimization-plan.md
git commit -m "docs: add chat-first frontend optimization plan"
```

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7

## Notes

- Prefer removing default-visible information over re-styling it.
- Treat every visible label as if it costs user attention.
- When in doubt, keep the chat page simpler and move information into settings or inspection layers.
- The benchmark is not “does this surface expose more data?” The benchmark is “does this help the user continue the conversation faster?”
