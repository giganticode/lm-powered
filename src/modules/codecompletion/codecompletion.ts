import * as vscode from 'vscode';
import { Settings } from '../../settings';
import URLQueryBuilder from 'url-query-builder';
const axios = require('axios');
import * as fs from 'fs';
import * as path from 'path';
import { resolve } from 'dns';

// https://code.visualstudio.com/api/language-extensions/programmatic-language-features

export function activate(context: vscode.ExtensionContext) {
	
	let provider1 = vscode.languages.registerCompletionItemProvider('java', {

		provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
			// a simple completion item which inserts `Hello World!`
			const simpleCompletion = new vscode.CompletionItem('Hello World!');

			// a completion item that inserts its text as snippet,
			// the `insertText`-property is a `SnippetString` which we will
			// honored by the editor.
			const snippetCompletion = new vscode.CompletionItem('Good part of the day');
			snippetCompletion.insertText = new vscode.SnippetString('Good ${1|morning,afternoon,evening|}. It is ${1}, right?');
			snippetCompletion.documentation = new vscode.MarkdownString("Inserts a snippet that lets you select the _appropriate_ part of the day for your greeting.");

			// a completion item that can be accepted by a commit character,
			// the `commitCharacters`-property is set which means that the completion will
			// be inserted and then the character will be typed.
			const commitCharacterCompletion = new vscode.CompletionItem('console');
			commitCharacterCompletion.commitCharacters = ['.'];
			commitCharacterCompletion.documentation = new vscode.MarkdownString('Press `.` to get `console.`');

			// a completion item that retriggers IntelliSense when being accepted,
			// the `command`-property is set which the editor will execute after 
			// completion has been inserted. Also, the `insertText` is set so that 
			// a space is inserted after `new`
			const commandCompletion = new vscode.CompletionItem('new');
			commandCompletion.kind = vscode.CompletionItemKind.Keyword;
			commandCompletion.insertText = 'new ';
			commandCompletion.command = { command: 'editor.action.triggerSuggest', title: 'Re-trigger completions...' };

			// return all completion items as array
			return [
				simpleCompletion,
				snippetCompletion,
				commitCharacterCompletion,
				commandCompletion,
				new vscode.CompletionItem('public static void main(string[] args)', vscode.CompletionItemKind.Function),
			];
		}
	});

	const provider2 = vscode.languages.registerCompletionItemProvider(
		'java',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
				// get all text until the `position` and check if it reads `console.`
				// and iff so then complete if `log`, `warn`, and `error`
				let linePrefix = document.lineAt(position).text.substr(0, position.character);

				if (!linePrefix.endsWith('console.')) {
					return undefined;
				}

				return [
					new vscode.CompletionItem('log', vscode.CompletionItemKind.Method),
					new vscode.CompletionItem('warn', vscode.CompletionItemKind.Method),
					new vscode.CompletionItem('error', vscode.CompletionItemKind.Method),
					new vscode.CompletionItem('test', vscode.CompletionItemKind.Method),
				];
			}
		},
		'.' // triggered whenever a '.' is being typed
	);

	const lmProvider = vscode.languages.registerCompletionItemProvider(
		'java',
		{
			provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext) {
				// get all text until the `position` and check if it reads `console.`
				// and iff so then complete if `log`, `warn`, and `error`
				let fromLine = Math.max(0, position.line - 5);
				let content: string = "";

				for (let i = 0; i < 5; i++) {
					content += document.lineAt(fromLine + i).text + "\n";
				}

				let linePrefix = document.lineAt(position).text.substr(0, position.character);
				content += linePrefix;

				let queryBuilder = new URLQueryBuilder(Settings.getAutoCompletionHostname());

				return new Promise((resolve, reject) => { 
					axios.post(queryBuilder.get(), { 
						content: content,
						extension: 'java',
						languageId: 'java'
					}).then(response => {
							// response is an array of proposals
							resolve(response.data.map(item => {return new vscode.CompletionItem(item);}));
					}).catch(error => {
							if (error.response.status === 406) {
								// language type not supported
							} else {
								console.log(error);
							}
							reject();
					});					
				});
			}
		}
	);

	context.subscriptions.push(provider1, provider2, lmProvider);
}