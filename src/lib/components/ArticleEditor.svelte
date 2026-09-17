<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import {
		articleEditorExtensions,
		serializeArticleEditor,
		applyArticleLink,
		clearArticleEditor
	} from '$lib/articleEditor';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/scrollLock';
	let {
		api = $bindable(null),
		disabled = false
	}: { api?: { clear: () => void } | null; disabled?: boolean } = $props();
	let host: HTMLDivElement;
	let editor = $state.raw<Editor | null>(null);
	let revision = $state(0);
	let plain = $state('');
	let rich = $state('');
	let linkOpen = $state(false);
	let linkUrl = $state('');
	let linkText = $state('');
	let linkError = $state('');
	let needsLinkText = $state(false);
	type Tool = {
		label: string;
		text: string;
		shortcut?: string;
		name?: string;
		level?: number;
		run: (editor: Editor) => void;
	};
	const groups: { label: string; tools: Tool[] }[] = [
		{
			label: 'Estilo del párrafo',
			tools: [
				{
					label: 'Párrafo',
					text: 'P',
					name: 'paragraph',
					shortcut: 'Ctrl/⌘ Alt 0',
					run: (e) => {
						e.chain().focus().setParagraph().run();
					}
				},
				{
					label: 'Encabezado 2',
					text: 'H2',
					name: 'heading',
					level: 2,
					shortcut: 'Ctrl/⌘ Alt 2',
					run: (e) => {
						e.chain().focus().toggleHeading({ level: 2 }).run();
					}
				},
				{
					label: 'Encabezado 3',
					text: 'H3',
					name: 'heading',
					level: 3,
					shortcut: 'Ctrl/⌘ Alt 3',
					run: (e) => {
						e.chain().focus().toggleHeading({ level: 3 }).run();
					}
				}
			]
		},
		{
			label: 'Formato del texto',
			tools: [
				{
					label: 'Negrita',
					text: 'B',
					name: 'bold',
					shortcut: 'Ctrl/⌘ B',
					run: (e) => {
						e.chain().focus().toggleBold().run();
					}
				},
				{
					label: 'Cursiva',
					text: 'I',
					name: 'italic',
					shortcut: 'Ctrl/⌘ I',
					run: (e) => {
						e.chain().focus().toggleItalic().run();
					}
				},
				{
					label: 'Tachado',
					text: 'S',
					name: 'strike',
					shortcut: 'Ctrl/⌘ Shift S',
					run: (e) => {
						e.chain().focus().toggleStrike().run();
					}
				},
				{
					label: 'Insertar o editar enlace',
					text: '↗',
					name: 'link',
					shortcut: 'Ctrl/⌘ K',
					run: () => openLink()
				}
			]
		},
		{
			label: 'Listas y citas',
			tools: [
				{
					label: 'Lista con viñetas',
					text: '• ≡',
					name: 'bulletList',
					shortcut: 'Ctrl/⌘ Shift 8',
					run: (e) => {
						e.chain().focus().toggleBulletList().run();
					}
				},
				{
					label: 'Lista numerada',
					text: '1. ≡',
					name: 'orderedList',
					shortcut: 'Ctrl/⌘ Shift 7',
					run: (e) => {
						e.chain().focus().toggleOrderedList().run();
					}
				},
				{
					label: 'Cita',
					text: '“ ”',
					name: 'blockquote',
					shortcut: 'Ctrl/⌘ Shift B',
					run: (e) => {
						e.chain().focus().toggleBlockquote().run();
					}
				}
			]
		},
		{
			label: 'Historial',
			tools: [
				{
					label: 'Deshacer',
					text: '↶',
					shortcut: 'Ctrl/⌘ Z',
					run: (e) => {
						e.chain().focus().undo().run();
					}
				},
				{
					label: 'Rehacer',
					text: '↷',
					shortcut: 'Ctrl/⌘ Shift Z',
					run: (e) => {
						e.chain().focus().redo().run();
					}
				}
			]
		}
	];
	function active(tool: Tool) {
		void revision;
		return Boolean(
			tool.name && editor?.isActive(tool.name, tool.level ? { level: tool.level } : undefined)
		);
	}
	function openLink() {
		if (!editor || disabled) return;
		linkUrl = String(editor.getAttributes('link').href ?? '');
		needsLinkText = editor.state.selection.empty && !editor.isActive('link');
		linkText = '';
		linkError = '';
		linkOpen = true;
	}
	function saveLink() {
		if (!editor || !applyArticleLink(editor, linkUrl, linkText)) {
			linkError = 'Usa una dirección http://, https:// o una ruta que comience con /.';
			return;
		}
		linkOpen = false;
		editor.commands.focus();
	}
	function applyLinkOnEnter(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			saveLink();
		}
	}
	function linkDialog(element: HTMLDialogElement) {
		const previous = document.activeElement as HTMLElement | null;
		lockBodyScroll();
		element.showModal();
		element.querySelector('input')?.focus();
		return {
			destroy() {
				element.close();
				unlockBodyScroll();
				previous?.focus();
			}
		};
	}
	onMount(() => {
		const sync = (instance: Editor) => {
			plain = instance.getText();
			rich = JSON.stringify(serializeArticleEditor(instance));
			revision += 1;
		};
		const instance = new Editor({
			element: host,
			extensions: articleEditorExtensions(),
			content: plain
				? {
						type: 'doc',
						content: [{ type: 'paragraph', content: [{ type: 'text', text: plain }] }]
					}
				: '',
			editorProps: {
				attributes: {
					role: 'textbox',
					'aria-label': 'Contenido del artículo',
					'aria-multiline': 'true',
					'aria-describedby': 'article-editor-help',
					class: 'article-editor-surface'
				},
				handleKeyDown: (_view, event) => {
					if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
						event.preventDefault();
						openLink();
						return true;
					}
					return false;
				}
			},
			onUpdate: ({ editor }) => sync(editor),
			onTransaction: () => {
				revision += 1;
			}
		});
		editor = instance;
		sync(instance);
		api = {
			clear: () => {
				clearArticleEditor(instance);
				sync(instance);
			}
		};
		return () => {
			api = null;
			instance.destroy();
		};
	});
	$effect(() => {
		// Editability does not change content; emitting update here would track sync's revision.
		editor?.setEditable(!disabled, false);
	});
