# Plugin Architecture

## Overview

The Material Icons Plugin is a lightweight Obsidian markdown post-processor that renders Google Material Icons using the custom `!icon[name]` syntax. It is ~160 lines of TypeScript across two source files.

---

## Module Layout

```
main.ts          Plugin lifecycle, DOM processing, settings UI
src/parse.ts     Pure functions: icon syntax parser, CSS validators
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
Register markdown post-processor
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
| `onload()` | Initialise: load settings, inject CSS, register post-processor and settings tab |
| `onunload()` | Remove injected font `<link>` by element ID |
| `addMaterialIconsCSS()` | Idempotent CDN injection with error handling |
| `processIcons(el)` | TreeWalker traversal; collects text nodes matching `!icon[` |
| `parseAndCreateIconHTML(text)` | Regex parse → DocumentFragment of text nodes and icon elements |
| `createIconElement(name)` | Build a single `<i class="material-icons">` element |
| `loadSettings()` / `saveSettings()` | Obsidian `loadData` / `saveData` wrappers |

### `MaterialIconsSettingTab` (`main.ts`)

Extends Obsidian's `PluginSettingTab` class. Renders the settings panel using `containerEl.createEl()` throughout — no `innerHTML` usage.

### `src/parse.ts`

Pure functions with no side effects. Imported by `main.ts` and tested directly by Jest.

| Export | Description |
|---|---|
| `parseIconSyntax(text)` | Splits a string into `{ type: 'text' \| 'icon', value: string }[]` segments |
| `isValidCssSize(value)` | Returns true for values like `24px`, `1.5em`, `2rem`, `100%` |
| `isValidCssColor(value)` | Returns true for hex, rgb/rgba/hsl, named colors, `currentColor` |

---

## Processing Pipeline

### 1. Post-processor entry

```typescript
registerMarkdownPostProcessor((el: HTMLElement, ctx) => {
    this.processIcons(el);
});
```

Obsidian calls this after each markdown block renders to HTML.

### 2. Text node traversal

```typescript
const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);

while (currentNode = walker.nextNode()) {
    if (currentNode.nodeValue?.includes('!icon[') && currentNode.parentNode) {
        nodesToReplace.push({ node: currentNode, parent: currentNode.parentNode });
    }
}
```

`TreeWalker` visits only text nodes (skips element nodes). The `parentNode` guard ensures detached nodes are silently skipped rather than throwing.

Nodes are collected first, then replaced — mutating the tree during traversal would corrupt the walker.

### 3. Fragment construction

```typescript
const iconRegex = /!icon\[([^\]]+)\]/g;

// For "Hello !icon[home] world":
// → TextNode("Hello ")
// → <i class="material-icons">home</i>
// → TextNode(" world")
```

Each text node is parsed into a `DocumentFragment`. The fragment replaces the original text node with a single `parent.replaceChild()` call — one DOM mutation per text node regardless of how many icons it contains.

### 4. Icon element

```html
<i class="material-icons"
   style="font-size: 24px; color: currentColor; vertical-align: middle; margin-right: 4px;"
   title="Icon: home">home</i>
```

The Material Icons font maps the text content (`home`) to the corresponding glyph via CSS ligatures.

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

The `id` attribute prevents duplicate injection across hot-reloads. The `error` listener surfaces CDN failures to the user via Obsidian's built-in `Notice` API.

---

## Settings

| Key | Default | Validation |
|---|---|---|
| `iconSize` | `"24px"` | `isValidCssSize()` — must match `\d+(\.\d+)?(px\|em\|rem\|%\|vw\|vh\|pt)` |
| `iconColor` | `"currentColor"` | `isValidCssColor()` — hex, rgb/rgba/hsl, named colors, or `currentColor` |

Invalid settings input silently falls back to the default rather than persisting bad values. Settings are stored by Obsidian in `.obsidian/plugins/material-icons-obsidian/data.json`.

---

## Data Flow Example

```
User types:   "Click !icon[home] to go home"
                             ↓
Obsidian renders:   <p>Click !icon[home] to go home</p>
                             ↓
Post-processor runs:
  TreeWalker finds text node "Click !icon[home] to go home"
  Regex extracts "home"
  Fragment built: [TextNode("Click "), <i>home</i>, TextNode(" to go home")]
  replaceChild() swaps original text node for fragment
                             ↓
Final DOM:    <p>Click <i class="material-icons">home</i> to go home</p>
                             ↓
Rendered:     "Click [home icon] to go home"
```

---

## Performance

- **TreeWalker** visits only text nodes — element subtrees are skipped automatically.
- **Collect-then-replace** pattern avoids walker invalidation from mid-traversal mutations.
- **DocumentFragment** batches all replacements for a given text node into one DOM operation.
- The regex is recreated per `parseAndCreateIconHTML` call. For notes with extremely high icon density (hundreds per render), caching it as a class field and resetting `lastIndex` before each use would reduce allocation pressure.

---

## Testing

Tests live in `__tests__/parse.test.ts` and target `src/parse.ts` exclusively. The Obsidian module is stubbed via `__mocks__/obsidian.ts`.

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

Edit the regex in `parseAndCreateIconHTML()` in `main.ts` and update the tests in `__tests__/parse.test.ts` to match.

### Add custom icon styling

Extend `createIconElement()` in `main.ts`:

```typescript
icon.setAttribute('data-icon', iconName);
icon.classList.add('my-custom-class');
```

### Add more settings

1. Add the key to the `MaterialIconsSettings` interface and `DEFAULT_SETTINGS`
2. Add a `new Setting(...)` block in `MaterialIconsSettingTab.display()`
3. Add a validator function to `src/parse.ts` and a test for it

### Support offline / self-hosted fonts

Replace the CDN `<link>` in `addMaterialIconsCSS()` with a bundled `styles.css` registered via `this.addStyle(...)`.

---

## Dependencies

| Package | Role |
|---|---|
| `obsidian` | Plugin API (dev only — excluded from bundle) |
| `typescript` | Type checking and compilation |
| `esbuild` | Bundling to CommonJS for Obsidian |
| `jest` + `ts-jest` | Test runner |
| `jest-environment-jsdom` | DOM API in test environment |
| Google Fonts CDN | Material Icons font at runtime |

---

## Known Limitations

1. **Online dependency** — requires internet access to load the icon font from Google CDN. An offline vault shows a Notice but icons will not render.
2. **Icon name validation** — names are validated as `[a-z0-9_]+`. Typos silently render as broken glyphs (the font shows a square placeholder).
3. **No escape syntax** — there is no way to display the literal text `!icon[home]` in a rendered note.
4. **Re-render required** — changing icon size or color in settings does not update already-rendered icons; toggle reading view to re-render.

---

## Future Enhancements

- [ ] Offline / self-hosted font support via bundled `styles.css`
- [ ] Icon name lookup against a known-good list to surface typos as warnings
- [ ] Escape syntax: `\!icon[home]` renders as literal text
- [ ] Regex cached as a class field to reduce per-render allocation
- [ ] Additional icon libraries (Bootstrap Icons, Lucide, etc.)
- [ ] Icon picker in settings preview
