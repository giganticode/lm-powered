import * as vscode from 'vscode';
import {Settings, ColorRange} from '../../settings';
import {EntropyResult} from './risk';

var ranges: ColorRange[];
var decorationMap: DecorationMap = {};

interface DecorationMap {
    [key: number]: vscode.TextEditorDecorationType;
}

export function decorate(editor: vscode.TextEditor, scanResult: EntropyResult)  {
    let minRiskLevel = Settings.getMinimapMinRisk();
    let decorationsMap: {[key: number] : any} = {};

	for (var i = 0; i < scanResult.lines.length; i++) {
        let line = scanResult.lines[i];
        var riskLevel: number = line.line_entropy;
        let range = {range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0))};

        let rangeIndex = getRangeIndexForRisk(riskLevel, minRiskLevel);

        if (!decorationsMap[rangeIndex]) {
            decorationsMap[rangeIndex] = [];
        }
        decorationsMap[rangeIndex].push(range);
	}

	if (editor) {
		for(let key in decorationsMap) {
			editor.setDecorations(decorationMap[key], decorationsMap[key]);
		}
	}
}

export function init() {
    // set up the colors for the scrollbar
    ranges = Settings.getColorRanges();
    decorationMap = {};
    for (let i = 0; i < ranges.length; i++) {
        let item = ranges[i];
        let decorationStyle = {
            backgroundColor: 'light-grey',
            overviewRulerColor: item.Color
        };
        decorationMap[i] = vscode.window.createTextEditorDecorationType(decorationStyle);
    }
    decorationMap[-1] = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'light-grey',
        overviewRulerColor: 'transparent'
    });
}

function getRangeIndexForRisk(riskLevel: number, minRiskLevel: number) {
    if (riskLevel < minRiskLevel) {
        return -1;
    }
    for (let i = 0; i < ranges.length; i++) {
        let range: ColorRange = ranges[i];
        if (riskLevel >= range.Minimum && riskLevel < range.Maximum) {
            return i;
        }
    }
    return -1;
}