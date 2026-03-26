<script lang="ts">
	import { untrack } from 'svelte';
	import { FileUp, Settings, Map, Flame, Loader2, HelpCircle } from 'lucide-svelte';
	import { articles, columnMetas, mapMode, apiKeys, loadingStatus } from '$lib/stores';
	import { parseTSV } from '$lib/tsv-parser';
	import type { ParseResult } from '$lib/tsv-parser';
	import type { MapMode } from '$lib/types';

	let showSettings = $state(false);
	let showHelp = $state(false);
	let parseErrors = $state<string[]>([]);
	let isLoading = $state(false);
	let loadingMessage = $state('');

	function setStatus(message: string, progress?: number) {
		loadingMessage = message;
		loadingStatus.set({ active: true, message, progress });
	}

	function clearStatus() {
		isLoading = false;
		loadingStatus.set({ active: false, message: '' });
	}
	let fileInput: HTMLInputElement;
	let geminiKey = $state('');
	let claudeKey = $state('');

	// Load API keys from localStorage on mount
	$effect(() => {
		if (typeof window !== 'undefined') {
			const stored = localStorage.getItem('litlynx-api-keys');
			if (stored) {
				try {
					const keys = JSON.parse(stored);
					geminiKey = keys.gemini ?? '';
					claudeKey = keys.claude ?? '';
					apiKeys.set(keys);
				} catch { /* ignore */ }
			}
		}
	});

	function saveApiKeys() {
		const keys: Record<string, string> = {};
		if (geminiKey.trim()) keys.gemini = geminiKey.trim();
		if (claudeKey.trim()) keys.claude = claudeKey.trim();
		apiKeys.set(keys);
		if (typeof window !== 'undefined') {
			localStorage.setItem('litlynx-api-keys', JSON.stringify(keys));
		}
		showSettings = false;
	}

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		readFile(file);
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (!file) return;
		readFile(file);
	}

	function readFile(file: File) {
		isLoading = true;
		setStatus(`📂 ${file.name} を読み込み中... (${(file.size / 1024 / 1024).toFixed(1)} MB)`, 10);
		parseErrors = [];

		const reader = new FileReader();
		reader.onprogress = (e) => {
			if (e.lengthComputable) {
				const pct = Math.round((e.loaded / e.total) * 30);
				setStatus(`📂 ファイル読み込み中... ${Math.round((e.loaded / e.total) * 100)}%`, pct);
			}
		};
		reader.onload = (e) => {
			const content = e.target?.result as string;
			const lineCount = content.split('\n').length - 1;
			setStatus(`⚙️ ${lineCount.toLocaleString()} 行をパース中...`, 35);

			// Use Web Worker for large files (>5MB), sync for small files
			if (content.length > 5_000_000) {
				const worker = new Worker(
					new URL('$lib/tsv-worker.ts', import.meta.url),
					{ type: 'module' },
				);
				worker.onmessage = (ev: MessageEvent<ParseResult>) => {
					handleParseResult(ev.data);
					worker.terminate();
				};
				worker.onerror = (err) => {
					parseErrors = [`Worker error: ${err.message}`];
					clearStatus();
					worker.terminate();
				};
				worker.postMessage(content);
			} else {
				// Small file: parse synchronously
				const result = parseTSV(content);
				handleParseResult(result);
			}
		};
		reader.readAsText(file, 'UTF-8');
	}

	function handleParseResult(result: ParseResult) {
		parseErrors = result.errors.slice(0, 20);
		if (result.articles.length > 0) {
			const count = result.articles.length.toLocaleString();
			setStatus(`🗂️ ${count} 件のデータを準備中...`, 70);
			// Defer store update to next frame so loading message renders
			requestAnimationFrame(() => {
				setStatus(`🎨 ${count} 件をマップに描画中...`, 85);
				articles.set(result.articles);
				columnMetas.set(result.columnMetas);
				// Double rAF: 1st frame = MapView schedules render,
				// 2nd frame = render executes, 3rd frame = confirm done
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						clearStatus();
					});
				});
			});
		} else {
			clearStatus();
		}
	}

	let currentMapMode = $state<MapMode>('scatter');
	$effect(() => {
		const unsub = mapMode.subscribe((m) => { untrack(() => { currentMapMode = m; }); });
		return unsub;
	});

	let articleCount = $state(0);
	$effect(() => {
		const unsub = articles.subscribe((a) => { untrack(() => { articleCount = a.length; }); });
		return unsub;
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<header
	class="flex items-center gap-3 border-b border-slate-700 bg-slate-900 px-4 py-2"
	ondragover={(e) => e.preventDefault()}
	ondrop={handleDrop}
>
	<h1 class="text-lg font-bold text-cyan-400 mr-2">LitLynx</h1>

	<input
		bind:this={fileInput}
		type="file"
		accept=".tsv,.txt,.csv"
		class="hidden"
		onchange={handleFileSelect}
	/>

	<button
		class="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50"
		onclick={() => fileInput.click()}
		disabled={isLoading}
	>
		{#if isLoading}
			<Loader2 size={16} class="animate-spin" />
			読み込み中...
		{:else}
			<FileUp size={16} />
			TSVファイル読み込み
		{/if}
	</button>

	{#if isLoading}
		<span class="text-xs text-yellow-400 animate-pulse">{loadingMessage}</span>
	{:else if articleCount > 0}
		<span class="text-xs text-slate-400">{articleCount.toLocaleString()} 件読み込み済み</span>
	{/if}

	<div class="flex-1"></div>

	{#if articleCount > 0}
		<div class="flex items-center gap-1 rounded border border-slate-600 p-0.5">
			<button
				class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors {currentMapMode === 'scatter' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}"
				onclick={() => mapMode.set('scatter')}
			>
				<Map size={14} />
				散布図
			</button>
			<button
				class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors {currentMapMode === 'heatmap' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}"
				onclick={() => mapMode.set('heatmap')}
			>
				<Flame size={14} />
				ヒートマップ
			</button>
		</div>
	{/if}

	<button
		class="flex items-center gap-1 rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 transition-colors"
		onclick={() => showSettings = !showSettings}
	>
		<Settings size={14} />
		API設定
	</button>

	<button
		class="flex items-center justify-center rounded border border-slate-600 w-7 h-7 text-slate-300 hover:bg-slate-700 transition-colors"
		onclick={() => showHelp = true}
		title="使い方"
	>
		<HelpCircle size={14} />
	</button>
</header>

{#if parseErrors.length > 0}
	<div class="bg-red-900/50 border-b border-red-700 px-4 py-2 text-sm text-red-300">
		{#each parseErrors.slice(0, 5) as error}
			<p>{error}</p>
		{/each}
		{#if parseErrors.length > 5}
			<p class="text-red-400">...他 {parseErrors.length - 5} 件のエラー</p>
		{/if}
	</div>
{/if}

{#if showSettings}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => showSettings = false}
		onkeydown={(e) => { if (e.key === 'Escape') showSettings = false; }}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="w-full max-w-md rounded-lg bg-slate-800 p-6 shadow-xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h2 class="mb-4 text-lg font-bold">API設定</h2>
			<p class="mb-4 text-sm text-slate-400">
				各プロバイダーのAPIキーを入力してください。キーはブラウザのlocalStorageに保存されます。
			</p>
			<label class="block mb-3">
				<span class="text-sm text-slate-300">Google Gemini API Key</span>
				<input
					type="password"
					bind:value={geminiKey}
					class="mt-1 block w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
					placeholder="APIキーを入力..."
				/>
			</label>
			<label class="block mb-3">
				<span class="text-sm text-slate-300">Anthropic Claude API Key</span>
				<input
					type="password"
					bind:value={claudeKey}
					class="mt-1 block w-full rounded bg-slate-700 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
					placeholder="APIキーを入力..."
				/>
			</label>
			<div class="mt-4 flex justify-end gap-2">
				<button
					class="rounded border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors"
					onclick={() => showSettings = false}
				>
					キャンセル
				</button>
				<button
					class="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
					onclick={saveApiKeys}
				>
					保存
				</button>
			</div>
		</div>
	</div>
{/if}

{#if showHelp}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={() => showHelp = false}
		onkeydown={(e) => { if (e.key === 'Escape') showHelp = false; }}
	>
		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<div
			class="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-lg bg-slate-800 p-6 shadow-xl"
			role="document"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<h2 class="mb-4 text-lg font-bold text-cyan-400">LitLynx の使い方</h2>

			<div class="space-y-4 text-sm text-slate-300 leading-relaxed">
				<section>
					<h3 class="font-semibold text-white mb-1">1. データの読み込み</h3>
					<p>ヘッダーの「TSVファイル読み込み」ボタン、またはドラッグ＆ドロップでTSVファイルを読み込みます。</p>
					<p class="mt-1 text-xs text-slate-500">必須カラム: ID, x, y, year, title, abstract, affiliation</p>
				</section>

				<section>
					<h3 class="font-semibold text-white mb-1">2. マップ操作</h3>
					<ul class="list-disc list-inside space-y-0.5 text-slate-400">
						<li>マウスホイールでズーム、ドラッグでパン</li>
						<li>散布図 / ヒートマップをヘッダーから切替</li>
						<li>ホバーでタイトル表示、クリックで詳細表示</li>
					</ul>
				</section>

				<section>
					<h3 class="font-semibold text-white mb-1">3. 文献の選択</h3>
					<ul class="list-disc list-inside space-y-0.5 text-slate-400">
						<li>マップ左上のツールで矩形 / 円形の範囲選択</li>
						<li>左パネルでテキスト検索（AND / OR / 正規表現）</li>
						<li>動的フィルタでカラム値による絞り込み</li>
					</ul>
				</section>

				<section>
					<h3 class="font-semibold text-white mb-1">4. AIチャット</h3>
					<ul class="list-disc list-inside space-y-0.5 text-slate-400">
						<li>右パネルで選択/フィルタした文献についてAIに質問</li>
						<li>Gemini / Claude を切替可能（要APIキー）</li>
						<li>送信ボタンで送信（Enterは改行）</li>
						<li>コンテキストは最大50件、履歴は直近10往復</li>
					</ul>
				</section>

				<section>
					<h3 class="font-semibold text-white mb-1">5. APIキーの設定</h3>
					<p>ヘッダーの「API設定」からGemini / ClaudeのAPIキーを入力してください。キーはブラウザのlocalStorageに保存されます。</p>
				</section>
			</div>

			<div class="mt-5 flex justify-end">
				<button
					class="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 transition-colors"
					onclick={() => showHelp = false}
				>
					閉じる
				</button>
			</div>
		</div>
	</div>
{/if}
