<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
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
</section>
