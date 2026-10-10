# Kotoba

Kotoba is a Japanese vocabulary and kanji learning platform built around chapter-based study, active recall, and progress that stays on the learner’s device. It began as a personal project to support my Japanese language studies and grew into a complete, reusable learning platform.

## Tech stack

- **Next.js App Router** and **React** for server-rendered chapter routes and interactive study sessions
- **TypeScript** for typed application logic and chapter content
- **Tailwind CSS 4** and custom CSS for responsive layouts, theme tokens, and motion
- **Zod** for validating chapter JSON before it reaches the app
- **WanaKana** for Hiragana and Romaji answer normalization
- **GSAP** and **Lenis** for scroll-linked transitions and smooth scrolling
- **Lucide React** for interface icons
- **Playwright** for browser-based checks

## Product highlights

- Chapter-based vocabulary and kanji lessons loaded from validated JSON files
- Flashcards, meaning quizzes, and kanji quizzes with Hiragana or Romaji input
- Paired reading and meaning validation for kanji with multiple readings, such as 一日
- Smart shuffle that prioritizes difficult and due cards
- Local progress tracking with mastery, review scheduling, and JSON backup export/import
- Persistent light and dark themes with a circular reveal transition
- Adjustable interface sound effects and responsive navigation

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```text
chapters/       Validated lesson content, one JSON file per chapter
src/app/        Routes, root layout, and global styling
src/components/ Interactive page and study components
src/lib/        Content loading, schemas, progress, and Japanese text utilities
tests/          Playwright browser checks
```

## Add a chapter

1. Add a numbered file such as `chapters/02.json`.
2. Follow the schema and IDs in `chapters/01.json`; set the chapter `id` to match its filename.
3. Include accepted readings explicitly. Use separate entries for identical spellings with different meanings or readings.
4. Run `pnpm build` to validate chapter content and generated routes.

Invalid JSON, schema violations, duplicate IDs, and mismatched chapter IDs are reported during the build.

## Progress and privacy

Study progress is stored in browser `localStorage`. It is not synchronized between devices or sent to a backend. Use the in-app backup controls to export or restore progress.

## Quality checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The app requires no database, account, secret, or environment variables.
