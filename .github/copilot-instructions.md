# Copilot Instructions

## Architecture

Client-only Next.js 16 app (React 19, TypeScript strict). **No server actions, API routes, or SSR.** Next.js is used as bundler/static host only.

Three independent editing modes orchestrated by `src/app/page.tsx` via a `Phase` union:
- **Split** — `Uploader` → `Toolbar` + `SidebarThumbnails` + `SectionPreview` + `SectionList`
- **Merge** — fully self-contained `MergeEditor`
- **Annotate** — `Uploader` (mode="annotate") → fully self-contained `AnnotationEditor`

`MergeEditor` and `AnnotationEditor` own their internal state; they only surface an `onBack` callback. All global split state lives in `page.tsx`.

## PDF Libraries

| Library | Role |
|---|---|
| `pdfjs-dist` v5 | Render pages to canvas / data URLs. Worker served from `public/pdf.worker.min.mjs`. |
| `pdf-lib` | Read/write PDF bytes (split, merge). Always pass `{ ignoreEncryption: true }`. |
| `jszip` | Build ZIP for multi-section split downloads. |

**All heavy imports are dynamic** inside event handlers/callbacks to keep the initial bundle lean:
```ts
const { loadPdfDocument, renderPageToDataUrl } = await import("@/lib/pdf-renderer");
```
Never import these at the top level of a component.

`canvas` npm package is aliased to `false` in `next.config.ts` — do not remove this.

## Code Style

- Every component file starts with `"use client";` except `src/app/layout.tsx` (server component).
- Named exports only; props typed with inline interfaces at the top of the file.
- Consumers use custom hooks (`useI18n()`, `useTheme()`) — never call `useContext` directly.
- Use `cn()` from `@/lib/utils` for className merging. Use `cva` for variant-heavy components.
- Path alias `@/*` → `src/*` everywhere.

## i18n

Add every user-visible string to both `src/i18n/en.ts` and `src/i18n/es.ts`.  
`Translations = typeof en` — TypeScript enforces that `es` matches the shape structurally.  
Function-valued keys are allowed: `pageOf: (cur: number, total: number) => \`Page ${cur} of ${total}\``.

In components:
```tsx
const { t } = useI18n();
// use t.section.key or t.section.fn(arg)
```

## Theme / Dark Mode

Dark mode is class-based (`.dark` on `<html>`). A **blocking inline script** in `layout.tsx` applies the class before first paint to prevent FOUC — do not move or remove it.

In `globals.css`, the dark variant is declared as:
```css
@variant dark (&:where(.dark, .dark *));
```
The zinc scale and white are remapped inside `.dark` via `--color-*` CSS custom properties. This means adding `dark:` prefixes to components is usually **not needed** — the palette adapts automatically.

## Tailwind v4 Specifics

- No `tailwind.config.js` — config lives in `globals.css` (`@import "tailwindcss"`, `@theme inline {}`).
- Use `aspect-3/4` not `aspect-[3/4]`; use `right-18` not `right-[4.5rem]` where standard scale values exist.
- Avoid arbitrary values when a scale value covers the need.

## Build & Dev

```bash
npm run dev      # Next.js dev server with Turbopack
npm run build    # Production build (webpack, applies canvas alias)
npm run lint     # ESLint 9 over entire project
```

`ignoreBuildErrors: true` is set in `next.config.ts` — type errors in pdfjs interaction code are tolerated.

## Project Conventions

- **Progressive skeleton rendering**: pre-allocate a `string[]` of blanks equal to `doc.numPages`, set thumbnails immediately, then fill slots one by one as pages render. Keeps the sidebar responsive on large PDFs.
- **Floating UI in layout**: `DonateButton`, `LanguageSelector`, `ThemeToggle`, and `MobileWarning` are rendered in `layout.tsx`, not in page components, so they appear on every screen.
- `pdf.worker.min.mjs` must stay in `public/` — pdfjs requires its worker served as a static URL.
