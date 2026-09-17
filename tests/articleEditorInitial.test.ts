import assert from 'node:assert/strict';
import test from 'node:test';
import { componentDom } from './helpers/svelteDom.ts';
import { validateArticleRichText } from '../src/lib/server/articleRichText.ts';

test('real editor starts with safe HTML and submits existing rich formatting', async () => {
	const fixture = await componentDom('ArticleEditor');
	try {
		fixture.mount({
			initialContentHtml:
				'<h2>Sección</h2><p><strong>Fuerte</strong><em>Suave</em><s>Tachado</s><br>Otra <a href="/feed">Inicio</a></p><ul><li><p>Uno</p></li></ul><blockquote><p>Cita</p></blockquote>',
			initialContent: 'fallback'
		});
		await fixture.runtime.tick();
		fixture.runtime.flushSync();
		const rich = fixture.dom.window.document.querySelector<HTMLInputElement>(
			'input[name="contentRich"]'
		)!;
		assert.ok(rich.value, 'the initial draft must be serialized');
		const result = validateArticleRichText(JSON.parse(rich.value));
		for (const tag of ['h2', 'strong', 'em', 's', 'br', 'a', 'ul', 'blockquote'])
			assert.match(result.html, new RegExp(`<${tag}[ >]`));
		assert.doesNotMatch(result.text, /fallback/);
	} finally {
		await fixture.close();
	}
});

test('legacy fallback preserves literal HTML and every newline', async () => {
	const fixture = await componentDom('ArticleEditor');
	try {
		fixture.mount({ initialContent: 'Primera\n\n<script>literal</script>\r\nÚltima' });
		await fixture.runtime.tick();
		fixture.runtime.flushSync();
		const rich = fixture.dom.window.document.querySelector<HTMLInputElement>(
			'input[name="contentRich"]'
		)!;
		const result = validateArticleRichText(JSON.parse(rich.value));
		assert.equal(result.text, 'Primera\n\n<script>literal</script>\nÚltima');
		assert.match(result.html, /&lt;script&gt;literal/);
		assert.doesNotMatch(result.html, /<script>/);
	} finally {
		await fixture.close();
	}
});
