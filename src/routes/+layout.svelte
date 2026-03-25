<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>VnxLynx - 文献マップビューア</title>
</svelte:head>

{@render children()}
