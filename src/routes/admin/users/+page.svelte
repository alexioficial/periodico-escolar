<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	let { data } = $props();

	let emailSearch = $state(data.emailFilter || '');

	function handleSearch() {
		const params = new URLSearchParams();
		if (emailSearch) params.set('email', emailSearch);
		params.set('page', '1');
		goto(`/admin/users?${params.toString()}`);
	}

	function goToPage(page: number) {
		const params = new URLSearchParams();
		if (emailSearch) params.set('email', emailSearch);
		params.set('page', page.toString());
		goto(`/admin/users?${params.toString()}`);
	}
</script>

<section class="space-y-8">
	<header class="space-y-3">
		<p class="text-xs tracking-[0.25em] text-slate-500 uppercase">Super Admin</p>
		<h1 class="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
			Gestión de Usuarios
		</h1>
		<p class="max-w-2xl text-sm text-slate-600">
			Administra los roles de los usuarios. Asciende a usuarios de confianza para que sean
			administradores y ayuden a verificar contenido.
		</p>
	</header>

	<!-- Search Bar -->
	<div class="flex items-center gap-3">
		<div class="flex-1">
			<input
				type="text"
				bind:value={emailSearch}
				placeholder="Buscar por correo..."
				class="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
				onkeydown={(e) => e.key === 'Enter' && handleSearch()}
			/>
		</div>
		<button
			onclick={handleSearch}
			class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
		>
			Buscar
		</button>
		{#if data.emailFilter}
			<button
				onclick={() => {
					emailSearch = '';
					handleSearch();
				}}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
			>
				Limpiar
			</button>
		{/if}
	</div>

	<!-- User Count -->
	<p class="text-sm text-slate-600">
		Mostrando {data.users.length} de {data.pagination.totalUsers} usuarios
	</p>

	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<table class="min-w-full divide-y divide-slate-200">
			<thead class="bg-slate-50">
				<tr>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
						>Usuario</th
					>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
						>Email</th
					>
					<th
						scope="col"
						class="px-6 py-3 text-left text-xs font-medium tracking-wider text-slate-500 uppercase"
						>Rol Actual</th
					>
					<th
						scope="col"
						class="px-6 py-3 text-right text-xs font-medium tracking-wider text-slate-500 uppercase"
						>Acciones</th
					>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200 bg-white">
				{#each data.users as user}
					<tr>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="flex items-center">
								<div
									class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500"
								>
									{user.email[0].toUpperCase()}
								</div>
								<div class="ml-4">
									<div class="text-sm font-medium text-slate-900">
										{user.username || 'Sin nombre'}
									</div>
								</div>
							</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<div class="text-sm text-slate-500">{user.email}</div>
						</td>
						<td class="px-6 py-4 whitespace-nowrap">
							<span
								class="inline-flex rounded-full px-2 text-xs leading-5 font-semibold
								{user.role === 'superadmin'
									? 'bg-purple-100 text-purple-800'
									: user.role === 'admin'
										? 'bg-indigo-100 text-indigo-800'
										: 'bg-slate-100 text-slate-800'}"
							>
								{user.role || 'user'}
							</span>
						</td>
						<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
							{#if user.role !== 'superadmin'}
								{#if user.role === 'admin'}
									<form method="POST" action="?/demote" use:enhance class="inline">
										<input type="hidden" name="id" value={user._id} />
										<button type="submit" class="text-amber-600 hover:text-amber-900"
											>Degradar a Usuario</button
										>
									</form>
								{:else}
									<form method="POST" action="?/promote" use:enhance class="inline">
										<input type="hidden" name="id" value={user._id} />
										<button type="submit" class="text-indigo-600 hover:text-indigo-900"
											>Ascender a Admin</button
										>
									</form>
								{/if}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if data.pagination.totalPages > 1}
		<div class="flex items-center justify-between border-t border-slate-200 pt-4">
			<button
				onclick={() => goToPage(data.pagination.currentPage - 1)}
				disabled={!data.pagination.hasPrevPage}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Anterior
			</button>

			<div class="flex items-center gap-2">
				{#each Array(data.pagination.totalPages) as _, i}
					{#if i + 1 === data.pagination.currentPage || i + 1 === 1 || i + 1 === data.pagination.totalPages || (i + 1 >= data.pagination.currentPage - 1 && i + 1 <= data.pagination.currentPage + 1)}
						<button
							onclick={() => goToPage(i + 1)}
							class={`rounded-lg px-3 py-1.5 text-sm font-medium ${
								i + 1 === data.pagination.currentPage
									? 'bg-indigo-600 text-white'
									: 'border border-slate-300 text-slate-700 hover:bg-slate-50'
							}`}
						>
							{i + 1}
						</button>
					{:else if (i + 1 === data.pagination.currentPage - 2 && data.pagination.currentPage > 3) || (i + 1 === data.pagination.currentPage + 2 && data.pagination.currentPage < data.pagination.totalPages - 2)}
						<span class="px-2 text-slate-400">...</span>
					{/if}
				{/each}
			</div>

			<button
				onclick={() => goToPage(data.pagination.currentPage + 1)}
				disabled={!data.pagination.hasNextPage}
				class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
			>
				Siguiente
			</button>
		</div>
	{/if}
</section>
