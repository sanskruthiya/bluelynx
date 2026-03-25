<script lang="ts">
	import { X } from 'lucide-svelte';
	import { focusedArticle, focusedArticleId } from '$lib/stores';
	import type { Article } from '$lib/types';
	import { REQUIRED_COLUMNS } from '$lib/types';

	let article = $state<Article | null>(null);

	$effect(() => {
		const unsub = focusedArticle.subscribe((a) => (article = a));
		return unsub;
	});

	function close() {
		focusedArticleId.set(null);
	}

	function getExtraFields(a: Article): [string, string | number][] {
		const skip = new Set<string>([...REQUIRED_COLUMNS, 'x', 'y']);
		return Object.entries(a).filter(([k]) => !skip.has(k));
	}
</script>

{#if article}
	<div class="absolute inset-x-0 bottom-0 z-30 max-h-[45%] overflow-y-auto rounded-t-lg border-t border-slate-600 bg-slate-900/95 shadow-2xl backdrop-blur-sm">
		<div class="sticky top-0 flex items-start justify-between border-b border-slate-700 bg-slate-900/95 px-4 py-3">
			<div class="flex-1 min-w-0 pr-4">
				<p class="text-xs text-cyan-400 font-mono">{article.ID}</p>
				<h3 class="mt-0.5 text-sm font-bold text-white leading-snug">{article.title}</h3>
			</div>
			<button
				class="flex-shrink-0 rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-white transition-colors"
				onclick={close}
			>
				<X size={16} />
			</button>
		</div>
		<div class="px-4 py-3 space-y-3 text-sm">
			<div>
				<span class="text-xs font-semibold text-slate-500 uppercase">Abstract</span>
				<p class="mt-1 text-slate-300 leading-relaxed">{article.abstract}</p>
			</div>
			<div class="grid grid-cols-2 gap-3">
				<div>
					<span class="text-xs font-semibold text-slate-500 uppercase">Affiliation</span>
					<p class="mt-0.5 text-slate-300">{article.affiliation}</p>
				</div>
				<div>
					<span class="text-xs font-semibold text-slate-500 uppercase">Year</span>
					<p class="mt-0.5 text-slate-300">{article.year}</p>
				</div>
				<div>
					<span class="text-xs font-semibold text-slate-500 uppercase">Coordinates</span>
					<p class="mt-0.5 text-slate-300 font-mono text-xs">({article.x.toFixed(2)}, {article.y.toFixed(2)})</p>
				</div>
			</div>
			{#if getExtraFields(article).length > 0}
				<div class="border-t border-slate-800 pt-2">
					<div class="grid grid-cols-2 gap-3">
						{#each getExtraFields(article) as [key, value]}
							<div>
								<span class="text-xs font-semibold text-slate-500 uppercase">{key}</span>
								<p class="mt-0.5 text-slate-300">{value}</p>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
