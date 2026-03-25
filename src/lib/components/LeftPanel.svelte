<script lang="ts">
	import { Search, RotateCcw, ChevronDown } from 'lucide-svelte';
	import {
		searchQuery,
		searchMode,
		columnFilters,
		columnMetas,
		filteredArticles,
		filteredCount,
		selectedArticleIds,
		focusedArticleId,
	} from '$lib/stores';
	import type { SearchMode, ColumnFilter, ColumnMeta } from '$lib/types';

	let query = $state('');
	let mode = $state<SearchMode>('and');
	let regexError = $state<string | null>(null);
	let expandedFilters = $state<Set<string>>(new Set());

	let metas = $state<ColumnMeta[]>([]);
	let filtered = $state<{ ID: string; title: string; affiliation: string }[]>([]);
	let fCount = $state(0);
	let selectedIds = $state<Set<string>>(new Set());

	$effect(() => {
		const unsub = columnMetas.subscribe((m) => (metas = m));
		return unsub;
	});
	$effect(() => {
		const unsub = filteredArticles.subscribe((a) =>
			(filtered = a.map((ar) => ({ ID: ar.ID, title: ar.title, affiliation: ar.affiliation }))),
		);
		return unsub;
	});
	$effect(() => {
		const unsub = filteredCount.subscribe((c) => (fCount = c));
		return unsub;
	});
	$effect(() => {
		const unsub = selectedArticleIds.subscribe((s) => (selectedIds = s));
		return unsub;
	});

	function handleSearchInput(value: string) {
		query = value;
		if (mode === 'regex') {
			try {
				new RegExp(value);
				regexError = null;
			} catch (e) {
				regexError = (e as Error).message;
			}
		} else {
			regexError = null;
		}
		searchQuery.set(value);
	}

	function handleModeChange(newMode: SearchMode) {
		mode = newMode;
		searchMode.set(newMode);
		handleSearchInput(query);
	}

	function resetFilters() {
		query = '';
		searchQuery.set('');
		columnFilters.set([]);
		selectedArticleIds.set(new Set());
	}

	function toggleFilterExpand(name: string) {
		const next = new Set(expandedFilters);
		if (next.has(name)) next.delete(name);
		else next.add(name);
		expandedFilters = next;
	}

	function handleStringFilterChange(colName: string, value: string, checked: boolean) {
		columnFilters.update((filters) => {
			const existing = filters.find((f) => f.column === colName);
			if (existing && existing.type === 'string') {
				const vals = new Set(existing.selectedValues);
				if (checked) vals.add(value);
				else vals.delete(value);
				if (vals.size === 0) return filters.filter((f) => f.column !== colName);
				return filters.map((f) => (f.column === colName ? { ...f, selectedValues: vals } : f));
			}
			if (checked) {
				return [...filters, { column: colName, type: 'string', selectedValues: new Set([value]) }];
			}
			return filters;
		});
	}

	function handleRangeFilterChange(colName: string, min: number, max: number) {
		columnFilters.update((filters) => {
			const existing = filters.find((f) => f.column === colName);
			if (existing) {
				return filters.map((f) => (f.column === colName ? { ...f, rangeMin: min, rangeMax: max } : f));
			}
			return [...filters, { column: colName, type: 'number', rangeMin: min, rangeMax: max }];
		});
	}

	function handleArticleClick(id: string) {
		focusedArticleId.set(id);
	}
</script>

