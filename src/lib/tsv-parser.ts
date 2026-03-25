import { REQUIRED_COLUMNS, type Article, type ColumnMeta } from './types';

export interface ParseResult {
	articles: Article[];
	columnMetas: ColumnMeta[];
	errors: string[];
}

/** Parse a TSV string into articles and column metadata */
export function parseTSV(tsvContent: string): ParseResult {
	const errors: string[] = [];
	const lines = tsvContent.split(/\r?\n/).filter((line) => line.trim() !== '');

	if (lines.length < 2) {
		return { articles: [], columnMetas: [], errors: ['ファイルにデータ行がありません'] };
	}

	const headers = lines[0].split('\t').map((h) => h.trim());

	// Validate required columns
	const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
	if (missingColumns.length > 0) {
		return {
			articles: [],
			columnMetas: [],
			errors: [`必須カラムが不足しています: ${missingColumns.join(', ')}`],
		};
	}

	// Parse rows
	const articles: Article[] = [];
	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split('\t');
		if (values.length !== headers.length) {
			errors.push(`行 ${i + 1}: カラム数が一致しません（期待: ${headers.length}, 実際: ${values.length}）`);
			continue;
		}

		const record: Record<string, string | number> = {};
		for (let j = 0; j < headers.length; j++) {
			record[headers[j]] = values[j]?.trim() ?? '';
		}

		// Parse numeric fields
		const x = parseFloat(String(record['x']));
		const y = parseFloat(String(record['y']));
		const year = parseInt(String(record['year']), 10);

		if (isNaN(x) || isNaN(y)) {
			errors.push(`行 ${i + 1}: x/y座標が数値ではありません`);
			continue;
		}
		if (isNaN(year)) {
			errors.push(`行 ${i + 1}: yearが数値ではありません`);
			continue;
		}

		record['x'] = x;
		record['y'] = y;
		record['year'] = year;

		// Parse other numeric columns
		for (const header of headers) {
			if (['x', 'y', 'year', 'ID', 'title', 'abstract', 'affiliation'].includes(header)) continue;
			const numVal = parseFloat(String(record[header]));
			if (!isNaN(numVal) && String(numVal) === String(record[header]).trim()) {
				record[header] = numVal;
			}
		}

		articles.push(record as unknown as Article);
	}

	// Build column metadata
	const columnMetas = buildColumnMetas(headers, articles);

	return { articles, columnMetas, errors };
}

/** Max unique values to track for string filter UI */
const MAX_UNIQUE_FOR_FILTER = 200;

function buildColumnMetas(headers: string[], articles: Article[]): ColumnMeta[] {
	return headers
		.filter((h) => h !== 'x' && h !== 'y')
		.map((name) => {
			const isRequired = (REQUIRED_COLUMNS as readonly string[]).includes(name);

			// Sample first value to determine type
			const firstVal = articles.length > 0 ? articles[0][name] : '';
			const isNumeric = typeof firstVal === 'number';

			if (isNumeric) {
				let min = Infinity;
				let max = -Infinity;
				for (let i = 0; i < articles.length; i++) {
					const v = articles[i][name] as number;
					if (v < min) min = v;
					if (v > max) max = v;
				}
				return {
					name,
					type: 'number' as const,
					isRequired,
					min,
					max,
				};
			}

			// For string columns, only collect unique values if cardinality is low enough for filtering
			// Skip high-cardinality columns like title, abstract
			if (isRequired && (name === 'title' || name === 'abstract')) {
				return {
					name,
					type: 'string' as const,
					isRequired,
					uniqueValues: undefined,
				};
			}

			const uniqueSet = new Set<string>();
			let tooMany = false;
			for (let i = 0; i < articles.length; i++) {
				uniqueSet.add(String(articles[i][name] ?? ''));
				if (uniqueSet.size > MAX_UNIQUE_FOR_FILTER) {
					tooMany = true;
					break;
				}
			}

			return {
				name,
				type: 'string' as const,
				isRequired,
				uniqueValues: tooMany ? undefined : [...uniqueSet].sort(),
			};
		});
}
