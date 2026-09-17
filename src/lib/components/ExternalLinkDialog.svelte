<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from '$lib/toast';
	import { createExternalLinkFlow, decideArticleLink } from '$lib/externalLinks';
	import { getTrustedDomainFromUrl } from '$lib/trustedDomains';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/scrollLock';
	let { user }: { user: App.Locals['user'] } = $props();
	let pending = $state<{ href: string; hostname: string; accountId: string | null } | null>(null);
	let trust = $state(false);
	const flow = createExternalLinkFlow({
		open: (href) => {
			window.open(href, '_blank', 'noopener,noreferrer');
		},
		saveTrust: async (href) => {
			const response = await fetch('/api/profile/trusted-domains', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url: href })
			});
			if (!response.ok) throw new Error('save failed');
			const body = await response.json();
			if (body.ok !== true || !Array.isArray(body.trustedDomains))
				throw new Error('invalid response');
		},
		onSaved: () => invalidateAll(),
		onError: () =>
			toast.error('El enlace se abrió, pero no pudimos recordar tu confianza en este sitio.')
	});
	function cancel() {
		flow.cancel();
		pending = null;
		trust = false;
	}
	function continueToSite() {
		const shouldTrust = Boolean(trust && user && pending?.accountId === user._id);
		void flow.continue(shouldTrust);
		pending = null;
		trust = false;
	}
	$effect(() => {
		if (pending && pending.accountId !== (user?._id ?? null)) cancel();
	});
	function showDialog(element: HTMLDialogElement) {
		const previous = document.activeElement as HTMLElement | null;
		lockBodyScroll();
		element.showModal();
		element.querySelector<HTMLButtonElement>('[data-cancel]')?.focus();
		return {
			destroy() {
				element.close();
				unlockBodyScroll();
				previous?.focus();
			}
		};
	}
	onMount(() => {
		const intercept = (event: MouseEvent) => {
			if (event.defaultPrevented || (event.type === 'auxclick' && event.button !== 1)) return;
			const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]');
			if (
				!anchor ||
				!anchor.closest('[data-article-content]') ||
				anchor.closest('[contenteditable="true"]')
			)
				return;
			const raw = anchor.getAttribute('href') ?? '';
			const decision = decideArticleLink(
				raw.startsWith('#') ? anchor.href : raw,
				location.origin,
				user
			);
			if (decision.kind === 'internal') return;
			event.preventDefault();
			event.stopImmediatePropagation();
			if (decision.kind === 'blocked') {
				toast.error('Este enlace no es válido.');
				return;
			}
			if (decision.kind === 'trusted') {
				window.open(decision.href, '_blank', 'noopener,noreferrer');
				return;
			}
			trust = false;
			pending = { href: decision.href, hostname: decision.hostname, accountId: user?._id ?? null };
			flow.request(decision.href);
		};
		document.addEventListener('click', intercept, true);
		document.addEventListener('auxclick', intercept, true);
		return () => {
			document.removeEventListener('click', intercept, true);
			document.removeEventListener('auxclick', intercept, true);
		};
	});
</script>

{#if pending}
	<dialog
		use:showDialog
		oncancel={(event) => {
			event.preventDefault();
			cancel();
		}}
		aria-labelledby="external-link-title"
		aria-describedby="external-link-description"
		class="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
	>
		<p class="mb-3 text-xs font-semibold tracking-widest text-indigo-600 uppercase">
			Enlace externo
		</p>
		<h2 id="external-link-title" class="text-xl font-bold">Estás por salir del periódico</h2>
		<p class="my-5 rounded-lg bg-slate-50 p-3 font-semibold break-all text-slate-800">
			{pending.hostname}
		</p>
		<p id="external-link-description" class="text-sm text-slate-600">
			Continúa solo si reconoces y confías en este sitio
		</p>
		{#if user && getTrustedDomainFromUrl(pending.href)}
			<label class="mt-5 flex items-start gap-3 text-sm text-slate-700"
				><input
					type="checkbox"
					bind:checked={trust}
					class="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
				/>Confiar siempre en este sitio</label
			>
		{/if}
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				data-cancel
				onclick={cancel}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
				>Volver</button
			>
			<button
				type="button"
				onclick={continueToSite}
				class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
				>Continuar</button
			>
		</div>
	</dialog>
{/if}
