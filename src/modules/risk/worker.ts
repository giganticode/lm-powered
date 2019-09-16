import * as vscode from 'vscode';
import { Settings } from '../../settings';
import URLQueryBuilder from 'url-query-builder';
import * as fs from "fs";
import * as path from 'path';
import { Context } from 'vm';
const axios = require('axios');
import { Md5 } from 'ts-md5/dist/md5';


var pending: Item[] = [];
let busyIndicator = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
var ctx: Context;
var minimapCachePath: string;

var rootDirectory: File;
var pendingFiles: File[] = [];

interface Item {
	path: string;
	name: string;
	relativePath: string;
	lines: number;
	content: string;
	match: number[];
	extension: string;
	lastModified: Date;
	hash: string;
}

interface File {
	path: string;
	name: string;
	extension: string;
	relativePath: string;
	hash: string;
	parent: File;
	lastModified: Date;
	isDirectory: boolean;
	content: string;
	lines: number;
	children: FileMap;
}

interface FileMap {
	[key: string]: File;
}

export function init(context: Context) {
	ctx = context;
	minimapCachePath = path.resolve(ctx.extensionPath, 'images', 'minimap');

	if (!fs.existsSync(minimapCachePath)){
		fs.mkdirSync(minimapCachePath);
	}

	if (!fs.existsSync(path.resolve(ctx.extensionPath, 'images', 'gutter'))){
		fs.mkdirSync(path.resolve(ctx.extensionPath, 'images', 'gutter'));
	}

	if (Settings.isRiskEnabled()) {
		//doJob();
		initFileWatcher();
	}
}

function initFileWatcher() {
	let workspaceRoot = vscode.workspace.rootPath as string;
	busyIndicator.text = "Scanning working directory...";
	busyIndicator.show();
	initRootDirectory();
	console.log("root directory inited");
	console.log(rootDirectory);

	busyIndicator.text = "Upload files to webserver...";
	uploadToServer();

	let watcher = vscode.workspace.createFileSystemWatcher(
		new vscode.RelativePattern(
			workspaceRoot,
			'**/*'
		),
		false,
		false,
		false
	);

	function logFile(file: File) {
		var children = [];
		for(let index in file.children) {
			children.push(index);
		}
		var v = {
		path: file.path,
		relativePath: file.relativePath,
		name: file.name,
		extension: file.extension,
		hash: file.hash,
		isDirectory: file.isDirectory,
		lastModified: file.lastModified,
		children: children
		};
		return v;		
	}

	function findFile(absolutePath: string): File {
		let relativePath = absolutePath.substr(rootDirectory.path.length + 1);
		console.log("Find item for: "+relativePath);

		let parents = relativePath.split(path.sep);
	//	console.log("parents");
	//	console.log(parents);

		var currentDirectory = rootDirectory;

		for (let index in parents) {
			let dir = parents[index];
			console.log("  search " + dir);
			if (!currentDirectory.children[dir]) {
				console.log("ERROR FILE NOT FOUND");
			}
			currentDirectory = currentDirectory.children[dir];
			console.log("found: " + currentDirectory.name + " => " + currentDirectory.relativePath);	
		}
		console.log("MATCH: " + currentDirectory.path);
		console.log(logFile(currentDirectory));
		
		return currentDirectory;
	}

	watcher.onDidChange((e) => {
		console.log("file changed");
		console.log(e);
		let filePath = e.fsPath;
		let scheme = e.scheme;

		let changedFile = findFile(filePath);


		console.log(path.sep);
		// TODO: update file in map and 

		//vscode.window.showInformationMessage("change applied!"); 
	});

	watcher.onDidCreate((e) => {
		console.log("file created");
		console.log(e);
		
		let filePath = e.fsPath;
		let parentPath = path.dirname(filePath);

		let parent = findFile(parentPath);
		console.log("parent folder: ");
		console.log(logFile(parent));

		// TODO: add new file to parent.
		addFile(parent, filePath);

		//
		// TODO: add to directory tree
	});

	watcher.onDidDelete((e) => {
		//console.log("file deleted");
		//console.log(e);
		let filePath = e.fsPath;
		
		let deletedFile = findFile(filePath);
		//console.log("Before delete");
		//console.log(logFile(deletedFile.parent));

		// OK working fine
		deleteFile(deletedFile);
		//console.log("After delete");
		//console.log(logFile(deletedFile.parent));
		console.log("Tree updated.");
	});
}

function initRootDirectory() {
	rootDirectory = {} as File;
	rootDirectory.path = vscode.workspace.rootPath as string;
	rootDirectory.name = path.basename(rootDirectory.path);// "root";
	console.log("root name: " + rootDirectory.name);
	rootDirectory.relativePath = rootDirectory.name; //"root";
	rootDirectory.isDirectory = true;
	rootDirectory.hash = Md5.hashStr(rootDirectory.path) as string;
	rootDirectory.children = {} as FileMap;
	scanDirectory(rootDirectory);
}

function deleteFile(file: File) {
	let parent = file.parent;
	delete(parent.children[file.name]);
}

