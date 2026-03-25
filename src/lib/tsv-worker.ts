import { parseTSV } from './tsv-parser';

/** Web Worker entry: receives TSV string, returns parse result */
self.onmessage = (event: MessageEvent<string>) => {
	const result = parseTSV(event.data);
	self.postMessage(result);
};
