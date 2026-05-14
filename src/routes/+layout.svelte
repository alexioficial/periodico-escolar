<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';

	const LOGO_URL = 'https://cdn.widube.com/logo.svg';
	import ToastHost from '$lib/components/ToastHost.svelte';
	import ConfirmDialog from '$lib/components/ConfirmDialog.svelte';

	let { children, data } = $props();

	const getLinks = (user: typeof data.user) => {
		const baseLinks = [{ href: '/feed', label: 'Inicio' }];

		if (user) {
			baseLinks.push({ href: '/perfil/guardados', label: 'Guardados' });
		}

		baseLinks.push({ href: '/redaccion', label: 'Redacción' });

		if (!user) return baseLinks;

		if (user.role === 'admin' || user.role === 'superadmin') {
			baseLinks.push({ href: '/redaccion/verificar', label: 'Verificar' });
		}

		if (user.role === 'superadmin') {
			baseLinks.push({ href: '/admin/categories', label: 'Categorías' });
			baseLinks.push({ href: '/admin/users', label: 'Usuarios' });
		}

		return baseLinks;
	};

	const links = $derived(getLinks(data.user));

	const isActive = (href: string) => {
		const path = page.url.pathname;
		return path === href || path.startsWith(`${href}/`);
	};
</script>

<svelte:head>
	<title>Periódico escolar</title>
	<link rel="icon" type="image/svg+xml" href={LOGO_URL} />
	<link rel="apple-touch-icon" href={LOGO_URL} />
</svelte:head>

<div class="min-h-screen bg-slate-50 text-slate-900">
	<header class="border-b border-slate-200 bg-white/80 backdrop-blur">
		<div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href="/feed" class="flex items-center gap-2">
				<img src={LOGO_URL} alt="Logo" class="h-8 w-8" />
				<div class="flex flex-col">
					<span class="text-sm font-semibold tracking-tight">Periódico escolar</span>
					<span class="text-[11px] leading-tight text-slate-500">Tu escuela</span>
				</div>
			</a>

			<nav class="flex items-center gap-4">
				<div
					class="hidden items-center gap-1 rounded-full bg-slate-100 px-1 py-1 text-xs text-slate-600 sm:flex"
				>
					{#each links as link (link.href)}
						<a
							href={link.href}
							aria-current={isActive(link.href) ? 'page' : undefined}
							class={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 transition-colors ${
								isActive(link.href)
									? 'bg-white text-slate-900 shadow-sm'
									: 'text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
							}`}
						>
							{link.label}
						</a>
					{/each}
				</div>

				<div class="flex items-center gap-3 text-xs text-slate-600">
					{#if data.user}
						{@const displayName =
							data.user.username || data.user.name || data.user.email.split('@')[0]}
						{@const initials = (data.user.name || data.user.username || data.user.email)
							.slice(0, 2)
							.toUpperCase()}
						<a
							href="/perfil"
							aria-current={isActive('/perfil') ? 'page' : undefined}
							class="flex items-center gap-2 rounded-full border border-transparent px-2 py-1 text-slate-700 transition-colors hover:border-slate-200 hover:bg-slate-50"
						>
							<span
								class="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-[10px] font-semibold text-slate-600"
							>
								{#if data.user.picture}
									<img src={data.user.picture} alt="Tu foto" class="h-full w-full object-cover" />
								{:else}
									{initials}
								{/if}
							</span>
							<span class="hidden text-xs font-medium sm:inline">{displayName}</span>
						</a>
						<form method="POST" action="/auth/logout">
							<button
								type="submit"
								class="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-800 transition-colors hover:bg-slate-50"
							>
								Cerrar sesión
							</button>
						</form>
					{:else}
						<a
							href="/auth/login"
							class="rounded-full bg-slate-900 px-4 py-1.5 text-xs font-semibold text-slate-50 transition-colors hover:bg-slate-800"
						>
							Iniciar sesión
						</a>
					{/if}
				</div>
			</nav>
		</div>
	</header>

	<main class="mx-auto max-w-5xl px-4 py-6">
		{@render children()}
	</main>

	<ToastHost />
	<ConfirmDialog />
</div>
