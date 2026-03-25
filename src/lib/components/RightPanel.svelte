<script lang="ts">
	import { untrack } from 'svelte';
	import { Send, Download, Trash2 } from 'lucide-svelte';
	import {
		chatMessages,
		selectedArticles,
		filteredArticles,
		selectedCount,
		filteredCount,
		activeProvider,
		activeModelId,
		apiKeys,
		tokenUsage,
		isAiLoading,
	} from '$lib/stores';
	import { AI_PROVIDERS, estimateTokenCount, calculateCost } from '$lib/ai-providers';
	import type { ChatMessage, AIProvider } from '$lib/types';
	import { CONTEXT_LIMITS } from '$lib/types';

	let userInput = $state('');
	let chatContainer: HTMLDivElement;
	let messages = $state<ChatMessage[]>([]);
	let provider = $state<AIProvider>('gemini');
	let modelId = $state('gemini-2.5-flash');
	let keys = $state<Record<string, string>>({});
	let usage = $state({ inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 });
	let loading = $state(false);
	let selCount = $state(0);
	let filCount = $state(0);
	let contextArticles = $state<{ ID: string; title: string }[]>([]);

	$effect(() => {
		const unsubs = [
			chatMessages.subscribe((m) => { untrack(() => { messages = m; scrollToBottom(); }); }),
			activeProvider.subscribe((p) => { untrack(() => { provider = p; }); }),
			activeModelId.subscribe((m) => { untrack(() => { modelId = m; }); }),
			apiKeys.subscribe((k) => { untrack(() => { keys = k; }); }),
			tokenUsage.subscribe((u) => { untrack(() => { usage = u; }); }),
			isAiLoading.subscribe((l) => { untrack(() => { loading = l; }); }),
			selectedCount.subscribe((c) => { untrack(() => { selCount = c; }); }),
			filteredCount.subscribe((c) => { untrack(() => { filCount = c; }); }),
			selectedArticles.subscribe((a) => {
				untrack(() => {
					contextArticles = a.slice(0, 10).map((ar) => ({ ID: ar.ID, title: ar.title }));
				});
			}),
		];
		return () => unsubs.forEach((u) => u());
	});

	function scrollToBottom() {
		requestAnimationFrame(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		});
	}

	function getAvailableModels() {
		const providerConfig = AI_PROVIDERS.find((p) => p.id === provider);
		return providerConfig?.models ?? [];
	}

	function handleProviderChange(newProvider: AIProvider) {
		activeProvider.set(newProvider);
		const models = AI_PROVIDERS.find((p) => p.id === newProvider)?.models;
		if (models && models.length > 0) {
			activeModelId.set(models[0].id);
		}
	}

	/** Post a warning/error notice inline in the chat */
	function postNotice(content: string) {
		const notice: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'assistant',
			content,
			timestamp: new Date(),
		};
		chatMessages.update((m) => [...m, notice]);
	}

	/** Check if any articles are available as context */
	function hasArticleContext(): boolean {
		let count = 0;
		const unsub1 = selectedArticles.subscribe((a) => { count = a.length; });
		unsub1();
		if (count > 0) return true;
		const unsub2 = filteredArticles.subscribe((a) => { count = a.length; });
		unsub2();
		return count > 0;
	}

	async function sendMessage() {
		const text = userInput.trim();
		if (!text || loading) return;

		// Validate: API key
		const key = keys[provider];
		if (!key) {
			const name = provider === 'gemini' ? 'Gemini' : 'Claude';
			postNotice(`⚠️ ${name} のAPIキーが設定されていません。\nヘッダーの「⚙ API設定」から設定してください。`);
			return;
		}

		// Validate: article context
		if (!hasArticleContext()) {
			postNotice('⚠️ 分析対象の文献がありません。\nTSVファイルを読み込むか、文献を選択してからご質問ください。');
			return;
		}

		const userMsg: ChatMessage = {
			id: crypto.randomUUID(),
			role: 'user',
			content: text,
			timestamp: new Date(),
		};

		chatMessages.update((m) => [...m, userMsg]);
		userInput = '';
		isAiLoading.set(true);

		try {
			const assistantMsg: ChatMessage = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: '',
				timestamp: new Date(),
			};
			chatMessages.update((m) => [...m, assistantMsg]);

			// Build context and call API
			const contextText = buildContextText();
			const allMessages = buildApiMessages(contextText, text);

			if (provider === 'gemini') {
				await callGeminiAPI(key, allMessages, assistantMsg.id);
			} else {
				await callClaudeAPI(key, allMessages, assistantMsg.id);
			}
		} catch (err) {
			const message = (err as Error).message || '不明なエラー';
			const isNetwork = message.includes('Failed to fetch') || message.includes('NetworkError');
			const display = isNetwork
				? '❌ ネットワークエラー: インターネット接続を確認してください。'
				: `❌ エラーが発生しました: ${message}`;
			chatMessages.update((m) => {
				const filtered = m.filter((msg) => msg.content !== '');
				return [...filtered, { id: crypto.randomUUID(), role: 'assistant' as const, content: display, timestamp: new Date() }];
			});
		} finally {
			isAiLoading.set(false);
		}
	}

	function buildContextText(): string {
		let arts: { ID: string; title: string; abstract: string; [key: string]: unknown }[] = [];

		// Use selected articles if any, otherwise filtered
		const unsub1 = selectedArticles.subscribe((a) => {
			if (a.length > 0) arts = a;
		});
		unsub1();

		if (arts.length === 0) {
			const unsub2 = filteredArticles.subscribe((a) => {
				arts = a.slice(0, CONTEXT_LIMITS.maxArticles);
			});
			unsub2();
		}

		if (arts.length > CONTEXT_LIMITS.maxArticles) {
			// Random sampling
			const shuffled = [...arts].sort(() => Math.random() - 0.5);
			arts = shuffled.slice(0, CONTEXT_LIMITS.maxArticles);
		}

		const lines = arts.map((a, i) => {
			const title = a.title;
			const abstract = String(a.abstract || '').slice(0, CONTEXT_LIMITS.abstractMaxChars);
			const extras = Object.entries(a)
				.filter(([k]) => !['ID', 'x', 'y', 'title', 'abstract'].includes(k))
				.map(([k, v]) => `${k}: ${String(v).slice(0, CONTEXT_LIMITS.otherFieldMaxChars)}`)
				.join(' | ');
			return `[${i + 1}] ${title}\n    ${abstract}${extras ? '\n    ' + extras : ''}`;
		});

		return `以下は分析対象の文献一覧です（${arts.length}件）:\n\n${lines.join('\n\n')}`;
	}

	function buildApiMessages(context: string, userText: string) {
		// messages already contains the new userMsg and empty assistantMsg at this point.
		// Extract only prior completed conversation turns (exclude the latest user + empty assistant).
		const prior = messages
			.filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content))
			.slice(0, -1) // remove the latest userMsg (will be added as userText below)
			.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

		return {
			system: `あなたは文献分析の専門家です。ユーザーから提供された文献データを元に、研究トレンドの分析、要約、比較などを行ってください。\n\n${context}`,
			messages: [...prior, { role: 'user' as const, content: userText }],
		};
	}

	async function callGeminiAPI(
		apiKey: string,
		payload: { system: string; messages: { role: string; content: string }[] },
		msgId: string,
	) {
		const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${apiKey}`;

		const contents = payload.messages.map((m) => ({
			role: m.role === 'assistant' ? 'model' : 'user',
			parts: [{ text: m.content }],
		}));

		const resp = await fetch(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				system_instruction: { parts: [{ text: payload.system }] },
				contents,
			}),
		});

		if (!resp.ok) {
			const err = await resp.text();
			throw new Error(`Gemini API Error: ${resp.status} ${err}`);
		}

		await processSSEStream(resp, msgId, (chunk) => {
			try {
				const data = JSON.parse(chunk);
				return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
			} catch {
				return '';
			}
		});
	}

	async function callClaudeAPI(
		apiKey: string,
		payload: { system: string; messages: { role: string; content: string }[] },
		msgId: string,
	) {
		const resp = await fetch('https://api.anthropic.com/v1/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-api-key': apiKey,
				'anthropic-version': '2023-06-01',
				'anthropic-dangerous-direct-browser-access': 'true',
			},
			body: JSON.stringify({
				model: modelId,
				max_tokens: 4096,
				system: payload.system,
				messages: payload.messages,
				stream: true,
			}),
		});

		if (!resp.ok) {
			const err = await resp.text();
			throw new Error(`Claude API Error: ${resp.status} ${err}`);
		}

		await processSSEStream(resp, msgId, (chunk) => {
			try {
				const data = JSON.parse(chunk);
				if (data.type === 'content_block_delta') {
					return data.delta?.text ?? '';
				}
				if (data.type === 'message_delta' && data.usage) {
					updateUsage(data.usage.output_tokens ?? 0, 'output');
				}
				return '';
			} catch {
				return '';
			}
		});
	}

	async function processSSEStream(
		resp: Response,
		msgId: string,
		parseChunk: (data: string) => string,
	) {
		const reader = resp.body?.getReader();
		if (!reader) throw new Error('No response body');

		const decoder = new TextDecoder();
		let buffer = '';
		let fullText = '';

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';

			for (const line of lines) {
				if (line.startsWith('data: ')) {
					const data = line.slice(6).trim();
					if (data === '[DONE]') continue;
					const text = parseChunk(data);
					if (text) {
						fullText += text;
						chatMessages.update((msgs) =>
							msgs.map((m) => (m.id === msgId ? { ...m, content: fullText } : m)),
						);
					}
				}
			}
		}

		// Update token usage estimate
		const model = AI_PROVIDERS.flatMap((p) => p.models).find((m) => m.id === modelId);
		if (model) {
			const inputTokens = estimateTokenCount(fullText);
			const outputTokens = estimateTokenCount(fullText);
			tokenUsage.update((u) => {
				const newInput = u.inputTokens + inputTokens;
				const newOutput = u.outputTokens + outputTokens;
				return {
					inputTokens: newInput,
					outputTokens: newOutput,
					estimatedCostUSD: calculateCost(newInput, newOutput, model.inputPricePerMToken, model.outputPricePerMToken),
				};
			});
		}
	}

	function updateUsage(tokens: number, type: 'input' | 'output') {
		const model = AI_PROVIDERS.flatMap((p) => p.models).find((m) => m.id === modelId);
		if (!model) return;
		tokenUsage.update((u) => {
			const newU = { ...u };
			if (type === 'input') newU.inputTokens += tokens;
			else newU.outputTokens += tokens;
			newU.estimatedCostUSD = calculateCost(newU.inputTokens, newU.outputTokens, model.inputPricePerMToken, model.outputPricePerMToken);
			return newU;
		});
	}

	function clearChat() {
		chatMessages.set([]);
		tokenUsage.set({ inputTokens: 0, outputTokens: 0, estimatedCostUSD: 0 });
	}

	function exportChat() {
		const now = new Date().toISOString().replace(/[:.]/g, '-');
		const model = AI_PROVIDERS.flatMap((p) => p.models).find((m) => m.id === modelId);

		let md = `# VnxLynx チャット履歴\n\n`;
		md += `- **日時**: ${new Date().toLocaleString('ja-JP')}\n`;
		md += `- **モデル**: ${model?.name ?? modelId}\n`;
		md += `- **コンテキスト文献数**: ${contextArticles.length}件\n`;
		md += `- **概算費用**: $${usage.estimatedCostUSD.toFixed(4)}\n`;
		md += `- **トークン**: 入力 ${usage.inputTokens.toLocaleString()} / 出力 ${usage.outputTokens.toLocaleString()}\n\n`;

		if (contextArticles.length > 0) {
			md += `## コンテキスト文献\n\n`;
			for (const a of contextArticles) {
				md += `- [${a.ID}] ${a.title}\n`;
			}
			md += '\n';
		}

		md += `## チャット履歴\n\n`;
		for (const msg of messages) {
			if (msg.role === 'user') {
				md += `### ユーザー\n\n${msg.content}\n\n`;
			} else if (msg.role === 'assistant' && msg.content) {
				md += `### AI\n\n${msg.content}\n\n`;
			}
		}

		const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `vnxlynx-chat-${now}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

</script>

<div class="flex h-full flex-col border-l border-slate-700 bg-slate-900">
	<!-- Header -->
	<div class="border-b border-slate-700 p-3">
		<div class="flex items-center justify-between mb-2">
			<span class="text-sm font-semibold text-slate-300">AIチャット</span>
			<div class="flex gap-1">
				<button
					class="rounded p-1 text-slate-500 hover:text-white transition-colors"
					onclick={exportChat}
					title="チャット履歴をエクスポート"
				>
					<Download size={14} />
				</button>
				<button
					class="rounded p-1 text-slate-500 hover:text-red-400 transition-colors"
					onclick={clearChat}
					title="チャットをクリア"
				>
					<Trash2 size={14} />
				</button>
			</div>
		</div>
		<div class="flex gap-2">
			<select
				class="flex-1 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-white"
				value={provider}
				onchange={(e) => handleProviderChange((e.target as HTMLSelectElement).value as AIProvider)}
			>
				{#each AI_PROVIDERS as p}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
			<select
				class="flex-1 rounded bg-slate-800 border border-slate-600 px-2 py-1 text-xs text-white"
				value={modelId}
				onchange={(e) => activeModelId.set((e.target as HTMLSelectElement).value)}
			>
				{#each getAvailableModels() as model}
					<option value={model.id}>{model.name}</option>
				{/each}
			</select>
		</div>
		{#if selCount > 0}
			<p class="mt-1.5 text-xs text-cyan-400">{selCount}件の文献を選択中</p>
		{:else if filCount > 0}
			<p class="mt-1.5 text-xs text-slate-500">{filCount}件のフィルタ結果をコンテキストに使用</p>
		{/if}
	</div>

	<!-- Messages -->
	<div class="flex-1 overflow-y-auto p-3 space-y-3" bind:this={chatContainer}>
		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center">
				<p class="text-sm text-slate-600 text-center">
					文献を選択またはフィルタしてから<br />質問を入力してください
				</p>
			</div>
		{/if}
		{#each messages.filter((m) => m.role !== 'system') as msg}
			{@const isNotice = msg.role === 'assistant' && (msg.content.startsWith('⚠️') || msg.content.startsWith('❌'))}
			<div class="rounded-lg p-3 text-sm {msg.role === 'user' ? 'bg-blue-900/30 border border-blue-800/50' : isNotice ? 'bg-amber-900/20 border border-amber-700/40' : 'bg-slate-800/50 border border-slate-700/50'}">
				<div class="mb-1 text-xs font-medium {msg.role === 'user' ? 'text-blue-400' : isNotice ? 'text-amber-400' : 'text-cyan-400'}">
					{msg.role === 'user' ? 'あなた' : isNotice ? 'お知らせ' : 'AI'}
				</div>
				<div class="whitespace-pre-wrap {isNotice ? 'text-amber-200' : 'text-slate-200'} leading-relaxed">
					{msg.content}
					{#if loading && msg.role === 'assistant' && msg === messages[messages.length - 1] && !msg.content}
						<span class="inline-block animate-pulse text-slate-500">思考中...</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Input -->
	<div class="border-t border-slate-700 p-3">
		<div class="flex gap-2">
			<textarea
				class="flex-1 resize-none rounded bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
				rows="2"
				placeholder="質問を入力..."
				bind:value={userInput}
				disabled={loading}
			></textarea>
			<button
				class="self-end rounded bg-blue-600 p-2 text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				onclick={sendMessage}
				disabled={loading || !userInput.trim()}
			>
				<Send size={16} />
			</button>
		</div>
		<!-- Cost display -->
		<div class="mt-2 flex items-center justify-between text-xs text-slate-600">
			<span>入力: {usage.inputTokens.toLocaleString()} / 出力: {usage.outputTokens.toLocaleString()} tokens</span>
			<span>${usage.estimatedCostUSD.toFixed(4)}</span>
		</div>
	</div>
</div>
