# Accessibility

The workbench is a GUI (browser SPA). We follow [WCAG 2.0](https://www.w3.org/TR/WCAG20/) practices where they reasonably apply.

## What we do

- **Language:** `html lang="en"` is set in `nuxt.config.ts`.
- **Skip link:** “Skip to content” in `app/layouts/default.vue` moves keyboard focus to `#main-content`.
- **Keyboard:** Primary navigation, menus, and form controls are native buttons/links or `UiButton` — they are keyboard reachable. The mobile nav is a dialog (`role="dialog"`, `aria-modal`, labelled open/close buttons).
- **Name, role, value:** Icon-only controls have `aria-label`. Charts that are not text expose `role="img"` and an `aria-label` (see `LatencyTimeline.vue`).
- **Text alternatives:** README screenshots include Markdown alt text.
- **Color:** Status is not conveyed by color alone on Compare assertions (PASS/FAIL badges include text). Theme tokens in `app/assets/css/main.css` keep body text (`foreground` ~ oklch 0.95) on `background` (~ oklch 0.14) well above 4.5:1. Muted labels use `muted-foreground` (~ 0.65) on the same background.
- **Internationalization:** User-facing chrome strings live in `app/i18n/en.ts` via `useI18n()`. New UI copy should go in that catalog so a future locale file can localize without rewriting components.

## How to try the skip link

1. Click anywhere on the page background first so the browser window has focus.
2. Press `Tab` once — the “Skip to content” link appears at the top-left.
3. Press `Enter` — focus jumps to `#main-content` and the main content is scrolled into view.
4. Press `Tab` again to continue into the main content without going through the navigation.

## What we do not claim

- Full WCAG 2.2 AAA conformance.
- A dedicated screen-reader QA lab on every PR. Manual checks use keyboard navigation and, periodically, a platform screen reader (NVDA, VoiceOver, or Narrator) on Compare / Settings.

## Reporting issues

Accessibility bugs are welcome as GitHub issues using the bug report form. Security-impacting issues still follow [SECURITY.md](../SECURITY.md).
