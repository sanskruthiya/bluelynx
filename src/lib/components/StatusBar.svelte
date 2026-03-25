<script lang="ts">
	import { untrack } from 'svelte';
	import { filteredCount, selectedCount, articles, searchQuery, searchMode, columnFilters } from '$lib/stores';

	let total = $state(0);
	let filtered = $state(0);
	let selected = $state(0);
	let query = $state('');
	let mode = $state('and');
	let filterCount = $state(0);

	$effect(() => {
		const unsubs = [
			articles.subscribe((a) => { untrack(() => { total = a.length; }); }),
			filteredCount.subscribe((c) => { untrack(() => { filtered = c; }); }),
			selectedCount.subscribe((c) => { untrack(() => { selected = c; }); }),
			searchQuery.subscribe((q) => { untrack(() => { query = q; }); }),
			searchMode.subscribe((m) => { untrack(() => { mode = m; }); }),
			columnFilters.subscribe((f) => { untrack(() => { filterCount = f.length; }); }),
		];
		return () => unsubs.forEach((u) => u());
	});
</script>

<footer class="flex items-center gap-4 border-t border-slate-700 bg-slate-900 px-4 py-1.5 text-xs text-slate-500">
	{#if total > 0}
		<span>全 {total.toLocaleString()} 件</span>
		<span>表示: {filtered.toLocaleString()} 件</span>
		{#if selected > 0}
			<span class="text-cyan-400">選択: {selected} 件</span>
		{/if}
		{#if query}
			<span>検索: "{query}" ({mode.toUpperCase()})</span>
		{/if}
		{#if filterCount > 0}
			<span>フィルタ: {filterCount} 件適用中</span>
		{/if}
	{:else}
		<span>TSVファイルを読み込んでください</span>
	{/if}
</footer>
