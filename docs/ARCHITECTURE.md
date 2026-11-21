# DebugRep — System Architecture

## 1. Overview
DebugRep is an open-source, multi-file codebase assessment platform (LeetCode Light Mode) inspired by real-world SDE Online Assessments. Candidates debug, extend, and optimize multi-file Java and Python repositories with an integrated, context-aware AI assistant.

## 2. Core Architectural Decisions
- **Decoupled Problem Model (1-to-Many):** A `Problem` (ticket & requirements) is decoupled from its `StackVariant` (`Java 21 / JUnit 5` or `Python / Pytest`).
- **Hybrid Persistence:** Guest mode persists edits and progress in `localStorage` for zero-friction access; optional Supabase OAuth syncs submissions, streaks, and activity heatmaps to Postgres.
- **Virtual File System (VFS):** Client state stores files in a flat hash map (`Record<string, string>`) for O(1) lookups and fast diffing, rendered in the sidebar as a recursive directory tree.
- **Ephemeral RCE Sandboxing:** Untrusted user code runs inside isolated, pre-baked **Modal** Linux containers with strict timeouts and server-side hidden test injection.
- **Diff-Based AI Context:** Only modified lines (`git diff`), the active file, and failing stack traces are sent to Gemini, protected by per-user/IP rate limiting.
