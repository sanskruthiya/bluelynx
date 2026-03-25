import type { AIProviderConfig } from './types';

/** AI provider configurations with model pricing */
export const AI_PROVIDERS: AIProviderConfig[] = [
	{
		id: 'gemini',
		name: 'Google Gemini',
		models: [
			{
				id: 'gemini-2.0-flash',
				name: 'Gemini 2.0 Flash',
				inputPricePerMToken: 0.10,
				outputPricePerMToken: 0.40,
				maxContextTokens: 1_000_000,
			},
			{
				id: 'gemini-2.5-pro-preview-05-06',
				name: 'Gemini 2.5 Pro',
				inputPricePerMToken: 1.25,
				outputPricePerMToken: 10.00,
				maxContextTokens: 1_000_000,
			},
		],
	},
	{
		id: 'claude',
		name: 'Anthropic Claude',
		models: [
			{
				id: 'claude-sonnet-4-20250514',
				name: 'Claude Sonnet 4',
				inputPricePerMToken: 3.00,
				outputPricePerMToken: 15.00,
				maxContextTokens: 200_000,
			},
			{
				id: 'claude-3-5-haiku-20241022',
				name: 'Claude 3.5 Haiku',
				inputPricePerMToken: 0.80,
				outputPricePerMToken: 4.00,
				maxContextTokens: 200_000,
			},
		],
	},
];

/** Estimate token count from text (rough: ~1 token per 4 chars for English, ~1 token per 1.5 chars for Japanese) */
export function estimateTokenCount(text: string): number {
	const japaneseChars = (text.match(/[\u3000-\u9fff\uf900-\ufaff]/g) || []).length;
	const otherChars = text.length - japaneseChars;
	return Math.ceil(japaneseChars / 1.5 + otherChars / 4);
}

/** Calculate cost in USD from token usage */
export function calculateCost(
	inputTokens: number,
	outputTokens: number,
	inputPricePerMToken: number,
	outputPricePerMToken: number,
): number {
	return (inputTokens / 1_000_000) * inputPricePerMToken + (outputTokens / 1_000_000) * outputPricePerMToken;
}
