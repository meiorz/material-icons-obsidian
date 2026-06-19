# Plugin Architecture

## Overview

Material Icons Inline is a lightweight Obsidian markdown post-processor that renders Google Material Icons using the custom `!icon[name]` syntax. It supports both **Live Preview** (CodeMirror 6 editor) and **reading view** (markdown post-processor), with cursor-reveal behavior in the editor matching Obsidian's image embeds.

The plugin is ~200 lines of TypeScript across two source files.

---

## Module Layout

```
main.ts          Plugin lifecycle, CM6 editor extension, DOM post-processor, settings UI
src/parse.ts     Pure functions: icon syntax parser, CSS validators (no DOM, no Obsidian)
```

`src/parse.ts` has no dependencies on Obsidian or the DOM. Every function in it is unit-testable in isolation.

---

## Lifecycle

### Startup (`onload`)

```
Load settings from disk
  ↓
Inject Material Icons <link> into document.head
  (no-op if already present; shows Notice on CDN failure)
  ↓
Register markdown post-processor     ← reading view
  ↓
Register CM6 editor extension        ← live preview
  ↓
Register settings tab
```

### Shutdown (`onunload`)

```
Remove the injected <link> tag from document.head
```

The injection and removal are symmetric — enabling then disabling the plugin leaves `document.head` in its original state.

---

## Key Components

### `MaterialIconsPlugin` (`main.ts`)

Extends Obsidian's `Plugin` class.

| Method | Responsibility |
|---|---|
| `onload()` | Initialise: load settings, inject CSS, register post-processor, editor extension, settings tab |
| `onunload()` | Remove injected font `<link>` by element ID |
| `addMaterialIconsCSS()` | Idempotent CDN injection with error handling |
| `buildEditorExtension()` | Returns CM6 `ViewPlugin` for live preview rendering |
| `processIcons(el)` | TreeWalker traversal for reading view; collects and replaces text nodes |
| `parseAndCreateIconHTML(text)` | Regex parse → `DocumentFragment` of text nodes and icon elements |
| `createIconElement(name)` | Build a single `<i class="material-icons">` element |
| `loadSettings()` / `saveSettings()` | Obsidian `loadData` / `saveData` wrappers |

### `IconWidget` (`main.ts`)

Extends CM6's `WidgetType`. Renders a single icon in the editor as a replacement decoration.

| Method | Responsibility |
|---|---|
| `toDOM()` | Creates and returns the `<i class="material-icons">` element |
| `eq(other)` | Returns true if icon name and settings are identical — prevents unnecessary DOM re-creation |

### `buildDecorations(view, settings)` (`main.ts`)

Pure function called on every editor update. Scans visible ranges for `!icon[name]` matches and builds a `DecorationSet` of `Decoration.replace` widgets, skipping any range that overlaps the current cursor selection (which reveals the raw syntax instead).

### `MaterialIconsSettingTab` (`main.ts`)

Extends Obsidian's `PluginSettingTab`. Renders the settings panel using `containerEl.createEl()` throughout — no `innerHTML` usage.

### `src/parse.ts`

Pure functions with no side effects. Imported by `main.ts` and tested directly by Jest.

| Export | Description |
|---|---|
| `parseIconSyntax(text)` | Splits a string into `{ type: 'text' \| 'icon', value: string }[]` segments |
| `isValidCssSize(value)` | Returns true for values like `24px`, `1.5em`, `2rem`, `100%` |
| `isValidCssColor(value)` | Returns true for hex, rgb/rgba/hsl, named colors, `currentColor` |

---

## Live Preview Pipeline (Editor)

```
User types or moves cursor
  ↓
CM6 ViewPlugin.update() fires
  (triggers on: docChanged, viewportChanged, selectionSet)
  ↓
buildDecorations() scans visible ranges with /!icon\[([a-z0-9_]+)\]/g
  ↓
For each match:
  cursor overlaps range? → skip (raw syntax visible)
  cursor elsewhere?      → Decoration.replace({ widget: IconWidget })
  ↓
DecorationSet applied to editor view
  ↓
IconWidget.toDOM() called for each new decoration
  → returns <i class="material-icons">name</i>
```

### Cursor-Reveal Detail

```
Editor line:   Click !icon[home] to go home
                           ↑
               cursor here → raw text "!icon[home]" shown
               cursor elsewhere → [home icon] rendered
```

This matches Obsidian's native behavior for `![[embeds]]` and `![images]()`.

---

## Reading View Pipeline (Post-Processor)

```
Obsidian renders markdown block to HTML
  ↓
registerMarkdownPostProcessor callback fires
  ↓
TreeWalker visits only text nodes (skips element nodes)
  ↓
Collect text nodes where nodeValue includes '!icon[' AND parentNode is non-null
  ↓
For each collected node:
  parseAndCreateIconHTML() → DocumentFragment
  parent.replaceChild(fragment, node)   ← one DOM mutation per text node
```

The collect-then-replace pattern avoids corrupting the TreeWalker by mutating the tree during traversal.

---

## Data Flow Example

```
User types:   "Click !icon[home] to go home"

── Live Preview ──────────────────────────────────────────────
CM6 scans visible text, finds match at offset 6–18
Cursor not in range → applies Decoration.replace
Editor shows:  "Click [home icon] to go home"

User clicks on icon:
Cursor now at offset 12 (inside !icon[home])
buildDecorations skips this range
Editor shows:  "Click !icon[home] to go home"  ← raw text

User clicks away:
Cursor at offset 0
Decoration re-applied
Editor shows:  "Click [home icon] to go home"

── Reading View ──────────────────────────────────────────────
Obsidian renders: <p>Click !icon[home] to go home</p>
TreeWalker finds text node "Click !icon[home] to go home"
Regex extracts "home"
Fragment: [TextNode("Click "), <i>home</i>, TextNode(" to go home")]
replaceChild() swaps node for fragment
Final DOM: <p>Click <i class="material-icons">home</i> to go home</p>
```

