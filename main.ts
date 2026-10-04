import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { parseIconSyntax, isValidCssSize, isValidCssColor } from './src/parse';

interface MaterialIconsSettings {
	iconSize: string;
	iconColor: string;
}

const DEFAULT_SETTINGS: MaterialIconsSettings = {
	iconSize: '24px',
	iconColor: 'currentColor'
}

// Font, layout and default styling live in styles.css; only the user-configurable
// size and color are passed in as CSS variables.
function createIconElement(iconName: string, settings: MaterialIconsSettings): HTMLElement {
	const icon = createEl('i', {
		cls: 'material-icons-inline',
		text: iconName,
		attr: { title: `Icon: ${iconName}` },
	});
	icon.setCssProps({
		'--material-icons-inline-size': settings.iconSize,
		'--material-icons-inline-color': settings.iconColor,
	});
	return icon;
}

class IconWidget extends WidgetType {
	constructor(readonly iconName: string, readonly settings: MaterialIconsSettings) {
		super();
	}

	toDOM(): HTMLElement {
		return createIconElement(this.iconName, this.settings);
	}

	eq(other: IconWidget): boolean {
		return other.iconName === this.iconName &&
			other.settings.iconSize === this.settings.iconSize &&
			other.settings.iconColor === this.settings.iconColor;
	}
}

function buildDecorations(view: EditorView, settings: MaterialIconsSettings): DecorationSet {
	const builder = new RangeSetBuilder<Decoration>();
	const iconRegex = /!icon\[([a-z0-9_]+)\]/g;
	const selection = view.state.selection;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);
		iconRegex.lastIndex = 0;
		let match = iconRegex.exec(text);

		for (; match !== null; match = iconRegex.exec(text)) {
			const start = from + match.index;
			const end = start + match[0].length;

			const cursorInside = selection.ranges.some(r => r.from <= end && r.to >= start);
			if (cursorInside) continue;

			builder.add(start, end, Decoration.replace({
				widget: new IconWidget(match[1], settings),
			}));
		}
	}

	return builder.finish();
}

export default class MaterialIconsPlugin extends Plugin {
	settings: MaterialIconsSettings;

	async onload() {
		await this.loadSettings();

		this.registerMarkdownPostProcessor((el: HTMLElement) => {
			this.processIcons(el);
		});

		this.registerEditorExtension(this.buildEditorExtension());

		this.addSettingTab(new MaterialIconsSettingTab(this.app, this));
	}

	private buildEditorExtension() {
		const getSettings = () => this.settings;
		return ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;

				constructor(view: EditorView) {
					this.decorations = buildDecorations(view, getSettings());
				}

				update(update: ViewUpdate) {
					if (update.docChanged || update.viewportChanged || update.selectionSet) {
						this.decorations = buildDecorations(update.view, getSettings());
					}
				}
			},
			{ decorations: v => v.decorations }
		);
	}

	private processIcons(el: HTMLElement) {
		const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
		const nodesToReplace: Text[] = [];

		for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
			if (node.nodeValue?.includes('!icon[') && node.parentNode) {
				nodesToReplace.push(node as Text);
			}
		}

		nodesToReplace.forEach(node => {
			node.replaceWith(this.parseAndCreateIcons(node.nodeValue ?? ''));
		});
	}

	private parseAndCreateIcons(text: string): DocumentFragment {
		return createFragment(fragment => {
			for (const segment of parseIconSyntax(text)) {
				fragment.appendChild(segment.type === 'icon'
					? createIconElement(segment.value, this.settings)
					: document.createTextNode(segment.value));
			}
		});
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<MaterialIconsSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class MaterialIconsSettingTab extends PluginSettingTab {
	plugin: MaterialIconsPlugin;

	constructor(app: App, plugin: MaterialIconsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Icon size')
			.setDesc('Set the size of rendered icons (e.g., 24px, 1.5em)')
			.addText(text => text
				.setPlaceholder('24px')
				.setValue(this.plugin.settings.iconSize)
				.onChange(async (value) => {
					this.plugin.settings.iconSize = isValidCssSize(value) ? value.trim() : '24px';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Icon color')
			.setDesc('Set the color of icons (CSS color value)')
			.addText(text => text
				.setPlaceholder('currentColor')
				.setValue(this.plugin.settings.iconColor)
				.onChange(async (value) => {
					this.plugin.settings.iconColor = isValidCssColor(value) ? value.trim() : 'currentColor';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl).setName('Usage').setHeading();
		const usageEl = containerEl.createEl('p');
		usageEl.createEl('strong', { text: 'Syntax: ' });
		usageEl.createEl('code', { text: '!icon[icon_name]' });
		usageEl.createEl('br');
		usageEl.createEl('strong', { text: 'Example: ' });
		usageEl.createEl('code', { text: '!icon[home] !icon[settings] !icon[search]' });
		usageEl.createEl('br');
		usageEl.createEl('strong', { text: 'Find icons: ' });
		usageEl.createEl('a', {
			text: 'Browse the icon library',
			href: 'https://fonts.google.com/icons',
			attr: { target: '_blank', rel: 'noopener noreferrer' },
		});
	}
}
