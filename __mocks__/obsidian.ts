export class Plugin {}
export class PluginSettingTab {}
export class Setting {
	setName() { return this; }
	setDesc() { return this; }
	addText(cb: (t: any) => void) {
		cb({ setPlaceholder: () => ({ setValue: () => ({ onChange: () => ({}) }) }) });
		return this;
	}
}
export class Notice {
	constructor(public message: string, public duration?: number) {}
}
export type MarkdownPostProcessorContext = object;
