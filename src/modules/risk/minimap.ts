import * as vscode from 'vscode';
import {Settings, ColorRange} from '../../settings';

var ranges: ColorRange[];
var decorationMap: DecorationMap = {};

interface DecorationMap {
    [key: number]: vscode.TextEditorDecorationType;
}

export function decorate(editor: vscode.TextEditor, scanResult: any[])  {
    let minRiskLevel = Settings.getMinimapMinRisk();
	let decorationsMap: {[key: number] : any} = {};

	for (var i = 0; i < scanResult.length; i++) {
        var riskLevel: number = scanResult[i].aggregated_result.bin_entropy;
        let range = {
            range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0))
        };

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
    ranges = Settings.getColorRanges();
    decorationMap = {};
    for (let key in ranges) {
        let item = ranges[key];
        let decorationStyle = {
            backgroundColor: 'light-grey',
            overviewRulerColor: item.Color
        };
        decorationMap[parseInt(key) + 1] = vscode.window.createTextEditorDecorationType(decorationStyle);
    }
    decorationMap[0] = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'light-grey',
        overviewRulerColor: 'transparent'
    });
}

function getRangeIndexForRisk(riskLevel: number, minRiskLevel: number) {
    if (riskLevel < minRiskLevel) {
        return 0;
    }
    var index = 0;
    for (var i = 0; i < ranges.length; i++) {
        let range = ranges[i];
        if (riskLevel > range.Minimum && riskLevel <= range.Maximum) {
            index = i + 1;
            break;
        }
    }
    return index;
}