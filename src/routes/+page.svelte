<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import LeftPanel from '$lib/components/LeftPanel.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import RightPanel from '$lib/components/RightPanel.svelte';
	import StatusBar from '$lib/components/StatusBar.svelte';
</script>

<div class="flex h-screen flex-col overflow-hidden">
	<Header />

	<div class="flex flex-1 overflow-hidden">
		<!-- Left Panel: Search / Filter / Article List (20%) -->
		<div class="w-1/5 min-w-[240px] max-w-[320px] flex-shrink-0">
			<LeftPanel />
		</div>

		<!-- Center: Map View (flexible) -->
		<div class="flex-1 min-w-0">
			<MapView />
		</div>

		<!-- Right Panel: AI Chat (25%) -->
		<div class="w-1/4 min-w-[300px] max-w-[420px] flex-shrink-0">
			<RightPanel />
		</div>
	</div>

	<StatusBar />
</div>
