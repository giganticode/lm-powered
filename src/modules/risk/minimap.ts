import * as vscode from 'vscode';
import {Settings} from '../../settings';

var colors: string[];
var ranges: number[];
var decorationMap: DecorationMap = {};

interface DecorationMap {
    [key: number]: vscode.TextEditorDecorationType;
}

export function decorate(editor: vscode.TextEditor, scanResult: number[])  {
    let minRiskLevel = Settings.getMinimapMinRisk();
	let decorationsMap: {[key: number] : any} = {};

	for (var i = 0; i < scanResult.length; i++) {
        var riskLevel: number = scanResult[i];
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
    colors = Settings.getColors();
    ranges = Settings.getRanges();
    for (let key in colors) {
        let decorationStyle = getDecorationForRisk(parseInt(key));
        decorationMap[key] = vscode.window.createTextEditorDecorationType(decorationStyle);
    }
    decorationMap[-1] = vscode.window.createTextEditorDecorationType(getDecorationForRisk(-1));
}

function getDecorationForRisk(rangeIndex: number) {
    return {
        backgroundColor: 'light-grey',
        overviewRulerColor: rangeIndex >= 0 ? colors[rangeIndex] : 'transparent'
    };
}

function getRangeIndexForRisk(riskLevel: number, minRiskLevel: number) {
    if (riskLevel < minRiskLevel) {
        return -1;
    }
    var index = 0;
    for (var i = 0; i < ranges.length - 1; i++) {
        if (riskLevel > ranges[i] && riskLevel <= ranges[i+1]) {
            index = i + 1;
            break;
        }
    }
    return index;
}