<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>LitLynx - 文献マップビューア</title>
</svelte:head>

{@render children()}
