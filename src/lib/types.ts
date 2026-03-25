/** Required columns in TSV */
export const REQUIRED_COLUMNS = ['ID', 'x', 'y', 'year', 'title', 'abstract', 'affiliation'] as const;

/** A single article/document record */
export interface Article {
	ID: string;
	x: number;
	y: number;
	year: number;
	title: string;
	abstract: string;
	affiliation: string;
	/** Dynamic extra columns */
	[key: string]: string | number;
}

/** Column metadata detected from TSV */
export interface ColumnMeta {
	name: string;
	type: 'string' | 'number';
	isRequired: boolean;
	/** Unique values for string columns (for filter dropdowns) */
	uniqueValues?: string[];
	/** Min/max for number columns (for range sliders) */
	min?: number;
	max?: number;
}

/** Search mode for text search */
export type SearchMode = 'and' | 'or' | 'regex';

/** Selection tool for the map */
export type SelectionTool = 'pan' | 'rectangle' | 'circle';

/** Map display mode */
export type MapMode = 'scatter' | 'heatmap';

/** Filter state for a single column */
export interface ColumnFilter {
	column: string;
	type: 'string' | 'number';
	/** Selected values for string filter */
	selectedValues?: Set<string>;
	/** Range for number filter */
	rangeMin?: number;
	rangeMax?: number;
}

/** Chat message */
export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant' | 'system';
	content: string;
	timestamp: Date;
}

/** Supported AI providers */
export type AIProvider = 'gemini' | 'claude';

/** AI provider configuration */
export interface AIProviderConfig {
	id: AIProvider;
	name: string;
	models: AIModelConfig[];
}

/** AI model configuration including pricing */
export interface AIModelConfig {
	id: string;
	name: string;
	/** Price per 1M input tokens in USD */
	inputPricePerMToken: number;
	/** Price per 1M output tokens in USD */
	outputPricePerMToken: number;
	/** Max context window in tokens */
	maxContextTokens: number;
}

/** Token usage tracking */
export interface TokenUsage {
	inputTokens: number;
	outputTokens: number;
	estimatedCostUSD: number;
}

/** Context limit configuration */
export const CONTEXT_LIMITS = {
	maxArticles: 50,
	titleMaxChars: Infinity,
	abstractMaxChars: 400,
	otherFieldMaxChars: 200,
	totalTokenBudget: 50_000,
} as const;
