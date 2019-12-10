import * as vscode from 'vscode';
import { Settings } from '../../settings';
const axios = require('axios');

// https://code.visualstudio.com/api/language-extensions/programmatic-language-features

function remove_eol_eof(str: string) {
	if (str.startsWith('<EOL>') || str.startsWith('<EOF>')) {
		return str.substr(5);
	} else {
		return str;
	}
}

export function activate(context: vscode.ExtensionContext) {
	let contextLineCount = 10;

	const languagemodelCompletionProvider = vscode.languages.registerCompletionItemProvider(
		{ scheme: 'file', language: 'java' },
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {

				if (!Settings.isAutoCompletionEnabled()) {
					return null;
				}

				let fromLine = Math.max(0, position.line - contextLineCount);
				let content: string = "";

				for (let i = 0; i < position.line - fromLine; i++) {
					content += document.lineAt(fromLine + i).text + "\n";
				}
				let linePrefix = document.lineAt(position).text.substr(0, position.character);
				content += linePrefix;

				let url = Settings.getAutoCompletionHostname();

				return new Promise((resolve, reject) => { 
					axios.post(url, { 
						content: content,
						languageId: 'java',
						resetContext: true,
						proposalsCount: 20,
						model: Settings.getSelectedModel(),
					}).then((response: any) => {
						// response is an array of proposals
						let metadata = response.data.metadata;
						let predictions = response.data.predictions;

						let proposals = predictions.map((item: any) => {return {text: item[0], value: item[1]};});
						proposals.sort((a: any, b: any) => (a.value < b.value));
						console.log(proposals);
						
						resolve(proposals.map((item: any, index: number) => {
							let completion_item = new vscode.CompletionItem(item.text);
							completion_item.sortText = "" + (1-item.value);
							completion_item.detail = "" + (item.value * 100).toFixed(2) + "%";
							completion_item.insertText = remove_eol_eof(item.text);
							completion_item.preselect = (index === 0);
							return completion_item;
						}));
					}).catch((error: any) => {
						if (error.response.status === 406) {
							// language type not supported
						} else {
							console.log(error);
						}
						reject();
					});					
				});
			}
		}, 
		' ', '.', '-', '\t', '', '*'
	);

	context.subscriptions.push(languagemodelCompletionProvider);
}