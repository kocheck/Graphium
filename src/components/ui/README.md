# UI primitives

Shared shadcn/Radix primitives for Graphium. Feature screens consume these; they never live here.

## What lives here

Primitives only: CLI-generated, Radix-based components in this directory (`button`, `dialog`,
`sheet`, `popover`, `dropdown-menu`, `tooltip`, `input`, `label`, `select`, `slider`, `switch`,
`tabs`, `collapsible`, `separator`). Feature components (`TokenCard`, dialogs that own app
state, adapters such as `ConfirmDialog.tsx`) do not.

## Colour rule

Use bridge tokens (`bg-primary`, `text-foreground`, `border-input`, …) or `[var(--app-*)]`
arbitrary values. Never a raw Tailwind palette class or a literal colour. Enforced by
`purity.test.ts`:

```
/\b(bg|text|border|ring)-(white|black|slate|gray|zinc|neutral|blue|red|green|amber|orange)(-[0-9]{2,3})?\b/g
/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\boklch\(/g
```

## Imports rule

A primitive may import only `react`, `@radix-ui/*`, `class-variance-authority`, `lucide-react`,
`@remixicon/react`, `./siblings`, and `@/lib/utils`. Enforced by the `no-restricted-imports`
override in `.eslintrc.cjs` (blocks `../*`, `@/store/*`, `@/components/*`, and the other
feature aliases).

## Add a primitive

1. `npx shadcn@4.21.0 add <name> -y` → exit 0, `src/components/ui/<name>.tsx` exists.
2. `npm run format` → exit 0.
3. If it renders an overlay `Content`: add the `ownsEscape` prop (three edits, as in
   `dialog.tsx`; `grep -n 'ownsEscape' src/components/ui/dialog.tsx`).
4. Register it: add an entry with `id: 'ui-<name>'` to the matching
   `src/components/DesignSystemPlayground/registry/*.tsx`; if it needs a new category, add it
   to `types.ts` **and** the `categories` array in `registry/index.ts`.
5. Add it to the `cases` arrays in `a11y.test.tsx` (open state) and, if it owns Escape, in
   `esc-owns.test.tsx`.
6. `npm run verify:static && npm run verify:web` → exit 0 (`registry.test.ts` fails until 4
   is done; `purity.test.ts` fails on any palette class).

## Add a Graphium variant

Add a CVA variant (and compound variants when the look depends on more than one axis) on the
generated primitive. Do not invent a wrapper component. Worked example: `button.tsx`
`tool` / `mode` / `broadcast` plus `active` and `state`:

```ts
compoundVariants: [
  {
    variant: ['tool', 'mode'],
    active: true,
    class:
      'bg-primary text-primary-foreground border-primary hover:bg-[var(--app-accent-solid-hover)] hover:border-[var(--app-accent-solid-hover)]',
  },
  {
    variant: 'broadcast',
    active: true,
    class:
      'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] hover:bg-[var(--app-success-solid-hover)]',
  },
  {
    variant: 'tool',
    state: 'paused',
    class:
      'bg-destructive text-[var(--app-error-solid-text)] border-destructive hover:bg-[var(--app-error-solid-hover)] hover:border-[var(--app-error-solid-hover)]',
  },
  {
    variant: 'tool',
    state: 'running',
    class:
      'bg-[var(--app-success-solid)] text-[var(--app-success-solid-text)] border-[var(--app-success-solid)] hover:bg-[var(--app-success-solid-hover)] hover:border-[var(--app-success-solid-hover)]',
  },
],
```

## Button class mapping (plan 004)

| Existing class                                                                | Primitive props       |
| ----------------------------------------------------------------------------- | --------------------- |
| `.btn-primary`                                                                | `variant="default"`   |
| `.btn-default`                                                                | `variant="secondary"` |
| `.btn-secondary` / `.btn-ghost` / `.btn-destructive` (undefined in `app.css`) | `variant="ghost"`     |
| `.btn-tool`                                                                   | `variant="tool"`      |
| `.btn-mode`                                                                   | `variant="mode"`      |
| `.btn-broadcast`                                                              | `variant="broadcast"` |
| `.active`                                                                     | `active`              |
| `.is-paused` / `.is-running`                                                  | `state`               |

## ESLint rules relaxed here

The last `overrides` entry in `.eslintrc.cjs` applies to `src/components/ui/**/*.tsx` and
`src/lib/utils.ts`:

- `import/no-unused-modules` — CLI files export unused pieces (compound helpers) the first
  consumer has not imported yet.
- `prettier/prettier` — generated wrapping does not always match repo Prettier; `npm run
format` is the source of truth after add.
- `react-refresh/only-export-components` — files export both a component and `*Variants`.
- `@typescript-eslint/explicit-function-return-type` — generated signatures omit them.
- `no-restricted-imports` — **on**, not off: primitives cannot import feature code.

## Decisions

- **Toast:** keep `src/components/Toast.tsx`; do not add `sonner`. `gameStore` models one toast
  on a 5 s timer (`grep -n '5000' src/components/Toast.tsx`). sonner stacks and owns timers.
  `Toast` is mounted twice, in `App.tsx` and `DesignSystemPlayground.tsx`.
- **`command`:** out of scope for the program.
- **`scroll-area`:** deferred; no consumer until plan 004 needs one.

## dark: utilities

`dark:` keys off `[data-theme='dark']` via `@custom-variant dark` in `src/index.css`. Portals
stay inside `<html>` so theme scope is never escaped. Proven by
`tests/functional/primitives-portals.spec.ts`.

## Bundle

_Filled by plan 003 Step 10._
