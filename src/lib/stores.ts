import { writable, derived } from 'svelte/store';
import type {
	Article,
	ColumnMeta,
	SearchMode,
	SelectionTool,
	MapMode,
	ColumnFilter,
	ChatMessage,
	AIProvider,
	TokenUsage,
} from './types';

/** All articles loaded from TSV */
export const articles = writable<Article[]>([]);

/** Column metadata detected from TSV */
export const columnMetas = writable<ColumnMeta[]>([]);

/** Text search query */
export const searchQuery = writable<string>('');

/** Search mode */
export const searchMode = writable<SearchMode>('and');

/** Active column filters */
export const columnFilters = writable<ColumnFilter[]>([]);

/** Map display mode */
export const mapMode = writable<MapMode>('scatter');

/** Selection tool */
export const selectionTool = writable<SelectionTool>('pan');

/** IDs of articles selected via map range selection */
export const selectedArticleIds = writable<Set<string>>(new Set());

/** ID of the article currently focused (clicked) for detail view */
export const focusedArticleId = writable<string | null>(null);

/** Selected AI provider */
export const activeProvider = writable<AIProvider>('gemini');

/** Selected model ID */
export const activeModelId = writable<string>('gemini-2.5-flash');

/** API keys stored per provider */
export const apiKeys = writable<Record<string, string>>({});

/** Chat messages */
export const chatMessages = writable<ChatMessage[]>([]);

/** Cumulative token usage for the session */
export const tokenUsage = writable<TokenUsage>({
	inputTokens: 0,
	outputTokens: 0,
	estimatedCostUSD: 0,
});

/** Whether AI is currently generating a response */
export const isAiLoading = writable<boolean>(false);

/** Global loading status for data pipeline (file read → parse → render) */
export const loadingStatus = writable<{ active: boolean; message: string; progress?: number }>({
	active: false,
	message: '',
});

/** Articles filtered by search + column filters */
export const filteredArticles = derived(
	[articles, searchQuery, searchMode, columnFilters],
	([$articles, $searchQuery, $searchMode, $columnFilters]) => {
		let result = $articles;

		// Apply text search
		if ($searchQuery.trim()) {
			result = applyTextSearch(result, $searchQuery.trim(), $searchMode);
		}

		// Apply column filters
		for (const filter of $columnFilters) {
			result = applyColumnFilter(result, filter);
		}

		return result;
	},
);

/** Count of filtered articles */
export const filteredCount = derived(filteredArticles, ($filtered) => $filtered.length);

/** Count of selected articles */
export const selectedCount = derived(selectedArticleIds, ($ids) => $ids.size);

/** Articles that are both filtered and selected */
export const selectedArticles = derived(
	[filteredArticles, selectedArticleIds],
	([$filtered, $selectedIds]) => {
		if ($selectedIds.size === 0) return [];
		return $filtered.filter((a) => $selectedIds.has(a.ID));
	},
);

/** The focused article detail */
export const focusedArticle = derived(
	[articles, focusedArticleId],
	([$articles, $id]) => {
		if (!$id) return null;
		return $articles.find((a) => a.ID === $id) ?? null;
	},
);

// --- Helper functions ---

function applyTextSearch(articles: Article[], query: string, mode: SearchMode): Article[] {
	if (mode === 'regex') {
		try {
			const regex = new RegExp(query, 'i');
			return articles.filter((a) => searchableText(a).some((t) => regex.test(t)));
		} catch {
			// Invalid regex — return all
			return articles;
		}
	}

	const keywords = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (keywords.length === 0) return articles;

	return articles.filter((a) => {
		const texts = searchableText(a).map((t) => t.toLowerCase());
		if (mode === 'and') {
			return keywords.every((kw) => texts.some((t) => t.includes(kw)));
		} else {
			return keywords.some((kw) => texts.some((t) => t.includes(kw)));
		}
	});
}

function searchableText(article: Article): string[] {
	return Object.entries(article)
		.filter(([key]) => key !== 'x' && key !== 'y')
		.map(([, value]) => String(value));
}

function applyColumnFilter(articles: Article[], filter: ColumnFilter): Article[] {
	if (filter.type === 'string' && filter.selectedValues && filter.selectedValues.size > 0) {
		return articles.filter((a) => {
			const val = String(a[filter.column] ?? '');
			return filter.selectedValues!.has(val);
		});
	}
	if (filter.type === 'number') {
		return articles.filter((a) => {
			const val = Number(a[filter.column]);
			if (isNaN(val)) return false;
			if (filter.rangeMin !== undefined && val < filter.rangeMin) return false;
			if (filter.rangeMax !== undefined && val > filter.rangeMax) return false;
			return true;
		});
	}
	return articles;
}
