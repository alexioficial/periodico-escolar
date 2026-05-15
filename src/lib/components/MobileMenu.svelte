<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { lockBodyScroll, unlockBodyScroll } from '$lib/scrollLock';

	type MobileUser = {
		email: string;
		username?: string | null;
		name?: string | null;
		picture?: string | null;
		role?: string;
	};

	type Link = { href: string; label: string };

	type Props = {
		open: boolean;
		user: MobileUser | null | undefined;
		links: Link[];
		logoUrl: string;
		isActive: (href: string) => boolean;
		onClose: () => void;
		onLogout: () => void;
		loggingOut?: boolean;
	};

	let { open, user, links, logoUrl, isActive, onClose, onLogout, loggingOut = false }: Props =
		$props();

	const displayName = $derived(user ? user.username || user.name || user.email.split('@')[0] : '');
	const initials = $derived(
		user ? (user.name || user.username || user.email).slice(0, 2).toUpperCase() : ''
	);

	// Scroll lock con contador (compartido) y Escape global mientras el menú
	// esté abierto. Sin contador, dos componentes que lockean concurrentemente
	// podían dejar el body bloqueado al cerrar uno.
	$effect(() => {
		if (!open) return;
		lockBodyScroll();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		window.addEventListener('keydown', onKey);
		return () => {
			unlockBodyScroll();
			window.removeEventListener('keydown', onKey);
		};
	});
</script>

{#if open}
	<!-- Backdrop como <button> nativo: tiene click + keyboard a11y gratis y
	evita el anti-patrón role="button" sobre un <div>. -->
	<button
		type="button"
		aria-label="Cerrar menú"
		onclick={onClose}
		class="fixed inset-0 z-40 cursor-default bg-slate-900/40 backdrop-blur-sm"
		transition:fade={{ duration: 150 }}
	></button>

	<div
		class="fixed inset-0 z-50 flex flex-col bg-white"
		transition:fly={{ x: 320, duration: 220, opacity: 1 }}
		role="dialog"
		aria-modal="true"
		aria-label="Menú principal"
	>
		<header class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
			<div class="flex items-center gap-2">
				<img src={logoUrl} alt="Logo" class="h-8 w-8" />
				<span class="text-sm font-semibold tracking-tight text-slate-900">Periódico escolar</span>
			</div>
			<button
				type="button"
				onclick={onClose}
				aria-label="Cerrar menú"
				class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50"
			>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					class="h-5 w-5"
					aria-hidden="true"
				>
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</header>

		<nav class="flex-1 overflow-y-auto px-3 py-4">
			<ul class="space-y-1">
				{#each links as link (link.href)}
					<li>
						<a
							href={link.href}
							onclick={onClose}
							aria-current={isActive(link.href) ? 'page' : undefined}
							class={`flex items-center rounded-xl px-4 py-3 text-base font-medium transition-colors ${
								isActive(link.href)
									? 'bg-slate-900 text-white'
									: 'text-slate-700 hover:bg-slate-100'
							}`}
						>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<footer class="border-t border-slate-200 bg-slate-50 px-4 py-4">
			{#if user}
				<a
					href="/perfil"
					onclick={onClose}
					aria-current={isActive('/perfil') ? 'page' : undefined}
					class="flex items-center gap-3 rounded-xl bg-white p-3 transition-colors hover:bg-slate-100"
				>
					<span
						class="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600"
					>
						{#if user.picture}
							<img src={user.picture} alt="Tu foto" class="h-full w-full object-cover" />
						{:else}
							{initials}
						{/if}
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate text-sm font-semibold text-slate-900">{displayName}</span>
						<span class="truncate text-xs text-slate-500">{user.email}</span>
					</span>
				</a>
				<button
					type="button"
					onclick={onLogout}
					disabled={loggingOut}
					class="mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100 disabled:opacity-60"
				>
					{loggingOut ? 'Cerrando…' : 'Cerrar sesión'}
				</button>
			{:else}
				<a
					href="/auth/login"
					onclick={onClose}
					class="block w-full rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-slate-50 transition-colors hover:bg-slate-800"
				>
					Iniciar sesión
				</a>
			{/if}
		</footer>
	</div>
{/if}
