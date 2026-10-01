# Figma → Tailwind Token Sync Pipeline

## How it works

```
Figma Variables
     │
     │  Token Studio plugin (export)
     ▼
tokens/
  ├── global.json   ← spacing, typography, border-radius
  ├── light.json    ← light mode colors
  └── dark.json     ← dark mode colors
     │
     │  Style Dictionary (scripts/sync-tokens/)
     ▼
frontend/src/styles/
  ├── tokens.light.css     ← :root { --color-* }
  ├── tokens.dark.css      ← .dark { --color-* }
  └── tailwind-tokens.js   ← Tailwind theme extension
     │
     │  GitHub Actions (on push to tokens/**)
     ▼
Auto PR → main
```

## First-time setup

### 1. Install Token Studio in Figma
1. Open your Figma file → **Plugins** → search **Tokens Studio for Figma** → install
2. In Token Studio, create three token sets: `global`, `light`, `dark`
3. Map your Figma Variables to token sets

### 2. Configure Token Studio sync to GitHub
1. In Token Studio → **Settings** → **Sync** → choose **GitHub**
2. Set:
   - **Repository:** `your-org/smartvault-agri-wms-design-system`
   - **Branch:** `main`
   - **File path:** `tokens/`
3. Generate a GitHub PAT with `repo` scope and paste it in Token Studio

### 3. Local development
```bash
cd scripts/sync-tokens
npm install
npm run build        # one-shot build
npm run watch        # rebuild on tokens/** changes
```

### 4. GitHub Actions
The workflow triggers automatically when any file under `tokens/` is pushed.
It opens a PR with the generated CSS and Tailwind files for review.

No secrets needed beyond the default `GITHUB_TOKEN`.

## Token naming convention

Token Studio keys map directly to CSS variable names via kebab-case:

| Token Studio key         | CSS variable                  | Tailwind class         |
|--------------------------|-------------------------------|------------------------|
| `color.primary`          | `--color-primary`             | `bg-primary`           |
| `color.muted-foreground` | `--color-muted-foreground`    | `text-muted-foreground`|
| `spacing.4`              | `--spacing-4`                 | `p-4`, `m-4`           |
| `border.radius.lg`       | `--border-radius-lg`          | `rounded-lg`           |

## Adding new token categories

1. Add tokens to the appropriate `tokens/*.json` file
2. Update `sd.config.js` formatter to handle the new category
3. Update `tailwind-tokens.js` placeholder with the new keys
4. Push → pipeline auto-runs
