import { parseIconSyntax, isValidCssSize, isValidCssColor } from '../src/parse';

describe('parseIconSyntax', () => {
	test('parses a single icon', () => {
		expect(parseIconSyntax('!icon[home]')).toEqual([
			{ type: 'icon', value: 'home' },
		]);
	});

	test('parses multiple icons', () => {
		expect(parseIconSyntax('!icon[home] !icon[settings]')).toEqual([
			{ type: 'icon', value: 'home' },
			{ type: 'text', value: ' ' },
			{ type: 'icon', value: 'settings' },
		]);
	});

	test('preserves text before and after an icon', () => {
		expect(parseIconSyntax('Hello !icon[star] world')).toEqual([
			{ type: 'text', value: 'Hello ' },
			{ type: 'icon', value: 'star' },
			{ type: 'text', value: ' world' },
		]);
	});

	test('returns plain text unchanged when no icons present', () => {
		expect(parseIconSyntax('just plain text')).toEqual([
			{ type: 'text', value: 'just plain text' },
		]);
	});

	test('trims whitespace from icon names', () => {
		expect(parseIconSyntax('!icon[ home ]')).toEqual([
			{ type: 'icon', value: 'home' },
		]);
	});

	test('treats icon name with spaces as literal text', () => {
		expect(parseIconSyntax('!icon[arrow forward]')).toEqual([
			{ type: 'text', value: '!icon[arrow forward]' },
		]);
	});

	test('does not match empty brackets', () => {
		expect(parseIconSyntax('!icon[]')).toEqual([
			{ type: 'text', value: '!icon[]' },
		]);
	});

	test('handles adjacent icons with no separator', () => {
		expect(parseIconSyntax('!icon[add]!icon[remove]')).toEqual([
			{ type: 'icon', value: 'add' },
			{ type: 'icon', value: 'remove' },
		]);
	});

	test('handles empty string', () => {
		expect(parseIconSyntax('')).toEqual([]);
	});

	test('handles underscore_names used by Material Icons', () => {
		expect(parseIconSyntax('!icon[arrow_back]')).toEqual([
			{ type: 'icon', value: 'arrow_back' },
		]);
	});
});

describe('isValidCssSize', () => {
	test.each(['24px', '1.5em', '2rem', '100%', '16pt', '10vw', '5vh'])(
		'accepts valid size: %s', (v) => expect(isValidCssSize(v)).toBe(true)
	);

	test.each(['-1px', 'javascript:x', '', 'auto', 'inherit', '24 px', '10px 20px'])(
		'rejects invalid size: %s', (v) => expect(isValidCssSize(v)).toBe(false)
	);
});

describe('isValidCssColor', () => {
	test.each([
		'#fff',
		'#1a2b3c',
		'#1a2b3cff',
		'currentColor',
		'red',
		'rgb(0, 0, 0)',
		'rgba(0, 0, 0, 0.5)',
		'hsl(120, 100%, 50%)',
	])('accepts valid color: %s', (v) => expect(isValidCssColor(v)).toBe(true));

	test.each([
		'javascript:alert(1)',
		'expression(x)',
		'',
		'#gggggg',
	])('rejects invalid color: %s', (v) => expect(isValidCssColor(v)).toBe(false));
});
