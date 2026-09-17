import assert from 'node:assert/strict';
import test from 'node:test';
import { componentDom } from './helpers/svelteDom.ts';
import { access } from 'node:fs/promises';

const article = {
	_id: '507f1f77bcf86cd799439011',
	title: 'Mi artículo',
	excerpt: 'Resumen',
	categoryId: 'category',
	content: 'Contenido',
	contentHtml: '<p><strong>Contenido</strong></p>',
	media: [{ type: 'image' }],
	attachments: [{ name: 'guia.pdf' }]
};
type EnhancedForm = HTMLFormElement & {
	__submit: () => (args: {
		result: unknown;
		update: (options?: unknown) => Promise<void>;
	}) => Promise<void>;
};

test('edit form retains draft, editor and files on action failure, resets only after redirect', async () => {
	const exists = await access('src/lib/components/OwnArticleEditForm.svelte').then(
		() => true,
		() => false
	);
	assert.ok(exists, 'own edit form is implemented');
	const fixture = await componentDom('OwnArticleEditForm');
	try {
		fixture.mount({ article, categories: [{ _id: 'category', name: 'Noticias' }], isStaff: false });
		await fixture.runtime.tick();
		fixture.runtime.flushSync();
		const doc = fixture.dom.window.document;
		assert.match(doc.body.textContent ?? '', /revisión/);
		assert.match(doc.body.textContent ?? '', /conservarán/);
		assert.match(doc.body.textContent ?? '', /guia.pdf/);
		const title = doc.querySelector<HTMLInputElement>('input[name="title"]')!;
		title.value = 'Mi borrador';
		title.dispatchEvent(new fixture.dom.window.Event('input', { bubbles: true }));
		const content = doc.querySelector<HTMLInputElement>('input[name="contentRich"]')!.value;
		const form = doc.querySelector('form') as EnhancedForm;
		const callback = form.__submit();
		fixture.runtime.flushSync();
		assert.ok(doc.querySelector('button[type="submit"]')?.hasAttribute('disabled'));
		const updates: unknown[] = [];
		await callback({
			result: { type: 'failure', status: 400, data: { message: 'Revisa la categoría' } },
			update: async (options) => {
				updates.push(options);
			}
		});
		fixture.runtime.flushSync();
		assert.equal(title.value, 'Mi borrador');
		assert.equal(doc.querySelector<HTMLInputElement>('input[name="contentRich"]')!.value, content);
		assert.deepEqual([...updates], [{ reset: false }]);
		assert.match(doc.querySelector('[role="alert"]')?.textContent ?? '', /Revisa la categoría/);
		await form.__submit()({
			result: { type: 'redirect', status: 303, location: '/redaccion' },
			update: async (options) => {
				updates.push(options);
			}
		});
		assert.deepEqual(updates, [{ reset: false }, undefined]);
	} finally {
		await fixture.close();
	}
});

test('delete requires explicit named confirmation; failure retains it; success closes stale selection', async () => {
	const exists = await access('src/lib/components/OwnArticleDelete.svelte').then(
		() => true,
		() => false
	);
	assert.ok(exists, 'own delete confirmation is implemented');
	const fixture = await componentDom('OwnArticleDelete');
	try {
		fixture.mount({ id: article._id, title: article.title });
		const doc = fixture.dom.window.document;
		const details = doc.querySelector('details')!;
		assert.equal(details.open, false);
		assert.equal(doc.querySelector('form')?.getAttribute('action'), '?/delete');
		assert.match(doc.querySelector('form')?.textContent ?? '', /Mi artículo/);
		details.open = true;
		const back = doc.querySelector<HTMLAnchorElement>('a[href="/redaccion"]');
		assert.ok(back, 'Volver must have a native no-JavaScript navigation fallback');
		back.click();
		fixture.runtime.flushSync();
		assert.equal(details.open, false);
		details.open = true;
		const form = doc.querySelector('form') as EnhancedForm;
		const updates: unknown[] = [];
		await form.__submit()({
			result: { type: 'failure', status: 404, data: { message: 'No se pudo eliminar' } },
			update: async (options) => {
				updates.push(options);
			}
		});
		fixture.runtime.flushSync();
		assert.equal(details.open, true);
		assert.match(doc.querySelector('[role="alert"]')?.textContent ?? '', /No se pudo eliminar/);
		await form.__submit()({
			result: {
				type: 'success',
				status: 200,
				data: { deleted: true, message: 'Artículo eliminado' }
			},
			update: async (options) => {
				updates.push(options);
			}
		});
		fixture.runtime.flushSync();
		assert.equal(details.open, false);
		assert.deepEqual(updates, [{ reset: false }, { reset: true }]);
	} finally {
		await fixture.close();
	}
});
