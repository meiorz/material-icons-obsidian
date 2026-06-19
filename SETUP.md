# Setup Guide

## Prerequisites

- [Node.js](https://nodejs.org/) v16 or higher
- [Obsidian](https://obsidian.md/) installed
- A text editor (VS Code recommended)

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone <repo> material-icons-obsidian
cd material-icons-obsidian
```

### 2. Install Dependencies

```bash
npm install
```

> If you see peer dependency warnings, they are from Jest's internal tooling and do not affect the plugin. Do not run `npm audit fix --force` — it will downgrade Jest and break the test suite.

### 3. Build the Plugin

```bash
npm run build
```

A successful build produces `main.js` with no TypeScript errors. The TypeScript check runs first (`tsc --noEmit`), then esbuild bundles the output.

### 4. Install into Obsidian

**Option A: Manual copy**

```bash
cp main.js manifest.json ~/.obsidian/plugins/material-icons-obsidian/
```

**Option B: Symlink for active development**

```bash
ln -s $(pwd) ~/.obsidian/plugins/material-icons-obsidian
```

Replace `~/.obsidian/` with your vault's `.obsidian` folder path if it differs.

### 5. Enable the Plugin

1. Open Obsidian
2. Go to **Settings → Community plugins**
3. Find **Material Icons Inline** and toggle it on

### 6. Test the Plugin

Create a new note and type:

```
!icon[home] !icon[settings] !icon[search]
```

Switch to reading view — you should see three rendered Material Icons.

---

## Development Workflow

### Watch Mode

```bash
npm run dev
```

This rebuilds `main.js` on every file save. Reload the vault with `Ctrl+R` (or `Cmd+R`) to pick up changes without restarting Obsidian.

### File Structure

```
material-icons-obsidian/
├── main.ts                  ← Plugin entry point — edit this
├── src/
│   └── parse.ts             ← Pure functions: icon parser, CSS validators
├── __tests__/
│   └── parse.test.ts        ← Jest test suite
├── __mocks__/
│   └── obsidian.ts          ← Obsidian API stub for tests
├── main.js                  ← Compiled output (auto-generated — do not edit)
├── manifest.json            ← Plugin metadata
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── .gitignore
└── .npmrc
```

### Typical Edit Cycle

1. `npm run dev` — start watch mode
2. Edit `main.ts` or `src/parse.ts`
3. Save — `main.js` rebuilds automatically
4. `Ctrl+R` in Obsidian to reload
5. Verify in a note

---

## Running Tests

```bash
npm test              # single run
npm run test:watch    # re-run on file changes
npm run test:coverage # coverage report
```

The test suite runs against the pure functions in `src/parse.ts`. It uses Jest with `ts-jest` and `jest-environment-jsdom` — no Obsidian installation required.

All 36 tests should pass. If any fail after editing the parser or validators, do not merge.

---

## Customization

### Change Icon Syntax

Edit `parseAndCreateIconHTML()` in `main.ts`:

```typescript
// Current: !icon[home]
const iconRegex = /!icon\[([^\]]+)\]/g;

// Alternative: {{home}}
const iconRegex = /{{([^}]+)}}/g;

// Alternative: [icon:home]
const iconRegex = /\[icon:([^\]]+)\]/g;
```

If you change the syntax, update the tests in `__tests__/parse.test.ts` to match.

### Change Default Size or Color

Edit `DEFAULT_SETTINGS` in `main.ts`:

```typescript
const DEFAULT_SETTINGS: MaterialIconsSettings = {
    iconSize: '20px',
    iconColor: 'currentColor'
}
```

---

## Troubleshooting

### Plugin doesn't load

1. Verify `manifest.json` and `main.js` are both in the plugin folder
2. Open DevTools (`Ctrl+Shift+I`) → Console tab and look for red errors

### Icons not rendering

1. Reload the vault: `Ctrl+R`
2. Check syntax: `!icon[home]` — square brackets, lowercase name, no spaces
3. Check internet connection — the icon font loads from Google CDN
4. Open DevTools → Network tab, search for `fonts.googleapis.com` — it should return status 200

### Settings not taking effect

- Invalid CSS values (e.g. `auto` for size, or an empty string for color) silently fall back to the default. Enter a valid CSS value such as `20px` or `red`.
- Settings apply to newly rendered icons. Toggle reading view to force a re-render.

### Build fails with TypeScript errors

- Run `npx tsc --noEmit --skipLibCheck` to see the full error list
- All null checks are enforced via `strictNullChecks: true` in `tsconfig.json`

---

## Distribution Checklist

- [ ] Bump version in `manifest.json` and `package.json` (must match)
- [ ] `npm run build` completes with no errors
- [ ] `npm test` — all 36 tests pass
- [ ] Manual smoke test: install in Obsidian, render `!icon[home]`, confirm icon appears
- [ ] Create GitHub release and attach `main.js` and `manifest.json`

---

## Resources

- [Obsidian Plugin Development Docs](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Google Material Icons](https://fonts.google.com/icons)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
