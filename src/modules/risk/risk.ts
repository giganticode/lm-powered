import * as vscode from 'vscode';
import { Context } from 'vm';
import { Settings } from '../../settings';
import * as path from 'path';
const fs = require('fs');
import URLQueryBuilder from 'url-query-builder';
const axios = require('axios');
const minimap = require('./minimap');
const worker = require('./worker');
var ranges: number[];
var momenttz = require('moment-timezone');
var moment = require('moment');

export function activate(context: vscode.ExtensionContext) {
	ranges = Settings.getRangesWithLowerBound();
	init(context);
	minimap.init();
	
	vscode.workspace.onDidOpenTextDocument((event) => {
		console.log("opened");
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
		//var e = vscode.window.activeTextEditor as vscode.TextEditor;
		//let content = e.document.getText();
		//format(e, content);
	});
	
	vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			let activeEditor = editor as vscode.TextEditor;
		
			format(activeEditor, activeEditor.document.getText(), true);
	
			if (editor) {
				//triggerUpdateDecorations();
			}
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

	
}

interface DecorationMap {
	[key: number]: vscode.TextEditorDecorationType;
}

var decorationMap: DecorationMap = {};

function init(context: Context) {
	for (let key in ranges) {
		decorationMap[key] = vscode.window.createTextEditorDecorationType({
			gutterIconPath: context.asAbsolutePath('./images/gutter/gutter_' + key + '.svg'),
			gutterIconSize: 'contain',
			textDecoration: 'none'
		});
	}
}

function format(editor: vscode.TextEditor, document: string, openEvent: boolean) {
	if (!Settings.isRiskEnabled() && !Settings.isMinimapEnabled()) {
		return;
	}

	let queryBuilder = new URLQueryBuilder(Settings.getLanguagemodelHostname());
	let filePath = editor._documentData._document.fileName;
	queryBuilder.set({
	/*	languageId: editor._documentData._languageId,
		extension: path.extname(filePath),
		filePath: filePath,
		aggregator: Settings.getLanguagemodelAggregator(),
		noReturn: false,
		timeStamp: new Date()*/
	});

	let timestamp = fs.statSync(filePath).mtimeMs;

	axios.post(queryBuilder.get(), { 
		content: document,
		extension: path.extname(filePath),
		languageId: editor._documentData._languageId,
		filePath: filePath,
		timestamp: timestamp,
		noReturn: false,
		aggregator: Settings.getLanguagemodelAggregator()
	})
		.then(response => {
			console.log("got feedback");
			if (Settings.isRiskEnabled()) {
				decorate(editor, response.data, openEvent);
			}
			if (Settings.isMinimapEnabled()) {
				minimap.decorate(editor, response.data);
			}
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
	for (var i = 0; i < ranges.length - 1; i++) {
		if (riskLevel > ranges[i] && riskLevel <= ranges[i + 1]) {
			index = i + 1;
			break;
		}
	}
	return index;
}

function decorate(editor: vscode.TextEditor, scanResult: number[], openEvent: boolean) {
	let decorationsMap: { [id: number]: any } = {};

	console.log("scanresult:")
	console.log(scanResult)

	for (var i = 0; i < scanResult.length; i++) {
		var riskLevel: number = scanResult[i];
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
			let queryBuilder = new URLQueryBuilder(Settings.getLanguagemodelHostname());
			let filePath = document.fileName;
			queryBuilder.set({
			/*	languageId: document.languageId,
				extension: path.extname(filePath),
				fileName: filePath,
				aggregator: Settings.getLanguagemodelAggregator()*/
			});

			let timestamp = fs.statSync(filePath).mtimeMs;
			
			axios.post(queryBuilder.get(), {
					content: document.getText(),
					extension: path.extname(filePath),
					languageId: document.languageId,
					filePath: filePath,
					timestamp: timestamp,
					noReturn: false,
					aggregator: Settings.getLanguagemodelAggregator()
				})
				.then(response => {
					console.log("got feedback for folding range provider");
					console.log(response.data);
					let ranges = getFoldingRanges(response.data);
					console.log(ranges)
					resolve(ranges);
				})
				.catch(error => {
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