import MaterialIconsPlugin from '../main';

function render(html: string): HTMLElement {
	const el = document.createElement('div');
	el.innerHTML = html;
	// processIcons is the reading-view post-processor body.
	(new MaterialIconsPlugin() as any).processIcons(el);
	return el;
}

describe('reading view post-processor', () => {
	test('replaces icon syntax with an icon element', () => {
		const el = render('<p>Go !icon[home] now</p>');
		const icons = el.querySelectorAll('i.material-icons');
		expect(icons).toHaveLength(1);
		expect(icons[0].textContent).toBe('home');
		expect(el.textContent).toBe('Go home now');
	});

	test('leaves inline code untouched', () => {
		const el = render('<p><code>!icon[home]</code></p>');
		expect(el.querySelector('i')).toBeNull();
		expect(el.textContent).toBe('!icon[home]');
	});

	test('leaves code blocks untouched', () => {
		const el = render('<pre><code>!icon[home]\n!icon[star]</code></pre>');
		expect(el.querySelector('i')).toBeNull();
	});

	test('leaves invalid icon names as literal text', () => {
		const el = render('<p>!icon[arrow forward]</p>');
		expect(el.querySelector('i')).toBeNull();
		expect(el.textContent).toBe('!icon[arrow forward]');
	});

	test('renders icons outside code next to code', () => {
		const el = render('<p>!icon[star] and <code>!icon[home]</code></p>');
		const icons = el.querySelectorAll('i.material-icons');
		expect(icons).toHaveLength(1);
		expect(icons[0].textContent).toBe('star');
	});
});
