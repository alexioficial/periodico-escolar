import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { compile } from 'svelte/compiler';
import { JSDOM } from 'jsdom';

let fixtureId = 0;

/** Run the actual compiled Svelte component and browser runtime in a DOM. */
export async function componentDom(component: string, html = '<div id="target"></div>') {
	const dom = new JSDOM(`<!doctype html><html><body>${html}</body></html>`, {
		url: 'https://paper.test',
		pretendToBeVisual: true
	});
	const originals = new Map<string, PropertyDescriptor | undefined>();
	for (const key of [
		'window',
		'document',
		'location',
		'navigator',
		'HTMLElement',
		'HTMLDialogElement',
		'HTMLMediaElement',
		'HTMLInputElement',
		'HTMLTextAreaElement',
		'Element',
		'Node',
		'Text',
		'Comment',
		'DocumentFragment',
		'MutationObserver',
		'getComputedStyle',
		'requestAnimationFrame',
		'cancelAnimationFrame'
	]) {
		originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
		const value = (dom.window as unknown as Record<string, unknown>)[key];
		Object.defineProperty(globalThis, key, { configurable: true, value });
	}
	// jsdom does not implement the native dialog presentation API.
	dom.window.HTMLDialogElement.prototype.showModal = function () {
		this.open = true;
	};
	dom.window.HTMLDialogElement.prototype.close = function () {
		this.open = false;
	};
	const result = await build({
		stdin: {
			contents: `export { default as Component } from './src/lib/components/${component}.svelte';
export { mount, unmount, flushSync, tick } from 'svelte';
export { proxy } from 'svelte/internal/client';
export { toast } from './src/lib/toast.ts';`,
			resolveDir: process.cwd()
		},
		bundle: true,
		write: false,
		format: 'esm',
		platform: 'browser',
		plugins: [
			{
				name: 'svelte-dom-test',
				setup(builder) {
					builder.onResolve({ filter: /^\$lib\// }, (args) => ({
						path: resolve('src/lib', args.path.slice(5)) + '.ts'
					}));
					// This SvelteKit-only refresh is irrelevant to clicking or editing links.
					builder.onResolve({ filter: /^\$app\/navigation$/ }, () => ({
						path: 'navigation',
						namespace: 'test'
					}));
					builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
						contents: 'export async function invalidateAll() {}'
					}));
					builder.onLoad({ filter: /\.svelte$/ }, async (args) => ({
						contents: compile(await readFile(args.path, 'utf8'), {
							filename: args.path,
							generate: 'client'
						}).js.code,
						resolveDir: resolve(args.path, '..')
					}));
				}
			}
		]
	});
	const code = `${result.outputFiles[0].text}\n//# sourceURL=svelte-dom-test-${component}-${++fixtureId}.js`;
	const runtime = await import(
		`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
	);
	const instances: object[] = [];
	return {
		dom,
		runtime,
		mount(props: Record<string, unknown> = {}) {
			const reactiveProps: Record<string, unknown> = runtime.proxy(props);
			const instance = runtime.mount(runtime.Component, {
				target: dom.window.document.querySelector('#target'),
				props: reactiveProps
			});
			instances.push(instance);
			runtime.flushSync();
			return reactiveProps;
		},
		async close() {
			for (const instance of instances) await runtime.unmount(instance);
			runtime.toast.clear();
			dom.window.close();
			for (const [key, descriptor] of originals) {
				if (descriptor) Object.defineProperty(globalThis, key, descriptor);
				else Reflect.deleteProperty(globalThis, key);
			}
		}
	};
}
