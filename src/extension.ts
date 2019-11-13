'use_strict';
import * as vscode from 'vscode';
const risk = require('./modules/risk/risk');
const treemap = require('./modules/treemap/treemap');
const search = require('./modules/search/search');
const codecompletion = require('./modules/codecompletion/codecompletion');
import * as fs from "fs";
import * as path from 'path';
import { Settings } from './settings';

export let currentWorkspaceFolder : vscode.WorkspaceFolder | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  currentWorkspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
  
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('visualization')) {
      Settings.readSettings(context);
    }
  }, null,
    context.subscriptions
  );

  let minimapCachePath: string = path.resolve(context.extensionPath, 'images', 'minimap');

	if (!fs.existsSync(minimapCachePath)){
		fs.mkdirSync(minimapCachePath);
	}

	if (!fs.existsSync(path.resolve(context.extensionPath, 'images', 'gutter'))){
		fs.mkdirSync(path.resolve(context.extensionPath, 'images', 'gutter'));
	}

  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(event => {
    currentWorkspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
  }));

  // read settings from configuration
  Settings.readSettings(context);

  risk.activate(context);
  treemap.activate(context);
  search.activate(context);
  codecompletion.activate(context);
}

export function deactivate() { }