# Material Icons Inline

Render Google Material Icons in Obsidian using the `!icon[name]` markdown syntax.

## Features

- 2,500+ Google Material Icons available
- Simple markdown syntax: `!icon[home]`
- Customizable icon size and color via plugin settings
- Zero configuration needed (works out of the box)
- Works on desktop and mobile

## Installation

### Manual Installation

1. Clone or download this repository into your vault's plugin folder:

   ```bash
   git clone <repo> ~/.obsidian/plugins/material-icons-obsidian
   cd ~/.obsidian/plugins/material-icons-obsidian
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the plugin:

   ```bash
   npm run build
   ```

4. Reload Obsidian and enable the plugin under **Settings → Community plugins → Material Icons Inline**.

### Development Mode

Watch for changes and rebuild automatically:

```bash
npm run dev
```

## Usage

### Basic Syntax

```markdown
!icon[icon_name]
```

Icon names must be lowercase with underscores — matching the names shown on the Google Material Icons site.

### Examples

```markdown
# My Note

!icon[home] Home
!icon[settings] Settings
!icon[search] Search
!icon[check_circle] Completed
!icon[error] Error
!icon[arrow_forward] Next
!icon[arrow_back] Previous
```

### Finding Icon Names

1. Visit [Google Material Icons](https://fonts.google.com/icons)
2. Search for the icon you want
3. Copy the name shown below the icon (uses underscores, all lowercase)
4. Example: "Check Circle" → `!icon[check_circle]`

## Settings

Access via **Settings → Material Icons Inline**.

### Icon Size

- Default: `24px`
- Accepts any CSS length: `16px`, `1.5em`, `2rem`, `10vw`, etc.
- Invalid values fall back to `24px`

### Icon Color

- Default: `currentColor` (inherits from surrounding text)
- Accepts any CSS color: `red`, `#ff0000`, `rgb(255, 0, 0)`, etc.
- Invalid values fall back to `currentColor`

## Project Structure

```
material-icons-obsidian/
├── main.ts                      # Plugin entry point
├── src/
│   └── parse.ts                 # Pure functions: icon parser, CSS validators
├── __tests__/
│   └── parse.test.ts            # Jest test suite (36 tests)
├── __mocks__/
│   └── obsidian.ts              # Obsidian API stub for tests
├── manifest.json                # Plugin metadata
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── .gitignore
├── .npmrc
└── main.js                      # Compiled output (generated — do not edit)
```

## How It Works

1. **CSS Loading**: On startup, the plugin injects a `<link>` tag pointing to the Material Icons font on Google CDN. The injection is idempotent — reloading the plugin will not add duplicate tags. If the font fails to load (e.g. offline vault), a notice is shown.
2. **Text Processing**: A markdown post-processor uses the DOM `TreeWalker` API to find text nodes containing `!icon[`. Only text nodes with a non-null parent are processed.
3. **Icon Rendering**: Each `!icon[name]` match is replaced with `<i class="material-icons">name</i>` using `DocumentFragment` for efficient batched DOM updates.
4. **Cleanup**: When the plugin is disabled, the injected `<link>` tag is removed from `document.head`.

## Customization

### Change the Syntax

The regex lives in `parseAndCreateIconHTML()` in `main.ts`:

```typescript
// Current: !icon[home]
const iconRegex = /!icon\[([^\]]+)\]/g;

// Alternative: {{icon:home}}
const iconRegex = /{{icon:([^}]+)}}/g;
```

### Change Default Size or Color

Edit `DEFAULT_SETTINGS` in `main.ts`:

```typescript
const DEFAULT_SETTINGS: MaterialIconsSettings = {
    iconSize: '20px',
    iconColor: 'currentColor'
}
```

### Add an Icon Fallback

```typescript
private createIconElement(iconName: string): HTMLElement {
    const icon = document.createElement('i');
    icon.className = 'material-icons';
    icon.textContent = iconName || 'help_outline';  // fallback icon
    // ...
}
```

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

The test suite covers the icon syntax parser and both CSS validators. Tests live in `__tests__/parse.test.ts` and run against the pure functions in `src/parse.ts`.

## Troubleshooting

### Icons not showing

- Confirm the plugin is enabled under Settings → Community plugins
- Check your internet connection — the icon font is loaded from Google CDN
- Open DevTools (`Ctrl+Shift+I`) → Network tab → look for a `fonts.googleapis.com` request with status 200

### Wrong icon appears

- Double-check the icon name at [Google Material Icons](https://fonts.google.com/icons)
- Names must use underscores: `check_circle`, not `check circle`
- Names must be lowercase and contain only letters, numbers, and underscores

### Icons not rendering after settings change

- Settings apply to newly rendered icons; toggle reading view off and on to re-render

## API Reference

### Syntax

```
!icon[material_icon_name]
```

- `material_icon_name`: lowercase, underscores only — e.g. `home`, `arrow_forward`, `check_circle`
- Must match a name from [Google Material Icons](https://fonts.google.com/icons)

### Rendered HTML

```html
<i class="material-icons" style="font-size: 24px; color: currentColor; vertical-align: middle; margin-right: 4px;" title="Icon: home">home</i>
```

## Common Icons

| Syntax | Icon |
|---|---|
| `!icon[home]` | Home |
| `!icon[settings]` | Settings |
| `!icon[search]` | Search |
| `!icon[edit]` | Edit |
| `!icon[delete]` | Delete |
| `!icon[check_circle]` | Done / Completed |
| `!icon[error]` | Error |
| `!icon[warning]` | Warning |
| `!icon[info]` | Information |
| `!icon[favorite]` | Favorite |
| `!icon[bookmark]` | Bookmark |
| `!icon[arrow_forward]` | Next |
| `!icon[arrow_back]` | Previous |

[Browse all 2,500+ icons](https://fonts.google.com/icons)

## License

MIT

## Author

[meiorz](https://github.com/meiorz)

## Contributing

Pull requests and issues welcome.
