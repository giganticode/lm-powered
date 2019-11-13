import * as vscode from 'vscode';
import {Token, EntropyLine, EntropyResult} from '../../baseDefinitions';
import GlobalCache from './globalCache';
import { Settings, ColorRange } from '../../settings';

function getFoldingRanges(scanResult: EntropyResult): vscode.FoldingRange[] {
	if (!scanResult || !scanResult.lines || scanResult.lines.length === 0) {
		return [];
	}
	let lineEntropies: number[] = scanResult.lines.map(e => e.line_entropy);
	let ranges: vscode.FoldingRange[] = [];
	
	const MAX = Settings.getFoldingMaxRisk();

	let lastIndex: number = -1;
	for (let i = 0; i < lineEntropies.length; i++) {
		let riskLevel: number = lineEntropies[i];

		if (riskLevel < MAX) {
			if (ranges.length > 0 && ranges[ranges.length - 1].end === lastIndex) {
				ranges[ranges.length - 1] = new vscode.FoldingRange(ranges[ranges.length - 1].start, i);
			} else {
				ranges.push(new vscode.FoldingRange(i, i));
			}
		}
		lastIndex = i;
	}

	return ranges;
}

export function visualize(editor: vscode.TextEditor, fileName: string) {
	let scanResult: EntropyResult = GlobalCache.get(fileName);
	let ranges = getFoldingRanges(scanResult);
	let positions: number[]  = ranges.map(e => e.start);
	vscode.commands.executeCommand('editor.fold', {levels: 1, direction: 'down', selectionLines: positions});
}

export function register() {
	vscode.languages.registerFoldingRangeProvider({ scheme: 'file', language: 'java' }, new EntropyFoldingRangeProvider());
}

class EntropyFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] | Thenable<vscode.FoldingRange[]> {
		return new Promise<vscode.FoldingRange[]>(async (resolve, reject) => {
			if (Settings.isFoldingEnabled()) {
				let fileName = document.fileName;
				let result = GlobalCache.get(fileName);
				let ranges = getFoldingRanges(result);
				resolve(ranges);
			} else {
				reject([]);
			}
		});
	}
}