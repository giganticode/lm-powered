export interface Token {
	text: string;
	entropy: number;
	type: string;
}

export interface EntropyLine {
	text: string;
	line_entropy: number;
	tokens: Token[];
}

export interface EntropyResult {
	metrics: string;
	token_type: string;
	languagemodel: string;
	lines: EntropyLine[];
}

export interface EntropyCacheMap {
	[fileName: string]: EntropyResult;
}