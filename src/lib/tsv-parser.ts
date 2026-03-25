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

function buildColumnMetas(headers: string[], articles: Article[]): ColumnMeta[] {
	return headers
		.filter((h) => h !== 'x' && h !== 'y')
		.map((name) => {
			const isRequired = (REQUIRED_COLUMNS as readonly string[]).includes(name);
			const values = articles.map((a) => a[name]);
			const isNumeric = values.every((v) => typeof v === 'number');

			if (isNumeric) {
				const nums = values as number[];
				return {
					name,
					type: 'number' as const,
					isRequired,
					min: Math.min(...nums),
					max: Math.max(...nums),
				};
			}

			const uniqueValues = [...new Set(values.map(String))].sort();
			return {
				name,
				type: 'string' as const,
				isRequired,
				uniqueValues,
			};
		});
}
