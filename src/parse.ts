export interface ParsedSegment {
	type: 'text' | 'icon';
	value: string;
}

const ICON_PATTERN = /!icon\[([^\]]+)\]/g;
const VALID_ICON_NAME = /^[a-z0-9_]+$/;

export function parseIconSyntax(text: string): ParsedSegment[] {
	const segments: ParsedSegment[] = [];
	const regex = new RegExp(ICON_PATTERN.source, 'g');
	let lastIndex = 0;
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		if (match.index > lastIndex) {
			segments.push({ type: 'text', value: text.substring(lastIndex, match.index) });
		}

		const iconName = match[1].trim();
		if (iconName && VALID_ICON_NAME.test(iconName)) {
			segments.push({ type: 'icon', value: iconName });
		} else {
			segments.push({ type: 'text', value: match[0] });
		}

		lastIndex = regex.lastIndex;
	}

	if (lastIndex < text.length) {
		segments.push({ type: 'text', value: text.substring(lastIndex) });
	}

	return segments;
}

export function isValidCssSize(value: string): boolean {
	return /^\d+(\.\d+)?(px|em|rem|%|vw|vh|pt)$/.test(value.trim());
}

export function isValidCssColor(value: string): boolean {
	return /^(#[0-9a-fA-F]{3,8}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)|currentColor|[a-zA-Z]+)$/.test(value.trim());
}