</script>

<div class="space-y-2">
	<p id="article-editor-label" class="text-sm font-medium text-slate-700">Contenido</p>
	<div
		class="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100"
	>
		{#if editor}
			<div
				role="toolbar"
				aria-label="Formato del artículo"
				class="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2"
			>
				{#each groups as group (group.label)}
					<div
						role="group"
						aria-label={group.label}
						class="flex gap-0.5 border-r border-slate-200 pr-1 last:border-r-0"
					>
						{#each group.tools as tool (tool.label)}
							<button
								type="button"
								{disabled}
								aria-label={tool.label}
								aria-pressed={tool.name ? active(tool) : undefined}
								title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
								onclick={() => editor && tool.run(editor)}
								class:tool-active={active(tool)}
								class="tool-button inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-slate-600 hover:bg-white hover:text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50"
								class:font-bold={tool.name === 'bold'}
								class:italic={tool.name === 'italic'}
								class:line-through={tool.name === 'strike'}>{tool.text}</button
							>
						{/each}
					</div>
				{/each}
			</div>
		{/if}
		<div bind:this={host} class:hidden={!editor}></div>
		<textarea
			name="content"
			id="content"
			aria-labelledby="article-editor-label"
			bind:value={plain}
			hidden={!!editor}
			required={!editor}
			rows="12"
			class="min-h-80 w-full border-0 p-5 focus:ring-indigo-500"
		></textarea>
		<input type="hidden" name="contentRich" value={rich} />
	</div>
	<p id="article-editor-help" class="text-xs text-slate-500">
		Selecciona texto para darle formato. Usa Shift + Enter para un salto de línea.
	</p>
</div>

{#if linkOpen}
	<dialog
		use:linkDialog
		oncancel={(event) => {
			event.preventDefault();
			linkOpen = false;
		}}
		aria-labelledby="editor-link-title"
		class="m-auto w-[calc(100%-2rem)] max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
	>
		<h2 id="editor-link-title" class="text-lg font-semibold">Insertar enlace</h2>
		<label class="block space-y-2 text-sm font-medium"
			>Dirección<input
				type="text"
				bind:value={linkUrl}
				placeholder="https://ejemplo.com"
				onkeydown={applyLinkOnEnter}
				class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
			/></label
		>
		{#if needsLinkText}<label class="block space-y-2 text-sm font-medium"
				>Texto del enlace<input
					type="text"
					bind:value={linkText}
					placeholder="Texto para mostrar (opcional)"
					onkeydown={applyLinkOnEnter}
					class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				/></label
			>{/if}
		{#if linkError}<p role="alert" class="text-sm text-red-600">{linkError}</p>{/if}
		<div class="flex flex-wrap justify-end gap-2">
			{#if editor?.isActive('link')}<button
					type="button"
					onclick={() => {
						editor?.chain().extendMarkRange('link').unsetLink().run();
						linkOpen = false;
					}}
					class="mr-auto text-sm text-red-600">Quitar enlace</button
				>{/if}
			<button
				type="button"
				onclick={() => {
					linkOpen = false;
				}}
				class="rounded-lg border border-slate-300 px-3 py-2 text-sm">Cancelar</button
			>
			<button
				type="button"
				onclick={saveLink}
				class="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>Aplicar</button
			>
		</div>
	</dialog>
{/if}

<style>
	.tool-button.tool-active {
		background: #e0e7ff;
		color: #3730a3;
	}
	:global(.article-editor-surface) {
		min-height: 320px;
		outline: none;
		padding: 1.25rem;
		line-height: 1.75;
		overflow-wrap: anywhere;
	}
	:global(.article-editor-surface p + p) {
		margin-top: 0.75em;
	}
	:global(.article-editor-surface h2) {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 1em 0 0.5em;
	}
	:global(.article-editor-surface h3) {
		font-size: 1.25rem;
		font-weight: 700;
		margin: 1em 0 0.5em;
	}
	:global(.article-editor-surface ul) {
		list-style: disc;
		padding-left: 1.5rem;
	}
	:global(.article-editor-surface ol) {
		list-style: decimal;
		padding-left: 1.5rem;
	}
	:global(.article-editor-surface blockquote) {
		border-left: 3px solid #a5b4fc;
		padding-left: 1rem;
		color: #475569;
		margin-block: 1rem;
	}
	:global(.article-editor-surface a) {
		color: #4338ca;
		text-decoration: underline;
	}
	:global(.article-editor-surface p.is-editor-empty:first-child::before) {
		color: #94a3b8;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
</style>
