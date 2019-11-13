import * as vscode from 'vscode';
import {Token, EntropyLine, EntropyResult} from '../../baseDefinitions';
import GlobalCache from './globalCache';
import { Settings, ColorRange } from '../../settings';

interface DecoratorInstances {
    [key: string]: vscode.TextEditorDecorationType;
}

interface DecoratorMap {
    [key: string]: DecoratorDescription;
}

interface DecoratorDescription {
    name: string;
    regions: vscode.DecorationOptions[];
    decorator: undefined | vscode.TextEditorDecorationType;
}

const decoratorInstances: DecoratorInstances = {};

export function clear(editor: vscode.TextEditor) {
    // Clear decorations
    const keys = Object.keys(decoratorInstances);
    for (const key of keys) {
        editor.setDecorations(decoratorInstances[key], []);
    }
}

export function visualize(editor: vscode.TextEditor, fileName: string) {
	let entropies: EntropyResult = GlobalCache.get(fileName);	
    if (editor === undefined || editor.viewColumn === undefined) {
        return;
    }

	clear(editor);

    const decoratorMap: DecoratorMap = {};

	for (var i = 0; i < entropies.lines.length; i++) {
		let line = entropies.lines[i];

		let remainingText = line.text;
		let globalIndex = 0;

		for (let j = 0; j < line.tokens.length; j++) {
			let token = line.tokens[j];
			let text = token.text.replace('</t>', '');
			let entropy = token.entropy;

			// search text in line Text
			let found = false;
			let startIndex = 0;
			let endIndex = text.length;
			let iteration = 0;
			while (found === false) {

				if (remainingText.substring(startIndex, endIndex) === text) {
					remainingText = remainingText.substring(endIndex);
					
					let color = getColorForEntropy(token.entropy);
					const decorator = createDecoratorInstance(color);
					const decoration = {
						range: new vscode.Range(new vscode.Position(i, globalIndex + startIndex), new vscode.Position(i, globalIndex + endIndex))
					};
					// console.log(`add color ${color} for token ${token.text} from ${charStart} to ${ charStart + token.text.length}`);

					if (decoratorMap[color] === undefined) {
						decoratorMap[color] = {
							name: color,
							regions: [],
							decorator: undefined
						};
					}
		
					decoratorMap[color].regions.push(decoration);
					decoratorMap[color].decorator = decorator;

					globalIndex += endIndex;
					found = true;
				}
				else {
					// handle a whitespace that is not part of the token
					startIndex++;
					endIndex++;
				}
				iteration++;
				if (iteration > 12) {
					break;
				}
			}
		}

	}

	const keys = Object.keys(decoratorMap);
	for (const key of keys) {
		const decoratorDescription = decoratorMap[key];

		if (decoratorDescription.decorator !== undefined) {
			editor.setDecorations(decoratorDescription.decorator, []);
			editor.setDecorations(
				decoratorDescription.decorator,
				decoratorDescription.regions
			);
		}
	}

}

function createDecoratorInstance(color: string) {
    if (decoratorInstances[color] !== undefined) {
        return decoratorInstances[color];
    }

    const instance = vscode.window.createTextEditorDecorationType({
        isWholeLine: false,
        backgroundColor: color
    });

    decoratorInstances[color] = instance;
    return instance;
}

function getColorForEntropy(riskLevel: number) {
    let ranges = Settings.getColorRanges();
	for (var i = 0; i < ranges.length; i++) {
		if (riskLevel >= ranges[i].Minimum && riskLevel < ranges[i].Maximum) {
			return ranges[i].Color;
		}
	}
	return ranges[ranges.length - 1].Color;
}