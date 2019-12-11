import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import { Settings } from '../../settings';
import { Context } from 'vm';
import {Md5} from 'ts-md5/dist/md5';
import {Token, EntropyLine, EntropyResult} from '../../baseDefinitions';
const axios = require('axios');
var dataArray: Item[] = [];
const extension = require('../../extension');

let overviewPanel: vscode.WebviewPanel | undefined = undefined;
var ctx: Context;
var directoryMap: DirectoryMap = {};
var cachedWebViewContent: string | null = null;
let CACHE_PATH: string;

interface DirectoryMap {
	[key: string]: Item;
}

interface Item {
	path: string;
	name: string;
	relativePath: string;
	lines: number;
	content: string;
	match: object | null | false;
	lastModified: Date;
	hash: string;
}

export function activate(context: vscode.ExtensionContext) {
	ctx = context;
	CACHE_PATH = path.resolve(ctx.extensionPath, 'images', 'minimap');

	let showOverview = vscode.commands.registerCommand('lmpowered.showSearch', () => {
		let columnToShowIn: vscode.ViewColumn = (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : vscode.ViewColumn.One) as vscode.ViewColumn;

		if (overviewPanel) {
			// If we already have a panel, show it in the target column
			overviewPanel.reveal(columnToShowIn);
		} else {
			// Otherwise, create a new panel
			overviewPanel = vscode.window.createWebviewPanel(
				'search',
				'Search',
				columnToShowIn,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.file(path.join(context.extensionPath, 'resources')),
						vscode.Uri.file(path.join(context.extensionPath, 'images', 'minimap')),
					]
				}
			);

			overviewPanel.webview.html = getCachedWebViewContent();

			overviewPanel.onDidChangeViewState(e => {
				if (e.webviewPanel.visible && e.webviewPanel.active) {
					(overviewPanel as vscode.WebviewPanel).webview.html = getCachedWebViewContent();
				}
			}, null, context.subscriptions
			);

			setupMessageListener(overviewPanel, context);

			// Reset when the current panel is closed
			overviewPanel.onDidDispose(() => {
				overviewPanel = undefined;
			}, null, context.subscriptions
			);

		}
	});

	vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('lmpowered')) {
			cachedWebViewContent = null;
		}
	  }, null,
		context.subscriptions
	  );

	context.subscriptions.push(showOverview);
}

function generateSVGFromPath(filePath: string) {
	let extension = path.extname(filePath);
	if (Settings.excludeFileType.indexOf(extension) > -1) {
		return;
	}

	let content = fs.readFileSync(filePath).toString();
	let lines = content.split(/\r\n|\r|\n/);
	let lineCount = lines.length;
	content = content.replace("\t", "    ");
	let lastModified = fs.statSync(filePath).mtime;
	let hash = Md5.hashStr(filePath) as string;

	// Check if cached file exists
	let cachePath = path.join(CACHE_PATH, hash + ".svg");
	if (!fs.existsSync(cachePath) || fs.statSync(cachePath).mtime < lastModified) {
		// Cached file does not exists or is outdated -> create new one
		let svg = `<svg width="75" height="${lineCount*3}" viewPort="0 0 32 48" xmlns="http://www.w3.org/2000/svg">`;

		let y = 1;
		lines.forEach(function (line: string) {
			let indent = (line.match(/^\s*/)||[""])[0].length;
			let length = Math.min(line.length - indent, 75);
			svg += `<polygon points="${indent},${y} ${length},${y} ${length},${y+2} ${indent},${y+2}" fill="rgba(200,200,200,80)"/>`;
			y += 3;
		});
	
		svg += '</svg>';

		fs.writeFileSync(cachePath, svg);
	}
}

function getCachedWebViewContent() {
	if (cachedWebViewContent === null) {
		cachedWebViewContent = getWebviewContent();
	}
	return cachedWebViewContent;
}

function getWebviewContent() {
	console.log("Open webview search")
	console.log(extension)
	console.log(extension.currentWorkspaceFolder)
	if (!extension.currentWorkspaceFolder) {
		console.log("No workspace root defined")
		return "No workspace root defined";
	}

	try {

		const resourcePath = path.resolve(ctx.extensionPath, 'resources');
		console.log("resource path")
		dataArray = [];
		initDirectoryMap();
		console.log("inited directory map")
		initCache();
		console.log("inited cache")
		
		for (let key in directoryMap) {
			let element = directoryMap[key];
			dataArray.push(element);
		}
		
		let htmlPath = ctx.asAbsolutePath('./resources/search.html');
		let fileContent = fs.readFileSync(htmlPath).toString();
		let html = fileContent.replace(/script src="([^"]*)"/g, (match, src) => {
			const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
			return `script src="${realSource}"`;
		}).replace(/link href="(\.\/[^"]*)"/g, (match, src) => {
			const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
			return `link href="${realSource}"`;
		});
		
		return html;
	} catch(e) {
		console.log("error....");
		console.log(e);
		return "<html>Error, could not load html</html>"
	}
}

