export interface ParsedSegment {
	type: 'text' | 'icon';
	value: string;
}

export interface IconMatch {
	from: number;
	to: number;
	name: string;
}

const ICON_PATTERN = /!icon\[([^\]]+)\]/g;
const VALID_ICON_NAME = /^[a-z0-9_]+$/;

export function findIconMatches(text: string): IconMatch[] {
	const matches: IconMatch[] = [];
	const regex = new RegExp(ICON_PATTERN.source, 'g');
	let match: RegExpExecArray | null;

	while ((match = regex.exec(text)) !== null) {
		const iconName = match[1].trim();
		if (iconName && VALID_ICON_NAME.test(iconName)) {
			matches.push({ from: match.index, to: regex.lastIndex, name: iconName });
		}
	}

	return matches;
}

export function parseIconSyntax(text: string): ParsedSegment[] {
	const segments: ParsedSegment[] = [];
	let lastIndex = 0;

	for (const { from, to, name } of findIconMatches(text)) {
		if (from > lastIndex) {
			segments.push({ type: 'text', value: text.substring(lastIndex, from) });
		}
		segments.push({ type: 'icon', value: name });
		lastIndex = to;
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
