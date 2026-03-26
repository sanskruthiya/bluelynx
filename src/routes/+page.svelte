<script lang="ts">
	import { untrack } from 'svelte';
	import Header from '$lib/components/Header.svelte';
	import LeftPanel from '$lib/components/LeftPanel.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import RightPanel from '$lib/components/RightPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
	import { loadingStatus } from '$lib/stores';

	let headerRef: Header;
	let status = $state({ active: false, message: '', progress: 0 });

	$effect(() => {
		const unsub = loadingStatus.subscribe((s) => {
			untrack(() => {
				status = { active: s.active, message: s.message, progress: s.progress ?? 0 };
			});
		});
		return unsub;
	});

	function handleMapDrop(e: DragEvent) {
		e.preventDefault();
		const file = e.dataTransfer?.files?.[0];
		if (file && headerRef) headerRef.loadFile(file);
	}
</script>

<div class="relative flex h-screen flex-col overflow-hidden">
	<Header bind:this={headerRef} />

	<div class="flex flex-1 overflow-hidden">
		<!-- Left Panel: Search / Filter / Article List (20%) -->
		<div class="w-1/5 min-w-[240px] max-w-[320px] flex-shrink-0">
			<LeftPanel />
		</div>

		<!-- Center: Map View (flexible) -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="flex-1 min-w-0"
			ondragover={(e) => e.preventDefault()}
			ondrop={handleMapDrop}
		>
			<MapView />
		</div>

		<!-- Right Panel: AI Chat (25%) -->
		<div class="w-1/4 min-w-[300px] max-w-[420px] flex-shrink-0">
			<RightPanel />
		</div>
	</div>

	<StatusBar />

	{#if status.active}
		<div class="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
			<div class="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl">
				<div class="flex items-center gap-3 mb-4">
					<div class="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent"></div>
					<p class="text-sm font-medium text-slate-200">{status.message}</p>
				</div>
				{#if status.progress > 0}
					<div class="h-2 w-full overflow-hidden rounded-full bg-slate-700">
						<div
							class="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500 ease-out"
							style="width: {status.progress}%"
						></div>
					</div>
					<p class="mt-2 text-right text-xs text-slate-500">{status.progress}%</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
