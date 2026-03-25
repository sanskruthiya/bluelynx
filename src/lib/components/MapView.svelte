<script lang="ts">
	import { Move, Square, Circle } from 'lucide-svelte';
	import ArticleDetail from './ArticleDetail.svelte';
	import {
		filteredArticles,
		selectedArticleIds,
		selectionTool,
		mapMode,
		focusedArticleId,
	} from '$lib/stores';
	import type { Article, SelectionTool, MapMode } from '$lib/types';

	let canvasContainer: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let tooltip = $state<{ x: number; y: number; title: string } | null>(null);

	let currentTool = $state<SelectionTool>('pan');
	let currentMode = $state<MapMode>('scatter');
	let data = $state<Article[]>([]);
	let selected = $state<Set<string>>(new Set());

	// Selection drag state
	let isDragging = $state(false);
	let dragStart = $state<{ x: number; y: number } | null>(null);
	let dragEnd = $state<{ x: number; y: number } | null>(null);

	// View transform
	let viewOffset = $state({ x: 0, y: 0 });
	let viewScale = $state(1);
	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0 });

	$effect(() => {
		const unsubs = [
			filteredArticles.subscribe((a) => { data = a; scheduleRender(); }),
			selectedArticleIds.subscribe((s) => { selected = s; scheduleRender(); }),
			selectionTool.subscribe((t) => { currentTool = t; }),
			mapMode.subscribe((m) => { currentMode = m; scheduleRender(); }),
		];
		return () => unsubs.forEach((u) => u());
	});

	let renderQueued = false;
	function scheduleRender() {
		if (renderQueued) return;
		renderQueued = true;
		requestAnimationFrame(() => {
			renderQueued = false;
			render();
		});
	}

	$effect(() => {
		if (!canvas) return;
		const resizeObserver = new ResizeObserver(() => {
			canvas.width = canvas.clientWidth * window.devicePixelRatio;
			canvas.height = canvas.clientHeight * window.devicePixelRatio;
			scheduleRender();
		});
		resizeObserver.observe(canvas);
		return () => resizeObserver.disconnect();
	});

	function worldToScreen(wx: number, wy: number): { x: number; y: number } {
		if (!canvas) return { x: 0, y: 0 };
		const w = canvas.width;
		const h = canvas.height;

		// Compute data bounds
		const bounds = getDataBounds();
		const dataW = bounds.maxX - bounds.minX || 1;
		const dataH = bounds.maxY - bounds.minY || 1;
		const padding = 40 * window.devicePixelRatio;

		const scaleX = (w - 2 * padding) / dataW;
		const scaleY = (h - 2 * padding) / dataH;
		const scale = Math.min(scaleX, scaleY) * viewScale;

		const cx = w / 2 + viewOffset.x;
		const cy = h / 2 + viewOffset.y;
		const dataCx = (bounds.minX + bounds.maxX) / 2;
		const dataCy = (bounds.minY + bounds.maxY) / 2;

		return {
			x: cx + (wx - dataCx) * scale,
			y: cy - (wy - dataCy) * scale,
		};
	}

	function screenToWorld(sx: number, sy: number): { x: number; y: number } {
		if (!canvas) return { x: 0, y: 0 };
		const w = canvas.width;
		const h = canvas.height;

		const bounds = getDataBounds();
		const dataW = bounds.maxX - bounds.minX || 1;
		const dataH = bounds.maxY - bounds.minY || 1;
		const padding = 40 * window.devicePixelRatio;

		const scaleX = (w - 2 * padding) / dataW;
		const scaleY = (h - 2 * padding) / dataH;
		const scale = Math.min(scaleX, scaleY) * viewScale;

		const cx = w / 2 + viewOffset.x;
		const cy = h / 2 + viewOffset.y;
		const dataCx = (bounds.minX + bounds.maxX) / 2;
		const dataCy = (bounds.minY + bounds.maxY) / 2;

		return {
			x: (sx - cx) / scale + dataCx,
			y: dataCy - (sy - cy) / scale,
		};
	}

	function getDataBounds() {
		if (data.length === 0) return { minX: -1, maxX: 1, minY: -1, maxY: 1 };
		let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
		for (const a of data) {
			if (a.x < minX) minX = a.x;
			if (a.x > maxX) maxX = a.x;
			if (a.y < minY) minY = a.y;
			if (a.y > maxY) maxY = a.y;
		}
		return { minX, maxX, minY, maxY };
	}

	function render() {
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const w = canvas.width;
		const h = canvas.height;
		const dpr = window.devicePixelRatio;

		ctx.clearRect(0, 0, w, h);

		if (data.length === 0) {
			ctx.fillStyle = '#475569';
			ctx.font = `${14 * dpr}px system-ui`;
			ctx.textAlign = 'center';
			ctx.fillText('TSVファイルを読み込んでください', w / 2, h / 2);
			return;
		}

		if (currentMode === 'heatmap') {
			renderHeatmap(ctx, w, h, dpr);
		} else {
			renderScatter(ctx, w, h, dpr);
		}

		// Draw selection rect/circle
		if (isDragging && dragStart && dragEnd) {
			ctx.strokeStyle = '#3b82f6';
			ctx.lineWidth = 2 * dpr;
			ctx.setLineDash([6 * dpr, 4 * dpr]);

			if (currentTool === 'rectangle') {
				const x = Math.min(dragStart.x, dragEnd.x) * dpr;
				const y = Math.min(dragStart.y, dragEnd.y) * dpr;
				const rw = Math.abs(dragEnd.x - dragStart.x) * dpr;
				const rh = Math.abs(dragEnd.y - dragStart.y) * dpr;
				ctx.strokeRect(x, y, rw, rh);
				ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
				ctx.fillRect(x, y, rw, rh);
			} else if (currentTool === 'circle') {
				const cx = ((dragStart.x + dragEnd.x) / 2) * dpr;
				const cy = ((dragStart.y + dragEnd.y) / 2) * dpr;
				const rx = (Math.abs(dragEnd.x - dragStart.x) / 2) * dpr;
				const ry = (Math.abs(dragEnd.y - dragStart.y) / 2) * dpr;
				ctx.beginPath();
				ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
				ctx.fill();
			}
			ctx.setLineDash([]);
		}
	}

	function renderScatter(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
		const hasSelection = selected.size > 0;
		const radius = 3 * dpr;

		for (const article of data) {
			const { x, y } = worldToScreen(article.x, article.y);
			const isSelected = selected.has(article.ID);

			if (hasSelection && !isSelected) {
				ctx.fillStyle = 'rgba(100, 116, 139, 0.3)';
			} else {
				ctx.fillStyle = '#3b82f6';
			}

			ctx.beginPath();
			ctx.arc(x, y, isSelected ? radius * 1.4 : radius, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function renderHeatmap(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number) {
		const cellSize = 8 * dpr;
		const cols = Math.ceil(w / cellSize);
		const rows = Math.ceil(h / cellSize);
		const grid = new Float32Array(cols * rows);

		let maxDensity = 0;
		for (const article of data) {
			const { x, y } = worldToScreen(article.x, article.y);
			const col = Math.floor(x / cellSize);
			const row = Math.floor(y / cellSize);
			// Spread to nearby cells
			for (let dr = -2; dr <= 2; dr++) {
				for (let dc = -2; dc <= 2; dc++) {
					const r = row + dr;
					const c = col + dc;
					if (r >= 0 && r < rows && c >= 0 && c < cols) {
						const dist = Math.sqrt(dr * dr + dc * dc);
						const weight = Math.max(0, 1 - dist / 3);
						grid[r * cols + c] += weight;
					}
				}
			}
		}
		for (let i = 0; i < grid.length; i++) {
			if (grid[i] > maxDensity) maxDensity = grid[i];
		}

		if (maxDensity === 0) return;

		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const val = grid[r * cols + c];
				if (val <= 0) continue;
				const t = val / maxDensity;
				const hue = (1 - t) * 240;
				ctx.fillStyle = `hsla(${hue}, 80%, 50%, ${Math.min(0.8, t + 0.1)})`;
				ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
			}
		}
	}

	function handleMouseDown(e: MouseEvent) {
		if (currentTool === 'pan') {
			isPanning = true;
			panStart = { x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y };
		} else {
			isDragging = true;
			dragStart = { x: e.offsetX, y: e.offsetY };
			dragEnd = { x: e.offsetX, y: e.offsetY };
		}
	}

	function handleMouseMove(e: MouseEvent) {
		if (isPanning) {
			viewOffset = {
				x: e.clientX - panStart.x,
				y: e.clientY - panStart.y,
			};
			scheduleRender();
			return;
		}

		if (isDragging) {
			dragEnd = { x: e.offsetX, y: e.offsetY };
			scheduleRender();
			return;
		}

		// Tooltip on hover
		if (currentMode === 'scatter' && data.length > 0) {
			const dpr = window.devicePixelRatio;
			const mx = e.offsetX * dpr;
			const my = e.offsetY * dpr;
			let found: Article | null = null;
			let minDist = 10 * dpr;

			for (const article of data) {
				const { x, y } = worldToScreen(article.x, article.y);
				const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
				if (dist < minDist) {
					minDist = dist;
					found = article;
				}
			}

			if (found) {
				tooltip = { x: e.offsetX, y: e.offsetY, title: found.title };
			} else {
				tooltip = null;
			}
		}
	}

	function handleMouseUp(e: MouseEvent) {
		if (isPanning) {
			isPanning = false;
			return;
		}

		if (isDragging && dragStart && dragEnd) {
			selectArticlesInRegion();
			isDragging = false;
			dragStart = null;
			dragEnd = null;
			scheduleRender();
		}
	}

	function handleWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY > 0 ? 0.9 : 1.1;
		viewScale = Math.max(0.1, Math.min(50, viewScale * factor));
		scheduleRender();
	}

	function selectArticlesInRegion() {
		if (!dragStart || !dragEnd) return;
		const dpr = window.devicePixelRatio;
		const ids = new Set<string>();

		const x1 = Math.min(dragStart.x, dragEnd.x) * dpr;
		const y1 = Math.min(dragStart.y, dragEnd.y) * dpr;
		const x2 = Math.max(dragStart.x, dragEnd.x) * dpr;
		const y2 = Math.max(dragStart.y, dragEnd.y) * dpr;

		if (currentTool === 'rectangle') {
			for (const a of data) {
				const { x, y } = worldToScreen(a.x, a.y);
				if (x >= x1 && x <= x2 && y >= y1 && y <= y2) {
					ids.add(a.ID);
				}
			}
		} else if (currentTool === 'circle') {
			const cx = (x1 + x2) / 2;
			const cy = (y1 + y2) / 2;
			const rx = (x2 - x1) / 2;
			const ry = (y2 - y1) / 2;
			for (const a of data) {
				const { x, y } = worldToScreen(a.x, a.y);
				const dx = (x - cx) / rx;
				const dy = (y - cy) / ry;
				if (dx * dx + dy * dy <= 1) {
					ids.add(a.ID);
				}
			}
		}

		selectedArticleIds.set(ids);
	}

	function setTool(tool: SelectionTool) {
		selectionTool.set(tool);
	}

	function handleClick(e: MouseEvent) {
		if (currentTool !== 'pan') return;
		const dpr = window.devicePixelRatio;
		const mx = e.offsetX * dpr;
		const my = e.offsetY * dpr;
		let closest: Article | null = null;
		let minDist = 10 * dpr;

		for (const a of data) {
			const { x, y } = worldToScreen(a.x, a.y);
			const dist = Math.sqrt((x - mx) ** 2 + (y - my) ** 2);
			if (dist < minDist) {
				minDist = dist;
				closest = a;
			}
		}

		if (closest) {
			focusedArticleId.set(closest.ID);
		}
	}