---

## CDN Font Loading

```typescript
private addMaterialIconsCSS() {
    if (document.getElementById(this.FONT_LINK_ID)) return;  // idempotent

    const link = document.createElement('link');
    link.id = this.FONT_LINK_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
    link.addEventListener('error', () => {
        new Notice('Material Icons: failed to load icon font...', 8000);
    });
    document.head.appendChild(link);
}
```

The `id` attribute prevents duplicate injection across hot-reloads. The `error` listener surfaces CDN failures via Obsidian's `Notice` API.

---

## Settings

| Key | Default | Validation |
|---|---|---|
| `iconSize` | `"24px"` | `isValidCssSize()` — must match `\d+(\.\d+)?(px\|em\|rem\|%\|vw\|vh\|pt)` |
| `iconColor` | `"currentColor"` | `isValidCssColor()` — hex, rgb/rgba/hsl, named colors, or `currentColor` |

Invalid input silently falls back to the default. Settings are stored in `.obsidian/plugins/material-icons-inline/data.json`.

---

## Performance

- **CM6 ViewPlugin** re-runs only on `docChanged`, `viewportChanged`, or `selectionSet` — not on every keystroke that doesn't affect icons.
- **visibleRanges** scanning means only the text currently on screen is processed, not the entire document.
- **`eq()` on IconWidget** prevents CM6 from recreating DOM elements when the decoration hasn't changed.
- **TreeWalker** in the post-processor visits only text nodes — element subtrees are skipped automatically.
- **Collect-then-replace** in the post-processor avoids walker invalidation from mid-traversal mutations.
- **DocumentFragment** batches all replacements for a given text node into one DOM operation.

---

## Testing

Tests live in `__tests__/parse.test.ts` and target `src/parse.ts` exclusively. The Obsidian module is stubbed via `__mocks__/obsidian.ts`. The CM6 editor extension is not unit-tested (it requires a live CM6 instance) — it is covered by manual testing in Obsidian.

```bash
npm test              # 36 tests across 3 describe blocks
npm run test:coverage # coverage report for src/parse.ts
```

| Describe block | What is covered |
|---|---|
| `parseIconSyntax` | Single icon, multiple icons, surrounding text, empty input, whitespace trimming, invalid names, empty brackets, adjacent icons, underscore names |
| `isValidCssSize` | Valid units (px, em, rem, %, vw, vh, pt), rejection of negative values, injection strings, unitless values |
| `isValidCssColor` | Hex (3/6/8 digit), rgb/rgba/hsl, named colors, `currentColor`, rejection of JS injection strings |

---

## Extensibility

### Change icon syntax

Edit the regex in both `buildDecorations()` (live preview) and `parseAndCreateIconHTML()` (reading view) in `main.ts`, then update the tests in `__tests__/parse.test.ts`.

### Add custom icon styling

Extend `IconWidget.toDOM()` and `createIconElement()` in `main.ts`:

```typescript
icon.setAttribute('data-icon', iconName);
icon.classList.add('my-custom-class');
```

### Add more settings

1. Add the key to `MaterialIconsSettings` and `DEFAULT_SETTINGS`
2. Add a `new Setting(...)` block in `MaterialIconsSettingTab.display()`
3. Pass the new setting into `buildDecorations()` and/or `createIconElement()`
4. Add a validator in `src/parse.ts` with a corresponding test

### Support offline / self-hosted fonts

Replace the CDN `<link>` in `addMaterialIconsCSS()` with a bundled `styles.css` registered via `this.addStyle(...)`.

---

## Dependencies

| Package | Role |
|---|---|
| `obsidian` | Plugin API (dev only — excluded from bundle) |
| `@codemirror/view` | CM6 `ViewPlugin`, `Decoration`, `WidgetType` types (dev only — provided by Obsidian at runtime) |
| `@codemirror/state` | CM6 `RangeSetBuilder` types (dev only — provided by Obsidian at runtime) |
| `typescript` | Type checking and compilation |
| `esbuild` | Bundling to CommonJS for Obsidian |
| `jest` + `ts-jest` | Test runner |
| `jest-environment-jsdom` | DOM API in test environment |
| Google Fonts CDN | Material Icons font at runtime |

---

## Known Limitations

1. **Source mode** — CM6 decorations do not apply in Source mode, only in Live Preview. Icons still render in reading view.
2. **Online dependency** — requires internet access to load the icon font. An offline vault shows a Notice but icons render as placeholder squares.
3. **Icon name typos** — invalid names silently render as blank squares (the Material Icons font's placeholder glyph). There is no warning for unrecognised names.
4. **No escape syntax** — there is no way to display the literal text `!icon[home]` in a rendered note.

---

## Future Enhancements

- [ ] Source mode support via a CM6 `syntaxHighlighting` extension
- [ ] Icon name lookup against a known-good list to surface typos as warnings
- [ ] Escape syntax: `\!icon[home]` renders as literal text
- [ ] Offline / self-hosted font support via bundled `styles.css`
- [ ] Additional icon libraries (Bootstrap Icons, Lucide, etc.)
- [ ] Icon picker in settings preview
