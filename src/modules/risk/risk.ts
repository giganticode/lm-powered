import * as vscode from 'vscode';
import { Context } from 'vm';
import { Settings } from '../../settings';
import * as path from 'path';
import URLQueryBuilder from 'url-query-builder';
const axios = require('axios');
const minimap = require('./minimap');
const worker = require('./worker');
var ranges: number[];

export function activate(context: vscode.ExtensionContext) {
	ranges = Settings.getRangesWithLowerBound();
	init(context);
	minimap.init();
	worker.init(context);

	vscode.workspace.onDidOpenTextDocument((event) => {
		var e = vscode.window.activeTextEditor as vscode.TextEditor;
		let content = e.document.getText();
		format(e, content);
	});

	vscode.workspace.onDidSaveTextDocument((event) => {
		var e = vscode.window.activeTextEditor as vscode.TextEditor;
		let content = e.document.getText();
		format(e, content);
	});

	vscode.workspace.onDidChangeTextDocument((event) => {
		//var e = vscode.window.activeTextEditor as vscode.TextEditor;
		//let content = e.document.getText();
		//format(e, content);
	});
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

function format(editor: vscode.TextEditor, document: string) {
	if (!Settings.isRiskEnabled() && !Settings.isMinimapEnabled()) {
		return;
	}

	let queryBuilder = new URLQueryBuilder(Settings.getLanguagemodelHostname());
	let filePath = editor._documentData._document.fileName;
	queryBuilder.set({
		languageId: editor._documentData._languageId,
		extension: path.extname(filePath),
		fileName: filePath,
		aggregator: Settings.getLanguagemodelAggregator()
	});
	
	axios.post(queryBuilder.get(), { input: document })
		.then(response => {
			if (Settings.isRiskEnabled()) {
				decorate(editor, response.data);
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

function decorate(editor: vscode.TextEditor, scanResult: number[]) {
	let decorationsMap: { [id: number]: any } = {};

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
	}
}