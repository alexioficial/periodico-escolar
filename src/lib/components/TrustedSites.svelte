<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { sanitizeTrustedDomains } from '$lib/trustedDomains';
	let { domains }: { domains: string[] } = $props();
	let removing = $state<string | null>(null);
	let error = $state('');
	const sites = $derived(sanitizeTrustedDomains(domains));
	async function remove(domain: string) {
		if (removing) return;
		removing = domain;
		error = '';
		try {
			const response = await fetch('/api/profile/trusted-domains', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ domain })
			});
			if (!response.ok) throw new Error('remove failed');
			await invalidateAll();
		} catch {
			error = 'No se pudo dejar de confiar en este sitio. Intenta de nuevo.';
		} finally {
			removing = null;
		}
	}
</script>

<section
	class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
	aria-labelledby="trusted-sites-title"
>
	<div>
		<h2 id="trusted-sites-title" class="text-lg font-semibold text-slate-900">
			Sitios de confianza
		</h2>
		<p class="mt-1 text-sm text-slate-600">Estos sitios se abren sin mostrar el aviso de salida.</p>
	</div>
	{#if sites.length === 0}<p class="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
			Todavía no has elegido sitios de confianza. Puedes hacerlo al abrir un enlace externo.
		</p>
	{:else}<ul class="divide-y divide-slate-100">
			{#each sites as domain (domain)}<li
					class="flex flex-wrap items-center justify-between gap-3 py-3"
				>
					<span class="min-w-0 text-sm break-all text-slate-700">{domain}</span><button
						type="button"
						disabled={removing !== null}
						onclick={() => remove(domain)}
						aria-label={`Dejar de confiar en ${domain}`}
						class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>{removing === domain ? 'Actualizando…' : 'Dejar de confiar'}</button
					>
				</li>{/each}
		</ul>{/if}
	{#if error}<p role="alert" class="text-sm text-red-600">{error}</p>{/if}
</section>