function initCache() {
	try {
		for (let file in directoryMap) {
			let item = directoryMap[file];
			generateSVGFromPath(item.path);
		}
	} catch (e) {
		console.log(e);
	}
}

function initDirectoryMap() {
	directoryMap = {} as DirectoryMap;
	let rootItem = {} as Item;
	rootItem.name = "root";
	rootItem.path = (extension.currentWorkspaceFolder as vscode.WorkspaceFolder).uri.fsPath;
	rootItem.relativePath = "root";
	scanItem(rootItem);
}

function scanItem(item: Item) {
	try {
		if (Settings.excludeFolderName.indexOf(item.name) > -1) {
			return;
		}

		var files = fs.readdirSync(item.path);

		files.forEach(function (file: any) {
			let relativePath = path.join(item.relativePath, file);
			let absolutePath = path.join(item.path, file);
			let newItem = {} as Item;
			newItem.name = file;
			newItem.relativePath = relativePath;
			newItem.path = absolutePath;
			newItem.match = null;

			if (fs.statSync(absolutePath).isDirectory()) {
				scanItem(newItem);
			} else {
				let extension = path.extname(file);
				if (Settings.excludeFileType.indexOf(extension) > -1) {
					return;
				}
				let content = fs.readFileSync(absolutePath).toString();
				let lineCount = content.split(/\r\n|\r|\n/).length;
				newItem.content = content;
				newItem.lines = lineCount;
				newItem.lastModified = fs.statSync(absolutePath).mtime;
				newItem.hash = Md5.hashStr(absolutePath) as string;
				directoryMap[relativePath] = newItem;
			}
		});
	} catch (e) {
		console.log(e);
	}
}

function getSearchResultFromWebServie(item: Item, search: string, regex: boolean) {
	let url = Settings.getSearchHostname();
	let matchIndicator = Settings.getSearchMatchIndicator();
	let searchInterval = Settings.getSearchQueryInterval();

	item.match = [];
	axios.post(url, { 
		content: item.content,
		search: search,
		languageId: path.extname(item.path).substr(1),
		searchInterval: searchInterval,
	 	}).then((response: any) => {
			console.log("got search result");
			console.log(response.data);

			let originalEntropies: EntropyResult = response.data.entropies.original;
			let searchEntropies: EntropyResult = response.data.entropies.search;

			originalEntropies.lines = originalEntropies.lines.filter((e, i) => i % searchInterval !== 0) as [EntropyLine];
			searchEntropies.lines = searchEntropies.lines.filter((e, i) => i % searchInterval !== 0) as [EntropyLine];

			let matches:any = {};
			for (let i = 0; i < originalEntropies.lines.length; i++) {
				let original = originalEntropies.lines[i].line_entropy;
				let search = searchEntropies.lines[i].line_entropy;

				let diff: number = original / search;
				diff = ((diff < 1 ? 1 / diff : diff) - 1) * 100;
				diff = isNaN(diff) ? 0 : diff;

				if (diff > matchIndicator) {
					matches[i] = diff;
				}
			}

			item.match = matches;
			console.log(matches)
		}).catch((error: any) => {
			console.log("Search error");
			console.log(error);
			item.match = {};
		}).finally(function () {
			let index = Object.keys(directoryMap).indexOf(item.relativePath);
			if (overviewPanel) {
				overviewPanel.webview.postMessage({ command: 'searchResults', data: {index: index, match: item.match} });
			}
		});
}
function setupMessageListener(overviewPanel: vscode.WebviewPanel, context: Context) {
	overviewPanel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case "init":
					// send files to webview
					overviewPanel.webview.postMessage({ 
						command: 'init', 
						data: dataArray,
						cachePath: path.join(ctx.extensionPath, 'images', 'minimap') + "/",
					});
					break;
				case "openFile":
					let filePath = message.path;
					var openPath = vscode.Uri.file(filePath); //A request file path
					vscode.workspace.openTextDocument(openPath).then(doc => {
						vscode.window.showTextDocument(doc).then((textEditor: vscode.TextEditor) => {
							if (message.line !== null) {
								let moveToLine = parseInt(message.line);
								let documentLineCount = textEditor.document.lineCount;
								if (moveToLine > documentLineCount - 1) {
									moveToLine = documentLineCount - 1;
								}
								if (moveToLine < 0) {
									moveToLine = 0;
								}
								let moveToCharactor = textEditor.document.lineAt(moveToLine).firstNonWhitespaceCharacterIndex;
								let newPosition = new vscode.Position(moveToLine, moveToCharactor);
								textEditor.selection = new vscode.Selection(newPosition, newPosition);
								textEditor.revealRange(textEditor.selection, vscode.TextEditorRevealType.InCenter);
							}
						});

					});
					break;
				case "search":
					let search = message.value;
					let regex = message.value;
					for (let key in directoryMap) {
						let item = directoryMap[key];
						getSearchResultFromWebServie(item, search, regex);
					}
					break;
			}

		},
		undefined,
		context.subscriptions
	);
}