function addFile(parent: File, absolutePath: string): File | null {
	let fileName = path.basename(absolutePath);
	let relativePath = path.join(parent.relativePath, fileName);
	let extension = path.extname(absolutePath);
	if (Settings.excludeFileType.indexOf(extension) > -1) {
		return null;
	}
	let newFile = {} as File;
	newFile.path = absolutePath;
	newFile.isDirectory = false;
	newFile.relativePath = relativePath;
	newFile.name = fileName;
	newFile.parent = parent;
	newFile.hash = Md5.hashStr(absolutePath) as string;
	newFile.extension = extension;
	newFile.lastModified = fs.statSync(absolutePath).mtime;

	let content = fs.readFileSync(absolutePath).toString();
	let lineCount = content.split(/\r\n|\r|\n/).length;
	newFile.content = content;
	newFile.lines = lineCount;
	parent.children[newFile.name] = newFile;

	return newFile;
}

function scanDirectory(directory: File) {
	try {
		var files = fs.readdirSync(directory.path);

		files.forEach(function (file: any) {
			let relativePath = path.join(directory.relativePath, file);
			let absolutePath = path.join(directory.path, file);

			if (fs.statSync(absolutePath).isDirectory()) {
				if (Settings.excludeFolderName.indexOf(directory.name) > -1) {
					return;
				}
				let newDirectory = {} as File;
				newDirectory.isDirectory = true;
				newDirectory.path = absolutePath;
				newDirectory.relativePath = relativePath;
				newDirectory.name = file;
				newDirectory.parent = directory;
				newDirectory.hash = Md5.hashStr(absolutePath) as string;
				newDirectory.children = {} as FileMap;
				newDirectory.lastModified = fs.statSync(absolutePath).mtime;
				directory.children[newDirectory.name] = newDirectory;
				scanDirectory(newDirectory);
			} else {
				let newFile = addFile(directory, absolutePath);
				if (newFile !== null) {
					pendingFiles.push(newFile);
				}
			/*	let extension = path.extname(file);
				if (Settings.excludeFileType.indexOf(extension) > -1) {
					return;
				}
				let newFile = {} as File;
				newFile.path = absolutePath;
				newFile.isDirectory = false;
				newFile.relativePath = relativePath;
				newFile.name = file;
				newFile.parent = directory;
				newFile.hash = Md5.hashStr(absolutePath) as string;
				newFile.extension = extension;
				newFile.lastModified = fs.statSync(absolutePath).mtime;

				let content = fs.readFileSync(absolutePath).toString();
				let lineCount = content.split(/\r\n|\r|\n/).length;
				newFile.content = content;
				newFile.lines = lineCount;
				directory.children[newFile.name] = newFile;
				pendingFiles.push(newFile);*/
			}
		});
	} catch (e) {
		console.log(e);
	}
}

function uploadToServer() {
	if (pendingFiles.length === 0) {
		busyIndicator.text = "Upload done.";
		return;
	}
	busyIndicator.text = `Uploading files: ${pendingFiles.length} files remaining`;
	let item: File = pendingFiles.pop() as File;

	console.log("upload file: " + item.path);

	let queryBuilder = new URLQueryBuilder(Settings.getLanguagemodelHostname());
	queryBuilder.set({
		
	});

	let content = item.content;

	let cachedItemPath = path.join(minimapCachePath, item.hash + ".png");
	var cachedTimestamp = null;
	if (fs.existsSync(cachedItemPath)) {
		cachedTimestamp = fs.statSync(cachedItemPath).mtime;
	}

	// Thumbnail for search
	if (cachedTimestamp === null || cachedTimestamp < item.lastModified) {
		axios.request({
			responseType: 'arraybuffer',
			url: 'http://localhost/webservice/thumbnail.php',
			method: 'post',
			data: {
				input: fs.readFileSync(item.path, 'utf8').toString()
			}
		}).then(response => {
			let path = ctx.asAbsolutePath(`/images/minimap/${item.hash}.png`);
			fs.writeFileSync(path, response.data);
		}).catch(error => {
			console.log("thumbnail error");
			console.log(error);
		});
	}

	// Risk -> languagemodel
	if (Settings.supportedFileTypes.indexOf(item.extension) > -1) {

		let timestamp = fs.statSync(item.path).mtimeMs;

		axios.post(queryBuilder.get(), { 
			content: content,
			extension: item.extension,
			languageId: item.extension.replace(/\./, ''),
			filePath: item.path,
			timestamp: timestamp,
			noReturn: true,
			aggregator: Settings.getLanguagemodelAggregator()
		 })
			.then(response => {
				//	console.log("request handled for: " + item.path);
				//	console.log(response.data);
			})
			.catch(error => {
				if (error.response.status === 406) {
					//	console.log("file not supported " + item.path);
				} else {
					//	console.log("Error in worker.ts");
					console.log(error);
				}
			})
			.finally(function () {
				uploadToServer();
			});
	} else {
		uploadToServer();
	}

}