<script lang="ts">
	// contentHtml is produced by server presentation helpers only, never editor HTML.
	let {
		content,
		contentHtml,
		compact = false
	}: { content: string; contentHtml?: string; compact?: boolean } = $props();
</script>

<div data-article-content class:compact class="article-prose text-slate-700">
	{#if contentHtml !== undefined}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html contentHtml}
	{:else}
		<p class="whitespace-pre-wrap">{content}</p>
	{/if}
</div>

<style>
	.article-prose {
		overflow-wrap: anywhere;
		font-size: 1.125rem;
		line-height: 1.8;
	}
	.article-prose.compact {
		font-size: 0.875rem;
		line-height: 1.7;
		margin-bottom: 1rem;
	}
	.article-prose :global(p + p),
	.article-prose :global(p + ul),
	.article-prose :global(p + ol) {
		margin-top: 0.8em;
	}
	.article-prose :global(h2) {
		font-size: 1.65em;
		font-weight: 700;
		line-height: 1.25;
		margin: 1.2em 0 0.5em;
		color: #0f172a;
	}
	.article-prose :global(h3) {
		font-size: 1.3em;
		font-weight: 700;
		line-height: 1.35;
		margin: 1em 0 0.5em;
		color: #0f172a;
	}
	.article-prose :global(ul) {
		list-style: disc;
		padding-left: 1.5em;
		margin-block: 0.75em;
	}
	.article-prose :global(ol) {
		list-style: decimal;
		padding-left: 1.5em;
		margin-block: 0.75em;
	}
	.article-prose :global(li + li) {
		margin-top: 0.25em;
	}
	.article-prose :global(blockquote) {
		border-left: 3px solid #a5b4fc;
		padding: 0.4em 1em;
		margin-block: 1em;
		color: #475569;
	}
	.article-prose :global(a) {
		color: #4338ca;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.article-prose :global(a:hover) {
		color: #312e81;
	}
	.article-prose :global(a:focus-visible) {
		outline: 2px solid #6366f1;
		outline-offset: 3px;
		border-radius: 2px;
	}
	.article-prose :global(:first-child) {
		margin-top: 0;
	}
</style>