</script>

<div class="relative flex-1 h-full bg-slate-950" bind:this={canvasContainer}>
	<!-- Toolbar -->
	<div class="absolute left-3 top-3 z-10 flex gap-1 rounded bg-slate-800/90 p-1 shadow-lg border border-slate-700">
		<button
			class="rounded p-1.5 transition-colors {currentTool === 'pan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
			onclick={() => setTool('pan')}
			title="パン"
		>
			<Move size={16} />
		</button>
		<button
			class="rounded p-1.5 transition-colors {currentTool === 'rectangle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
			onclick={() => setTool('rectangle')}
			title="矩形選択"
		>
			<Square size={16} />
		</button>
		<button
			class="rounded p-1.5 transition-colors {currentTool === 'circle' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
			onclick={() => setTool('circle')}
			title="円形選択"
		>
			<Circle size={16} />
		</button>
	</div>

	<canvas
		bind:this={canvas}
		class="h-full w-full cursor-crosshair"
		style="cursor: {currentTool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 'crosshair'}"
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={() => { tooltip = null; isPanning = false; isDragging = false; }}
		onwheel={handleWheel}
		onclick={handleClick}
	></canvas>

	{#if tooltip}
		<div
			class="pointer-events-none absolute z-20 max-w-xs rounded bg-slate-800 px-2 py-1 text-xs text-white shadow-lg border border-slate-600"
			style="left: {tooltip.x + 12}px; top: {tooltip.y - 8}px;"
		>
			{tooltip.title}
		</div>
	{/if}

	<ArticleDetail />
</div>
