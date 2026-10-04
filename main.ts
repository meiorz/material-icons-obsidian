import { App, Notice, Plugin, PluginSettingTab, Setting, editorLivePreviewField } from 'obsidian';
import { EditorView, ViewPlugin, ViewUpdate, Decoration, DecorationSet, WidgetType } from '@codemirror/view';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { findIconMatches, parseIconSyntax, isValidCssSize, isValidCssColor } from './src/parse';

interface MaterialIconsSettings {
	iconSize: string;
	iconColor: string;
}

const DEFAULT_SETTINGS: MaterialIconsSettings = {
	iconSize: '24px',
	iconColor: 'currentColor'
}

// Icons read their size and color from these variables, so a settings change
// restyles every rendered icon without re-rendering notes or editors.
const SIZE_VAR = '--material-icons-inline-size';
const COLOR_VAR = '--material-icons-inline-color';

// Matches Obsidian's syntax-node names for inline code and fenced/indented code blocks.
const CODE_NODE = /inline-code|codeblock/;

function createIconElement(iconName: string): HTMLElement {
	const icon = document.createElement('i');
	icon.className = 'material-icons';
	icon.textContent = iconName;
	icon.style.fontSize = `var(${SIZE_VAR}, ${DEFAULT_SETTINGS.iconSize})`;
	icon.style.color = `var(${COLOR_VAR}, ${DEFAULT_SETTINGS.iconColor})`;
	icon.style.verticalAlign = 'middle';
	icon.style.marginRight = '4px';
	icon.title = `Icon: ${iconName}`;
	return icon;
}

class IconWidget extends WidgetType {
	constructor(readonly iconName: string) {
		super();
	}

	toDOM(): HTMLElement {
		return createIconElement(this.iconName);
	}

	eq(other: IconWidget): boolean {
		return other.iconName === this.iconName;
	}
}

function isInsideCode(state: EditorState, pos: number): boolean {
	let node = syntaxTree(state).resolveInner(pos, 1);
	while (!CODE_NODE.test(node.name)) {
		if (!node.parent) return false;
		node = node.parent;
	}
	return true;
}

function buildDecorations(view: EditorView): DecorationSet {
	if (!view.state.field(editorLivePreviewField, false)) return Decoration.none;

	const builder = new RangeSetBuilder<Decoration>();
	const selection = view.state.selection;

	for (const { from, to } of view.visibleRanges) {
		const text = view.state.doc.sliceString(from, to);

		for (const match of findIconMatches(text)) {
			const start = from + match.from;
			const end = from + match.to;

			const cursorInside = selection.ranges.some(r => r.from <= end && r.to >= start);
			if (cursorInside || isInsideCode(view.state, start)) continue;

			builder.add(start, end, Decoration.replace({
				widget: new IconWidget(match.name),
			}));
		}
	}

	return builder.finish();
}

const iconViewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet;

		constructor(view: EditorView) {
			this.decorations = buildDecorations(view);
		}

		update(update: ViewUpdate) {
			if (update.docChanged || update.viewportChanged || update.selectionSet ||
				syntaxTree(update.startState) !== syntaxTree(update.state) ||
				update.startState.field(editorLivePreviewField, false) !==
					update.state.field(editorLivePreviewField, false)) {
				this.decorations = buildDecorations(update.view);
			}
		}
	},
	{ decorations: v => v.decorations }
);

export default class MaterialIconsPlugin extends Plugin {
	settings: MaterialIconsSettings;
	private readonly FONT_LINK_ID = 'material-icons-obsidian-font';

	async onload() {
		await this.loadSettings();
		this.applySettings();
		this.addMaterialIconsCSS();

		this.registerMarkdownPostProcessor((el: HTMLElement) => {
			this.processIcons(el);
		});

		this.registerEditorExtension(iconViewPlugin);

		this.addSettingTab(new MaterialIconsSettingTab(this.app, this));
	}

	onunload() {
		document.getElementById(this.FONT_LINK_ID)?.remove();
		document.body.style.removeProperty(SIZE_VAR);
		document.body.style.removeProperty(COLOR_VAR);
	}

	private applySettings() {
		document.body.style.setProperty(SIZE_VAR, this.settings.iconSize);
		document.body.style.setProperty(COLOR_VAR, this.settings.iconColor);
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

		const nodesToReplace: Text[] = [];
		let currentNode;

		while (currentNode = walker.nextNode() as Text | null) {
			if (currentNode.nodeValue?.includes('!icon[') &&
				currentNode.parentElement &&
				!currentNode.parentElement.closest('code, pre')) {
				nodesToReplace.push(currentNode);
			}
		}

		nodesToReplace.forEach(node => {
			const segments = parseIconSyntax(node.nodeValue!);
			if (!segments.some(s => s.type === 'icon')) return;
			node.replaceWith(this.createFragment(segments));
		});
	}

	private createFragment(segments: ReturnType<typeof parseIconSyntax>): DocumentFragment {
		const fragment = document.createDocumentFragment();
		for (const segment of segments) {
			fragment.appendChild(segment.type === 'icon'
				? createIconElement(segment.value)
				: document.createTextNode(segment.value));
		}
		return fragment;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applySettings();
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
