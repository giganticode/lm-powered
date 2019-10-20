import * as vscode from 'vscode';
import { Context } from 'vm';
import { Settings, ColorRange } from '../../settings';
import * as path from 'path';
const fs = require('fs');
const axios = require('axios');
const minimap = require('./minimap');
const worker = require('./worker');

var ranges: ColorRange[];
var decorationMap: DecorationMap = {};
var entropyCacheMap: EntropyCacheMap = {};

interface DecorationMap {
	[key: number]: vscode.TextEditorDecorationType;
}

interface EntropyLine {
	aggregated_result: AggregatedResult;
	prep_metadata: PrepMetadata;
	prep_text: [string];
	results: EntropyResults;
	text: string;
}

interface EntropyResults {
	bin_entropy: [number];
}

interface AggregatedResult {
	bin_entropy: number;
}

interface PrepMetadata {
	nonprocessable_tokens: [string];
	word_boundaries: [number];
}

interface EntropyCacheMap {
	[key: string]: [EntropyLine];
}

export function activate(context: vscode.ExtensionContext) {
	ranges = Settings.getColorRanges();

	init(context);
	minimap.init();
	
	vscode.workspace.onDidOpenTextDocument((event) => {
		var e = vscode.window.activeTextEditor as vscode.TextEditor;
		let content = e.document.getText();
		format(e, content, true);
	}, null, context.subscriptions);

	vscode.workspace.onDidSaveTextDocument((event) => {
		var e = vscode.window.activeTextEditor as vscode.TextEditor;
		let content = e.document.getText();
		format(e, content, false);
	});

	vscode.workspace.onDidChangeTextDocument((event) => {
		var e = vscode.window.activeTextEditor as vscode.TextEditor;
		let content = e.document.getText();
		format(e, content, false);
	});
	
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			let activeEditor = editor as vscode.TextEditor;
			format(activeEditor, activeEditor.document.getText(), true);
		}
	}, null, context.subscriptions);

	if (Settings.isFoldingEnabled()) {
		vscode.languages.registerFoldingRangeProvider({ scheme: 'file', language: 'java' }, new ImportFoldingRangeProvider());
	}

	worker.init(context);

	let editor = vscode.window.activeTextEditor;
	if (editor) {
		let activeEditor = editor as vscode.TextEditor;
		format(activeEditor, activeEditor.document.getText(), true);
	}

	vscode.languages.registerHoverProvider('java', {
		provideHover(document, position, token) {
			let fileEntropyInfo = entropyCacheMap[document.fileName];
			let lineEntropyInfo = fileEntropyInfo[position.line];
			if (!fileEntropyInfo || !lineEntropyInfo) {
				return {contents: "No data available"};
			}
			let remainingText = lineEntropyInfo.text;
			let targetColumn = position.character;
			let globalIndex = 0;

			for (let j = 0; j < lineEntropyInfo.prep_text.length; j++) {
				let text = lineEntropyInfo.prep_text[j].replace('</t>', '');
				let entropy = lineEntropyInfo.results.bin_entropy[j];
   
				// search text in line Text
				let found = false;
				let startIndex = 0;
				let endIndex = text.length;
				let iteration = 0;
				while (found === false) {
   
					if (remainingText.substring(startIndex, endIndex) === text) {
						remainingText = remainingText.substring(endIndex);
						
						if (targetColumn >= globalIndex + startIndex && targetColumn < globalIndex + endIndex) {
							return {
								contents: [`Line entropy: ${lineEntropyInfo.aggregated_result.bin_entropy.toFixed(3)} - Token '${text}' -> ${entropy.toFixed(3)}`]
							};
						}

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

		  return {
			contents: [`Line entropy: ${lineEntropyInfo.aggregated_result.bin_entropy.toFixed(3)}`]
		  };
		}
	  });
}

function init(context: Context) {
	decorationMap = {};
	for (let i = 0; i <= ranges.length; i++) {
		decorationMap[i] = vscode.window.createTextEditorDecorationType({
			gutterIconPath: context.asAbsolutePath('./images/gutter/gutter_' + (i) + '.svg'),
			gutterIconSize: 'contain',
			textDecoration: 'none'
		});
	}
}

function format(editor: vscode.TextEditor, document: string, openEvent: boolean) {
	if (!Settings.isRiskEnabled() && !Settings.isMinimapEnabled()) {
		return;
	}

	let url = Settings.getLanguagemodelHostname();
	let filePath = editor._documentData._document.fileName;
	let timestamp = fs.statSync(filePath).mtimeMs;

	axios.post(url, { 
		content: document,
		extension: path.extname(filePath),
		languageId: editor._documentData._languageId,
		filePath: filePath,
		timestamp: timestamp,
		noReturn: false,
	})
		.then(response => {
			console.log("got feedback");
			if (Settings.isRiskEnabled()) {
				decorate(editor, response.data, openEvent);
			}
			if (Settings.isMinimapEnabled()) {
				minimap.decorate(editor, response.data);
			}
			console.log("format", editor)
			entropyCacheMap[editor._documentData._document.fileName] = response.data;
		})
		.catch(error => {
			if (error.response.status === 406) {
				// file not supported
			} else {
				console.log(error);
			}
		});
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

function decorate(editor: vscode.TextEditor, scanResult: any[], openEvent: boolean) {
	let decorationsMap: { [id: number]: any } = {};

	console.log("scanresult:")
	console.log(scanResult)

	for (var i = 0; i < scanResult.length; i++) {
		var riskLevel: number = scanResult[i].aggregated_result.bin_entropy;
		let decoration = {
			range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0))
		};

		let rangeIndex = getRangeIndexForRisk(riskLevel);
		if (!decorationsMap[rangeIndex]) {
			decorationsMap[rangeIndex] = [];
		}
		decorationsMap[rangeIndex].push(decoration);
	}

	if (editor) {
		for (let key in decorationsMap) {
			let decorationStyle = decorationMap[parseInt(key)];
			editor.setDecorations(decorationStyle, decorationsMap[key]);
		}

		if (Settings.isFoldingOnOpenEnabled() && openEvent) { 
			let ranges = getFoldingRanges(scanResult);
			let positions: number[]  = ranges.map(e => e.start);
			vscode.commands.executeCommand('editor.fold', {levels: 1, direction: 'down', selectionLines: positions}); //2,6
			console.log("folded positions...");
			console.log(positions);
		}

	}
}

function getFoldingRanges(scanResult: number[]): vscode.FoldingRange[] {
	let ranges: vscode.FoldingRange[] = [];
	
	var from: number = 0;
	var to: number = 0;
	var inRange: boolean = false;
	var added: boolean = false;
	const MAX = Settings.getFoldingMaxRisk();

	for (var i = 0; i < scanResult.length; i++) {
		var riskLevel: number = scanResult[i];
		
		if (riskLevel < MAX) {
			if (inRange === false) {
				from = i;
				to = i;
				inRange = true;
				added = false;
			} else {
				to = i;
			}
		} else if (added === false) {
			added = true;
			ranges.push(new vscode.FoldingRange(from, to));
			inRange = false;
		}
	}

	return ranges;
}

class ImportFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] |Thenable<vscode.FoldingRange[]> {

		return new Promise<vscode.FoldingRange[]>(async (resolve, reject) => {
			let url = Settings.getLanguagemodelHostname();
			let filePath = document.fileName;
			let timestamp = fs.statSync(filePath).mtimeMs;
			
			axios.post(url, {
					content: document.getText(),
					extension: path.extname(filePath),
					languageId: document.languageId,
					filePath: filePath,
					timestamp: timestamp,
					noReturn: false,
				})
				.then((response: any) => {
					console.log("got feedback for folding range provider");
					console.log(response.data);
					let ranges = getFoldingRanges(response.data);
					console.log(ranges)
					resolve(ranges);
				})
				.catch((error: any) => {
					if (error.response.status === 406) {
						// file not supported
						console.log("Folding: file not supported")
					} else {
						console.log(error);
					}
					reject([]);
				});			
		  });
	}
}