<div class="flex h-full flex-col overflow-hidden border-r border-slate-700 bg-slate-900">
	<!-- Search -->
	<div class="border-b border-slate-700 p-3">
		<div class="relative">
			<Search size={14} class="absolute left-2.5 top-2.5 text-slate-500" />
			<input
				type="text"
				value={query}
				oninput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
				placeholder="キーワード検索..."
				class="w-full rounded bg-slate-800 border border-slate-600 py-2 pl-8 pr-3 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
			/>
		</div>
		{#if regexError}
			<p class="mt-1 text-xs text-red-400">{regexError}</p>
		{/if}
		<div class="mt-2 flex gap-1">
			{#each [['and', 'AND'], ['or', 'OR'], ['regex', '正規表現']] as [value, label]}
				<button
					class="rounded px-2 py-0.5 text-xs transition-colors {mode === value ? 'bg-blue-600 text-white' : 'border border-slate-600 text-slate-400 hover:text-white'}"
					onclick={() => handleModeChange(value as SearchMode)}
				>
					{label}
				</button>
			{/each}
			<div class="flex-1"></div>
			<button
				class="text-xs text-slate-500 hover:text-white transition-colors"
				onclick={resetFilters}
				title="フィルタリセット"
			>
				<RotateCcw size={14} />
			</button>
		</div>
	</div>

	<!-- Dynamic Filters -->
	{#if metas.length > 0}
		<div class="flex-shrink-0 overflow-y-auto border-b border-slate-700" style="max-height: 40%;">
			<div class="p-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">フィルタ</div>
			{#each metas.filter((m) => m.name !== 'ID' && m.name !== 'abstract') as meta}
				<div class="border-t border-slate-800">
					<button
						class="flex w-full items-center justify-between px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
						onclick={() => toggleFilterExpand(meta.name)}
					>
						<span class="font-medium">{meta.name}</span>
						<ChevronDown
							size={12}
							class="transition-transform {expandedFilters.has(meta.name) ? 'rotate-180' : ''}"
						/>
					</button>
					{#if expandedFilters.has(meta.name)}
						<div class="px-3 pb-2">
							{#if meta.type === 'number'}
								<div class="flex items-center gap-2 text-xs">
									<input
										type="number"
										class="w-20 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-white"
										placeholder={String(meta.min ?? '')}
										oninput={(e) => {
											const val = parseFloat((e.target as HTMLInputElement).value);
											handleRangeFilterChange(meta.name, isNaN(val) ? meta.min! : val, meta.max!);
										}}
									/>
									<span class="text-slate-500">〜</span>
									<input
										type="number"
										class="w-20 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-white"
										placeholder={String(meta.max ?? '')}
										oninput={(e) => {
											const val = parseFloat((e.target as HTMLInputElement).value);
											handleRangeFilterChange(meta.name, meta.min!, isNaN(val) ? meta.max! : val);
										}}
									/>
								</div>
							{:else if meta.uniqueValues}
								<div class="max-h-32 overflow-y-auto space-y-0.5">
									{#each meta.uniqueValues.slice(0, 50) as val}
										<label class="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white cursor-pointer">
											<input
												type="checkbox"
												class="rounded border-slate-600"
												onchange={(e) =>
													handleStringFilterChange(meta.name, val, (e.target as HTMLInputElement).checked)}
											/>
											<span class="truncate">{val}</span>
										</label>
									{/each}
									{#if meta.uniqueValues.length > 50}
										<p class="text-xs text-slate-600">...他 {meta.uniqueValues.length - 50} 件</p>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Article List -->
	<div class="flex-1 overflow-y-auto">
		<div class="flex items-center justify-between p-2">
			<span class="text-xs font-semibold text-slate-500 uppercase tracking-wider">文献リスト</span>
			<span class="text-xs text-slate-500">{fCount.toLocaleString()} 件</span>
		</div>
		<div class="space-y-0">
			{#each filtered.slice(0, 200) as article}
				<button
					class="block w-full border-t border-slate-800 px-3 py-2 text-left transition-colors hover:bg-slate-800 {selectedIds.has(article.ID) ? 'bg-blue-900/30 border-l-2 border-l-blue-500' : ''}"
					onclick={() => handleArticleClick(article.ID)}
				>
					<p class="text-xs font-medium text-slate-200 line-clamp-2">{article.title}</p>
					<p class="mt-0.5 text-xs text-slate-500 truncate">{article.affiliation}</p>
				</button>
			{/each}
			{#if fCount > 200}
				<p class="p-3 text-xs text-slate-600 text-center">先頭200件を表示中（全{fCount.toLocaleString()}件）</p>
			{/if}
		</div>
	</div>
</div>
