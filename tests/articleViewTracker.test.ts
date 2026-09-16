import assert from 'node:assert/strict';
import test from 'node:test';
import { trackArticleView } from '../src/lib/articleViewTracker.ts';

test('registra una sola impresión al entrar la tarjeta en pantalla', async () => {
	const originalObserver = globalThis.IntersectionObserver;
	const originalFetch = globalThis.fetch;
	let callback: IntersectionObserverCallback | undefined;
	let observed: Element | undefined;
	let disconnected = 0;
	const requests: unknown[][] = [];
	class FakeObserver {
		constructor(cb: IntersectionObserverCallback) {
			callback = cb;
		}
		observe(node: Element) {
			observed = node;
		}
		disconnect() {
			disconnected++;
		}
		unobserve() {}
		takeRecords() {
			return [];
		}
		root = null;
		rootMargin = '';
		thresholds = [0];
	}
	globalThis.IntersectionObserver = FakeObserver as unknown as typeof IntersectionObserver;
	globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
		requests.push(args);
		return {} as Response;
	}) as typeof fetch;
	try {
		const node = {} as HTMLElement;
		const action = trackArticleView(node, '507f1f77bcf86cd799439011');
		assert.equal(observed, node);
		assert.equal(requests.length, 0);
		callback?.(
			[{ isIntersecting: false } as IntersectionObserverEntry],
			{} as IntersectionObserver
		);
		assert.equal(requests.length, 0);
		callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
		assert.equal(requests.length, 1);
		assert.equal(requests[0][0], '/api/articles/507f1f77bcf86cd799439011/view');
		assert.deepEqual(requests[0][1], { method: 'POST', keepalive: true });
		action.destroy();
		assert.ok(disconnected >= 1);
	} finally {
		globalThis.IntersectionObserver = originalObserver;
		globalThis.fetch = originalFetch;
	}
});
