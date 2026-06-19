import { App, Notice, Plugin, PluginSettingTab, Setting, MarkdownPostProcessorContext } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { isValidCssSize, isValidCssColor } from './src/parse';

interface MaterialIconsSettings {
	iconSize: string;
	iconColor: string;
}

const DEFAULT_SETTINGS: MaterialIconsSettings = {
	iconSize: '24px',
	iconColor: 'currentColor'
}

class IconWidget extends WidgetType {
	constructor(readonly iconName: string, readonly settings: MaterialIconsSettings) {
		super();
	}

	toDOM(): HTMLElement {
		const icon = document.createElement('i');
		icon.className = 'material-icons';
		icon.textContent = this.iconName;
		icon.style.fontSize = this.settings.iconSize;
		icon.style.color = this.settings.iconColor;
		icon.style.verticalAlign = 'middle';
		icon.style.marginRight = '4px';
		icon.title = `Icon: ${this.iconName}`;
		return icon;
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
		let match;

		while ((match = iconRegex.exec(text)) !== null) {
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
	private readonly FONT_LINK_ID = 'material-icons-obsidian-font';

	async onload() {
		await this.loadSettings();
		this.addMaterialIconsCSS();

		this.registerMarkdownPostProcessor((el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			this.processIcons(el);
		});

		this.registerEditorExtension(this.buildEditorExtension());

		this.addSettingTab(new MaterialIconsSettingTab(this.app, this));
	}

	onunload() {
		document.getElementById(this.FONT_LINK_ID)?.remove();
	}

	private buildEditorExtension() {
		const plugin = this;
		return ViewPlugin.fromClass(
			class {
				decorations: DecorationSet;

				constructor(view: EditorView) {
					this.decorations = buildDecorations(view, plugin.settings);
				}

				update(update: ViewUpdate) {
					if (update.docChanged || update.viewportChanged || update.selectionSet) {
						this.decorations = buildDecorations(update.view, plugin.settings);
					}
				}
			},
			{ decorations: v => v.decorations }
		);
	}

	private addMaterialIconsCSS() {
		if (document.getElementById(this.FONT_LINK_ID)) return;

		const link = document.createElement('link');
		link.id = this.FONT_LINK_ID;
		link.rel = 'stylesheet';
		link.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
		link.addEventListener('error', () => {
			new Notice(
				'Material Icons: failed to load icon font. ' +
				'Check your internet connection or firewall settings.',
				8000
			);
		});
		document.head.appendChild(link);
	}

	private processIcons(el: HTMLElement) {
		const walker = document.createTreeWalker(
			el,
			NodeFilter.SHOW_TEXT
		);

		const nodesToReplace: Array<{ node: Node, parent: Node }> = [];
		let currentNode;

		while (currentNode = walker.nextNode()) {
			if (currentNode.nodeValue?.includes('!icon[') && currentNode.parentNode) {
				nodesToReplace.push({
					node: currentNode,
					parent: currentNode.parentNode,
				});
			}
		}

		nodesToReplace.forEach(({ node, parent }) => {
			const fragment = this.parseAndCreateIconHTML(node.nodeValue!);
			parent.replaceChild(fragment, node);
		});
	}

	private parseAndCreateIconHTML(text: string): DocumentFragment {
		const fragment = document.createDocumentFragment();
		const iconRegex = /!icon\[([^\]]+)\]/g;
		let lastIndex = 0;
		let match;

		while ((match = iconRegex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				fragment.appendChild(
					document.createTextNode(text.substring(lastIndex, match.index))
				);
			}

			const iconName = match[1].trim();
			fragment.appendChild(this.createIconElement(iconName));
			lastIndex = iconRegex.lastIndex;
		}

		if (lastIndex < text.length) {
			fragment.appendChild(
				document.createTextNode(text.substring(lastIndex))
			);
		}

		return fragment;
	}

	private createIconElement(iconName: string): HTMLElement {
		const icon = document.createElement('i');
		icon.className = 'material-icons';
		icon.textContent = iconName;
		icon.style.fontSize = this.settings.iconSize;
		icon.style.color = this.settings.iconColor;
		icon.style.verticalAlign = 'middle';
		icon.style.marginRight = '4px';
		icon.title = `Icon: ${iconName}`;
		return icon;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
		containerEl.createEl('h2', { text: 'Material Icons Inline Settings' });

		new Setting(containerEl)
			.setName('Icon Size')
			.setDesc('Set the size of rendered icons (e.g., 24px, 1.5em)')
			.addText(text => text
				.setPlaceholder('24px')
				.setValue(this.plugin.settings.iconSize)
				.onChange(async (value) => {
					this.plugin.settings.iconSize = isValidCssSize(value) ? value.trim() : '24px';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Icon Color')
			.setDesc('Set the color of icons (CSS color value)')
			.addText(text => text
				.setPlaceholder('currentColor')
				.setValue(this.plugin.settings.iconColor)
				.onChange(async (value) => {
					this.plugin.settings.iconColor = isValidCssColor(value) ? value.trim() : 'currentColor';
					await this.plugin.saveSettings();
				}));

		containerEl.createEl('h3', { text: 'Usage' });
		const usageEl = containerEl.createEl('p');
		usageEl.createEl('strong', { text: 'Syntax: ' });
		usageEl.createEl('code', { text: '!icon[icon_name]' });
		usageEl.createEl('br');
		usageEl.createEl('strong', { text: 'Example: ' });
		usageEl.createEl('code', { text: '!icon[home] !icon[settings] !icon[search]' });
		usageEl.createEl('br');
		usageEl.createEl('strong', { text: 'Find icons: ' });
		usageEl.createEl('a', {
			text: 'Google Material Icons',
			href: 'https://fonts.google.com/icons',
			attr: { target: '_blank', rel: 'noopener noreferrer' },
		});
	}
}
