import * as vscode from 'vscode';
import { Settings } from '../../settings';
import GlobalCache from './globalCache';
import * as hoverProvider from './hoverProvider';
import * as foldingProvider from './foldingProvider';
import * as highlightProvider from './highlightProvider';
import * as minimapProvider from './minimapProvider';
import * as lineEntropyProvider from './lineEntropyProvider';
import * as worker from './worker';

const fs = require('fs');
const axios = require('axios');
const extension = require('../../extension');
let debugModeEnabled = false;
let timer : NodeJS.Timeout | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {

	vscode.workspace.onDidSaveTextDocument((event) => {
		let editor = vscode.window.activeTextEditor;
		if (editor) {
			updateVisualization(editor, false);
		}
	}, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument((event) => {
		if (timer) {
			clearTimeout(timer);
		}
		
		let editor = vscode.window.activeTextEditor;
		timer = setTimeout(function() {
			if (editor) {
				updateVisualizationWithoutSaving(editor);
			}
		}, 2500);

	}, null, context.subscriptions);

	vscode.workspace.onDidCloseTextDocument((event) => {
		// free cache
		GlobalCache.delete(event.fileName);
	}, null, context.subscriptions);
	
	vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			updateVisualization(editor, true);
		}
	}, null, context.subscriptions);

	vscode.commands.registerCommand('lmpowered.showDebug', () => {
		let editor = vscode.window.activeTextEditor;
		if (editor) {
			highlightProvider.visualize(editor, editor.document.fileName);
		}
		debugModeEnabled = true;
	});

	vscode.commands.registerCommand('lmpowered.clearDebug', () => {
		let editor = vscode.window.activeTextEditor;
		if (editor) {
			highlightProvider.clear(editor);
		}
		debugModeEnabled = false;
	});
	
	hoverProvider.register();
	foldingProvider.register();
	minimapProvider.init();
	lineEntropyProvider.init(context);
	worker.init();	

	let editor = vscode.window.activeTextEditor;
	if (editor) {
		updateVisualization(editor, true);
	}
}

function updateVisualizationWithoutSaving(editor: vscode.TextEditor) {
	if (!Settings.isRiskEnabled() && !Settings.isMinimapEnabled()) {
		return;
	}

	let url = Settings.getLanguagemodelHostname();

	axios.post(url, { 
		content: editor.document.getText(),
		languageId: editor.document.languageId,
		noReturn: false,
		resetContext: false,
		metrics: Settings.getSelectedMetric(),		
		tokenType: Settings.getSelectedTokenType(),
		model: Settings.getSelectedModel()
	}).then((response: any) => {
		let fileName = editor.document.fileName;
		GlobalCache.add(fileName, response.data.entropies);

		if (Settings.isRiskEnabled()) {
			lineEntropyProvider.visualize(editor, fileName);
		}
		
		if (Settings.isMinimapEnabled()) {
			minimapProvider.visualize(editor, fileName);
		}

		if (debugModeEnabled) {
			highlightProvider.visualize(editor, fileName);
		} else {
			highlightProvider.clear(editor);
		}

	}).catch((error: any) => {
		if (error.response.status === 406) {
			// file not supported
		} else {
			console.log(error);
		}
	});
}

function updateVisualization(editor: vscode.TextEditor, openEvent: boolean) {
	if (!Settings.isRiskEnabled() && !Settings.isMinimapEnabled()) {
		return;
	}

	if (editor.document.isDirty) {
		updateVisualizationWithoutSaving(editor);
		return;
	}

	let url = Settings.getLanguagemodelHostname();
	let filePath = editor.document.fileName;
	let timestamp = fs.statSync(filePath).mtimeMs;

	axios.post(url, { 
		content: editor.document.getText(),
		languageId: editor.document.languageId,
		filePath: filePath,
		timestamp: timestamp,
		noReturn: false,
		resetContext: false,
		metrics: Settings.getSelectedMetric(),		
		tokenType: Settings.getSelectedTokenType(),
		model: Settings.getSelectedModel(),
		workspaceFolder: extension.currentWorkspaceFolder
		}).then((response: any) => {
			let fileName = editor.document.fileName;
			GlobalCache.add(fileName, response.data.entropies);

			if (Settings.isRiskEnabled()) {
				lineEntropyProvider.visualize(editor, fileName);
			}
			
			if (Settings.isMinimapEnabled()) {
				minimapProvider.visualize(editor, fileName);
			}

			if (debugModeEnabled) {
				highlightProvider.visualize(editor, fileName);
			} else {
				highlightProvider.clear(editor);
			}

			if (Settings.isFoldingOnOpenEnabled() && openEvent) { 
				foldingProvider.visualize(editor, fileName);
			}

		}).catch((error: any) => {
			if (error.response.status === 406) {
				// file not supported
			} else {
				console.log(error);
			}
		});
}