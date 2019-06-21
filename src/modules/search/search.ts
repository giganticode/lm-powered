import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import { Settings } from '../../settings';
import URLQueryBuilder from 'url-query-builder';
import { Context } from 'vm';
import {Md5} from 'ts-md5/dist/md5';
var base64ToImage = require('base64-to-image');
const axios = require('axios');
var dataArray: Item[] = [];

let overviewPanel: vscode.WebviewPanel | undefined = undefined;
var documentReady: boolean = false;
var ctx: Context;
var remaining: number = 0;
var directoryMap: DirectoryMap = {};
var cacheMap: CacheMap = {};
var cachedWebViewContent: string | null = null;

interface DirectoryMap {
	[key: string]: Item;
}

interface CacheMap {
	[key: string]: CacheItem;
}

interface CacheItem {
	path: string;
	name: string;
	lastModified: Date;
}

interface Item {
	path: string;
	name: string;
	relativePath: string;
	lines: number;
	content: string;
	match: number[];
	lastModified: Date;
	hash: string;
}

export function activate(context: vscode.ExtensionContext) {
	ctx = context;

	let showOverview = vscode.commands.registerCommand('ide_visualization.showSearch', () => {
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

			setupMessageListener(context);

			// Reset when the current panel is closed
			overviewPanel.onDidDispose(() => {
				overviewPanel = undefined;
			}, null, context.subscriptions
			);

		}
	});

	context.subscriptions.push(showOverview);

}

function getCachedWebViewContent() {
	if (cachedWebViewContent === null) {
		cachedWebViewContent = getWebviewContent();
	}
	return cachedWebViewContent;
}

function getWebviewContent() {
	if (vscode.workspace.rootPath === null) {
		return "No workspace root defined";
	}

	const resourcePath = path.resolve(ctx.extensionPath, 'resources');

	dataArray = [];
	initDirectoryMap();
	initCache();

	for (let key in directoryMap) {
		let element = directoryMap[key];
		dataArray.push(element);
	}

	let htmlPath = ctx.asAbsolutePath('./src/modules/search/search.html');
	let fileContent = fs.readFileSync(htmlPath).toString();
	let html = fileContent.replace(/script src="([^"]*)"/g, (match, src) => {
		const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
		return `script src="${realSource}"`;
	}).replace(/link(.*)href="([^"]*)"/g, (match, other, src) => {
		const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
		return `link${other} href="${realSource}"`;
	});

	return html;
}

function initCache() {
	let cachePath = path.resolve(ctx.extensionPath, 'images', 'minimap');

	try {
		var files = fs.readdirSync(cachePath);

		files.forEach(function (file: any) {
			let absolutePath = path.join(cachePath, file);
			let newItem = {} as CacheItem;
			newItem.name = file;
			newItem.path = absolutePath;
			newItem.lastModified = fs.statSync(absolutePath).mtime;
			cacheMap[file] = newItem;
		});
	} catch (e) {
		console.log(e);
	}
}

function initDirectoryMap() {
	directoryMap = {} as DirectoryMap;
	let rootItem = {} as Item;
	rootItem.name = "root";
	rootItem.path = vscode.workspace.rootPath as string;
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
	remaining++;

	let queryBuilder = new URLQueryBuilder(Settings.getSearchHostname());
	queryBuilder.set({
		search: search,
		path: item.path,
		regex: regex,
	});

	item.match = [];
	axios.post(queryBuilder.get(), { input: item.content })
		.then(response => {
			item.match = response.data;
		})
		.catch(error => {
			console.log(error);
		})
		.finally(function () {
			remaining--;
			if (remaining === 0) {
				sendDataToDocument();
			}
		});
}

function sendDataToDocument() {
	if (documentReady) {
		let data = [];

		var index = 0;
		for (var key in directoryMap) {
			let item = directoryMap[key];
			data.push({ index: index++, match: item.match });
		}

		overviewPanel.webview.postMessage({ command: 'searchResults', data: data });
	} else {
		setTimeout(function () {
			sendDataToDocument();
		}, 100);
	}
}

function setupMessageListener(context: Context) {
	overviewPanel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case "init":
					// send files to webview
					documentReady = true;
					overviewPanel.webview.postMessage({ 
						command: 'init', 
						data: dataArray,
						cache: cacheMap,
						cachePath: path.join(ctx.extensionPath, 'images', 'minimap') + "/",
					});
					break;
				case "cacheImage":
					let cachePath = path.join(ctx.extensionPath, 'images', 'minimap');
					let hash = message.hash;
					let base64Str = message.img;
					var imgPath = cachePath + "/";
					var optionalObj =  {'fileName': hash, 'type':'png'};
					console.log("CACHE image " + hash);
					base64ToImage(base64Str,imgPath,optionalObj); 
					break;
				case "openFile":
					let filePath = message.path;
					var openPath = vscode.Uri.file(filePath); //A request file path
					vscode.workspace.openTextDocument(openPath).then(doc => {
						vscode.window.showTextDocument(doc).then(function () {
							if (message.line !== null) {
								let moveToLine = parseInt(message.line);
								let documentLineCount = vscode.window.activeTextEditor.document.lineCount;
								if (moveToLine > documentLineCount - 1) {
									moveToLine = documentLineCount - 1;
								}
								if (moveToLine < 0) {
									moveToLine = 0;
								}
								let moveToCharactor = vscode.window.activeTextEditor.document.lineAt(moveToLine).firstNonWhitespaceCharacterIndex;
								let newPosition = new vscode.Position(moveToLine, moveToCharactor);
								vscode.window.activeTextEditor.selection = new vscode.Selection(newPosition, newPosition);
								vscode.window.activeTextEditor.revealRange(vscode.window.activeTextEditor.selection, vscode.TextEditorRevealType.InCenter);
							}
						});

					});
					break;
				case "search":
					let search = message.value;
					let regex = message.value;
					remaining = 0;
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