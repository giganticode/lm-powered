import * as vscode from 'vscode';
import { Context } from 'vm';
import {Token, EntropyLine, EntropyResult} from '../../baseDefinitions';
import GlobalCache from './globalCache';
import { Settings, ColorRange } from '../../settings';

var decorationMap: DecorationMap = {};
var ranges: ColorRange[];

interface DecorationMap {
	[key: number]: vscode.TextEditorDecorationType;
}

export function visualize(editor: vscode.TextEditor, fileName: string) {
	let scanResult: EntropyResult = GlobalCache.get(fileName);
	let decorationsMap: { [id: number]: any } = {};

	for (var i = 0; i < scanResult.lines.length; i++) {
		let line = scanResult.lines[i];
		var riskLevel: number = line.line_entropy;
		let decoration = {
			range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0))
		};

		let rangeIndex = getRangeIndexForRisk(riskLevel);
		if (!decorationsMap[rangeIndex]) {
			decorationsMap[rangeIndex] = [];
		}
		decorationsMap[rangeIndex].push(decoration);
	}

    for (let key in decorationsMap) {
        let decorationStyle = decorationMap[parseInt(key)];
        editor.setDecorations(decorationStyle, decorationsMap[key]);
	}

}

function getRangeIndexForRisk(riskLevel: number) {
	var index = 0;
	for (var i = 0; i < ranges.length; i++) {
		if (riskLevel > ranges[i].Minimum && riskLevel <= ranges[i].Maximum) {
			index = i + 1;
			break;
		}
	}
	return index;
}

export function init(context: Context) {
	ranges = Settings.getColorRanges();

	decorationMap = {};
	for (let i = 0; i <= ranges.length; i++) {
		decorationMap[i] = vscode.window.createTextEditorDecorationType({
			gutterIconPath: context.asAbsolutePath('./images/gutter/gutter_' + (i) + '.svg'),
			gutterIconSize: 'contain',
			textDecoration: 'none'
		});
	}
}