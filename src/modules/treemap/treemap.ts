import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from "fs";
import { Settings } from '../../settings';
import { Context } from 'vm';
import {EntropyResult} from '../../baseDefinitions';
import { save_session_cookie } from '../../util';
const axios = require('axios');
const extension = require('../../extension');

let overviewPanel: vscode.WebviewPanel | undefined = undefined;
var documentReady: boolean = false;
var ctx: Context;
var directoryMap: DirectoryMap = {};
var directoryParentMap: DirectoryParentMap = {};
var cachedWebViewContent: string | null = null;

enum Risk {
	NotCalculated = -1,
	NotSupported = -2,
}

interface DirectoryMap {
	[key: string]: Item;
}

interface DirectoryParentMap {
	[key: string]: Item[];
}

interface Item {
	path: string;
	name: string;
	relativePath: string;
	parent: string | null;
	lines: number;
	content: string;
	risk: number[];
	isFile: boolean;
	riskLevel: number | Risk;
}

enum RiskType {
	Average,
	Median,
	Maximum
}

export function activate(context: vscode.ExtensionContext) {
	ctx = context;

	let showOverview = vscode.commands.registerCommand('lmpowered.showOverview', () => {
		let columnToShowIn: vscode.ViewColumn = (vscode.window.activeTextEditor ? vscode.window.activeTextEditor.viewColumn : vscode.ViewColumn.One) as vscode.ViewColumn;

		if (overviewPanel) {
			// If we already have a panel, show it in the target column
			overviewPanel.reveal(columnToShowIn);
		} else {
			// Otherwise, create a new panel
			overviewPanel = vscode.window.createWebviewPanel(
				'risktreemap',
				'Risk Treemap',
				columnToShowIn,
				{
					enableScripts: true,
					retainContextWhenHidden: true,
					localResourceRoots: [
						vscode.Uri.file(path.join(context.extensionPath, 'resources'))
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

			setupWebviewListeners(overviewPanel, context);

			// Reset when the current panel is closed
			overviewPanel.onDidDispose(() => {
				overviewPanel = undefined;
				cachedWebViewContent = null;
				documentReady = false;
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
	if (!extension.currentWorkspaceFolder) {
		return "No workspace root defined";
	}

	let htmlPath = ctx.asAbsolutePath('./resources/treemap.html');
	const resourcePath = path.resolve(ctx.extensionPath, 'resources');
	let fileContent = fs.readFileSync(htmlPath).toString();

	let ranges = Settings.getColorRanges();

	initDirectoryMap();

	// TODO: send ranges to client view
	var cssColors = "";
	for (let key in ranges) {
		let item = ranges[key];
		let color = item.Color;
		cssColors += `.noUi-connects .noUi-connect:nth-child(${(1 + parseInt(key))}) \n{background-color: ${color} !important;}\n`;
	}

	let html = fileContent.replace(/script src="(\.\/[^"]*)"/g, (match, src) => {
		const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
		return `script src="${realSource}"`;
	}).replace(/CSSCOLORS/, cssColors).replace(/link href="(\.\/[^"]*)"/g, (match, src) => {
		const realSource = 'vscode-resource:' + path.resolve(resourcePath, src);
		return `link href="${realSource}"`;
	});

	return html;
}

function calcRisk(item: Item, riskType: RiskType): any {
	var globalNotSupported = true;
	var globalSupported: number = 0;
	var globalRisk: number = 0;
	var globalRiskArray: number[] = [];
	let children: Item[] = directoryParentMap[item.relativePath] ? directoryParentMap[item.relativePath] : [];

	let files = children.filter(i => i.isFile === true);
	let directories = children.filter(i => i.isFile === false);

	// first left side of Tree (directories)
	directories.forEach(directory => {
		let riskLevel = calcRisk(directory, riskType);
		if (riskLevel === Risk.NotSupported) {
			return;
		} else {
			globalSupported++;
			globalNotSupported = false;
		}
		if (riskType === RiskType.Median) {
			globalRiskArray = globalRiskArray.concat(riskLevel);
			globalRiskArray.sort();
		} else if (riskType === RiskType.Maximum) {
			globalRisk = Math.max(riskLevel, globalRisk);
		} else {
			globalRisk += riskLevel;
		}
	});

	// then right side of Tree (files)
	files.forEach(file => {
		if (file.riskLevel === Risk.NotSupported) {
			return;
		} else {
			globalSupported++;
			globalNotSupported = false;
		}
		if (riskType === RiskType.Average) {
			var sum: number = 0;
			file.risk.forEach(e => sum += e);
			file.riskLevel = sum / file.risk.length;
			globalRisk += file.riskLevel;
		} else if (riskType === RiskType.Maximum) {
			file.risk.sort();
			file.riskLevel = file.risk.length > 0 ? file.risk[file.risk.length - 1] : 0;
			globalRisk = Math.max(globalRisk, file.riskLevel);
		} else if (riskType === RiskType.Median) {
			file.risk.sort();
			file.riskLevel = file.risk.length > 0 ? file.risk[Math.ceil(file.risk.length / 2)] : 0;
			globalRiskArray = globalRiskArray.concat(file.risk);
			globalRiskArray.sort();
		}
	});

	if (riskType === RiskType.Average) {
		globalRisk /= children.length > 0 ? (globalSupported === 0 ? 1 : globalSupported) : 1;
		item.riskLevel = globalRisk;
	} else if (riskType === RiskType.Maximum) {
		item.riskLevel = globalRisk;
	} else if (riskType === RiskType.Median) {
		item.riskLevel = globalRiskArray.length > 0 ? globalRiskArray[Math.ceil(globalRiskArray.length / 2)] : 0;
	}

	if (globalNotSupported) {
		item.riskLevel = Risk.NotSupported;
		return Risk.NotSupported;
	}

	return riskType === RiskType.Median ? globalRiskArray : globalRisk;
}

function initDirectoryMap() {
	directoryMap = {} as DirectoryMap;
	directoryParentMap = {} as DirectoryParentMap;
	let rootItem = {} as Item;
	rootItem.isFile = false;
	rootItem.riskLevel = Risk.NotCalculated;
	rootItem.parent = null;
	rootItem.name = "root";
	rootItem.path = (extension.currentWorkspaceFolder as vscode.WorkspaceFolder).uri.fsPath;
	rootItem.relativePath = "root";
	directoryMap["root"] = rootItem;
	scanItem(rootItem);

	// remove empty directories
	for (var key in directoryMap) {
		let item = directoryMap[key];
		let children: Item[] = directoryParentMap[item.relativePath] ? directoryParentMap[item.relativePath] : [];

		if (!item.isFile && children.length === 0) {
			delete (directoryParentMap[item.relativePath]);
			delete (directoryMap[key]);
		}
	}

	getRiskLevelsFromWebService();
}

function scanItem(item: Item) {
	try {

		if (Settings.excludeFolderName.indexOf(item.name) > -1) {
			delete (directoryMap[item.relativePath]);
			let parent = directoryMap[item.parent as string] as Item;
			directoryParentMap[parent.relativePath].splice(-1, 1);
			return;
		}
		var files = fs.readdirSync(item.path);

		files.forEach(function (file: any) {
			let relativePath = path.join(item.relativePath, file);
			let absolutePath = path.join(item.path, file);
			let newItem = {} as Item;
			newItem.name = file;
			newItem.riskLevel = Risk.NotCalculated;
			newItem.parent = item.relativePath;
			newItem.relativePath = relativePath;
			newItem.path = absolutePath;
			newItem.isFile = !fs.statSync(absolutePath).isDirectory();
			let extension = path.extname(file);

			// check if file can be added:
			if ((!newItem.isFile && Settings.excludeFolderName.indexOf(newItem.name) > -1) || (newItem.isFile && Settings.excludeFileType.indexOf(extension) > -1)) {
				return;
			}

			directoryMap[relativePath] = newItem;
			if (directoryParentMap[item.relativePath] === undefined) {
				directoryParentMap[item.relativePath] = [];
			}
			directoryParentMap[item.relativePath].push(newItem);

			if (newItem.isFile === false) {
				scanItem(newItem);
			} else {
				newItem.isFile = true;
				let content = fs.readFileSync(absolutePath).toString();
				let lineCount = content.split(/\r\n|\r|\n/).length;
				newItem.lines = lineCount;
				newItem.content = content;
				pending.push(newItem);
			}
		});
	} catch (e) {
		console.log(e);
	}
}

var pending: Item[] = [];

function getRiskLevelsFromWebService() {
	if (pending.length === 0) {
		// TODO: every time a file is received
		calcRisk(directoryMap["root"], RiskType.Average);
		sendDataToDocument();
		return;
	}

	let item = pending.shift() as Item;

	let url = Settings.getRiskUrl();
	let timestamp = fs.statSync(item.path).mtimeMs;

	item.risk = [];
	axios.post(url, {  
			content: item.content,
			languageId: path.extname(item.path).replace(/\./, ''),
			filePath: item.path,
			timestamp: timestamp,
			noReturn: false,
			resetContext: false,
			metrics: Settings.getSelectedMetric(),		
			tokenType: Settings.getSelectedTokenType(),
			model: Settings.getSelectedModel(),
			workspaceFolder: extension.currentWorkspaceFolder
	 	})
		.then((response: any) => {
			save_session_cookie(response);
			let entropies: EntropyResult = response.data.entropies;
			item.risk = entropies.lines.map(e => e.line_entropy);
		})
		.catch((error: any) => {
			if (error && error.response && error.response.status && error.response.status === 406) {
				item.riskLevel = Risk.NotSupported;
			} else {
				console.log("error");
				console.log(error);
			}
		})
		.finally(function () {
			getRiskLevelsFromWebService();
		});
}

function sendDataToDocument() {
	if (documentReady) {
		let data = [];

		var index = 1;
		for (var key in directoryMap) {
			let item = directoryMap[key];
			data.push({ index: index++, riskLevel: item.riskLevel });
		}
		if (overviewPanel) {
			overviewPanel.webview.postMessage({ command: 'updateData', data: data });
		}
	} else {
		setTimeout(function () {
			sendDataToDocument();
		}, 100);
	}
}

function setupWebviewListeners(overviewPanel: vscode.WebviewPanel, context: Context) {
	overviewPanel.webview.onDidReceiveMessage(
		message => {
			switch (message.command) {
				case 'init':
					documentReady = true;
					var data = [];
					data.push(["File", "Parent", "Size", "Risk"]);

					var index = 1;
					for (let key in directoryMap) {
						let element = directoryMap[key];
						data.push([{ v: key, f: index++, isFile: element.isFile, path: element.path }, element.parent, element.lines, element.riskLevel]);
					}

					overviewPanel.webview.postMessage({ 
						command: 'init', 
						data: data,
						colorRanges: Settings.getColorRanges(),
					});
					break;
				case "updateColorRanges":
					let newColorRangesEntropy = message.colorRanges;
					Settings.setColorRangesEntropy(newColorRangesEntropy);
					break;
				case "openFile":
					let path = message.path;
					var openPath = vscode.Uri.file(path); //A request file path
					vscode.workspace.openTextDocument(openPath).then(doc => {
						vscode.window.showTextDocument(doc);
					});
					break;
				case "typeChanged":
					let riskType = message.value;
					if (riskType === "Median") {
						calcRisk(directoryMap["root"], RiskType.Median);
					} else if (riskType === "Average") {
						calcRisk(directoryMap["root"], RiskType.Average);
					} else if (riskType === "Maximum") {
						calcRisk(directoryMap["root"], RiskType.Maximum);
						console.log("Max calculated");
						console.log(directoryMap);
					}
					// Send data back to webView:
					sendDataToDocument();
					break;
			}

		},
		undefined,
		context.subscriptions
	);
}