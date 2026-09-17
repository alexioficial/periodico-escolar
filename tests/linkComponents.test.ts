import assert from 'node:assert/strict';
import test from 'node:test';
import { componentDom } from './helpers/svelteDom.ts';

test('article interceptor leaves pagination and Share mailto links outside article content untouched', async () => {
	const fixture = await componentDom(
		'ExternalLinkDialog',
		`
<div id="target"></div>
<nav><a id="pagination" href="?page=2"><span>Next</span></a></nav>
<a id="share" href="mailto:?subject=Article">Share</a>
<div data-article-content><a id="article-invalid" href="mailto:editor@example.com">Mail</a></div>`
	);
	try {
		fixture.mount({ user: null });
		for (const id of ['pagination', 'share']) {
			for (const type of ['click', 'auxclick']) {
				const event = new fixture.dom.window.MouseEvent(type, {
					bubbles: true,
					cancelable: true,
					button: type === 'auxclick' ? 1 : 0
				});
				// Cancel later in bubbling to suppress jsdom's unimplemented navigation.
				let preventedByInterceptor: boolean | undefined;
				const anchor = fixture.dom.window.document.getElementById(id)!;
				anchor.addEventListener(
					type,
					(received) => {
						preventedByInterceptor = received.defaultPrevented;
						received.preventDefault();
					},
					{ once: true }
				);
				(anchor.firstElementChild ?? anchor).dispatchEvent(event);
				assert.equal(
					preventedByInterceptor,
					false,
					`${id} ${type} must reach its own handler without interception`
				);
			}
		}
		const invalid = new fixture.dom.window.MouseEvent('click', { bubbles: true, cancelable: true });
		fixture.dom.window.document.getElementById('article-invalid')!.dispatchEvent(invalid);
		assert.equal(invalid.defaultPrevented, true, 'strict article URL policy still blocks mailto');
		assert.equal(fixture.dom.window.document.querySelector('dialog'), null);
	} finally {
		await fixture.close();
	}
});

test('Enter in optional link text applies the link without submitting the surrounding article form', async () => {
	const fixture = await componentDom(
		'ArticleEditor',
		'<form><div id="target"></div><button type="submit">Publish</button></form>'
	);
	try {
		fixture.mount();
		const document = fixture.dom.window.document;
		document.querySelector<HTMLButtonElement>('[aria-label="Insertar o editar enlace"]')!.click();
		fixture.runtime.flushSync();
		const inputs = document.querySelectorAll<HTMLInputElement>('dialog input');
		inputs[0].value = 'https://example.com';
		inputs[0].dispatchEvent(new fixture.dom.window.Event('input', { bubbles: true }));
		inputs[1].value = 'Visit example';
		inputs[1].dispatchEvent(new fixture.dom.window.Event('input', { bubbles: true }));
		let submissions = 0;
		document.querySelector('form')!.addEventListener('submit', (event) => {
			submissions += 1;
			event.preventDefault();
		});
		const enter = new fixture.dom.window.KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true
		});
		inputs[1].dispatchEvent(enter);
		// jsdom has no implicit Enter submission; emulate that browser default only if uncanceled.
		if (!enter.defaultPrevented) document.querySelector('form')!.requestSubmit();
		fixture.runtime.flushSync();
		assert.equal(submissions, 0);
		assert.equal(enter.defaultPrevented, true);
		assert.equal(document.querySelector('dialog'), null);
		assert.equal(document.querySelector('.article-editor-surface a')?.textContent, 'Visit example');
		assert.equal(
			document.querySelector('.article-editor-surface a')?.getAttribute('href'),
			'https://example.com/'
		);
	} finally {
		await fixture.close();
	}
});

test('editor mounts and toggles disabled state without content changes or a reactive update loop', async () => {
	const fixture = await componentDom('ArticleEditor');
	try {
		const props = fixture.mount({ disabled: true });
		const document = fixture.dom.window.document;
		const surface = document.querySelector('.article-editor-surface')!;
		const rich = document.querySelector<HTMLInputElement>('[name="contentRich"]')!.value;
		assert.equal(surface.getAttribute('contenteditable'), 'false');
		assert.equal(
			document.querySelector<HTMLButtonElement>('[aria-label="Negrita"]')!.disabled,
			true
		);
		props.disabled = false;
		fixture.runtime.flushSync();
		assert.equal(surface.getAttribute('contenteditable'), 'true');
		assert.equal(
			document.querySelector<HTMLButtonElement>('[aria-label="Negrita"]')!.disabled,
			false
		);
		props.disabled = true;
		fixture.runtime.flushSync();
		assert.equal(surface.getAttribute('contenteditable'), 'false');
		assert.equal(document.querySelector<HTMLInputElement>('[name="contentRich"]')!.value, rich);
		assert.equal(document.querySelector<HTMLTextAreaElement>('[name="content"]')!.value, '');
	} finally {
		await fixture.close();
	}
});

test('article external links still warn on nested middle click and cancel without opening a site', async () => {
	const fixture = await componentDom(
		'ExternalLinkDialog',
		'<div id="target"></div><div data-article-content><a href="https://outside.test/a"><span id="nested">Outside</span></a></div>'
	);
	try {
		const opened: string[] = [];
		fixture.dom.window.open = (url) => {
			opened.push(String(url));
			return null;
		};
		fixture.mount({ user: null });
		const event = new fixture.dom.window.MouseEvent('auxclick', {
			button: 1,
			bubbles: true,
			cancelable: true
		});
		fixture.dom.window.document.getElementById('nested')!.dispatchEvent(event);
		fixture.runtime.flushSync();
		assert.equal(event.defaultPrevented, true);
		assert.match(
			fixture.dom.window.document.querySelector('dialog')!.textContent!,
			/outside\.test/
		);
		assert.deepEqual(opened, []);
		fixture.dom.window.document.querySelector<HTMLButtonElement>('[data-cancel]')!.click();
		fixture.runtime.flushSync();
		assert.equal(fixture.dom.window.document.querySelector('dialog'), null);
		assert.deepEqual(opened, []);
	} finally {
		await fixture.close();
	}
});
