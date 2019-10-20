'use_strict';
import * as vscode from 'vscode';
const highlight = require('./modules/highlight/highlight');
const codelens = require('./modules/codelens/codelens');
const treemap = require('./modules/treemap/treemap');
const risk = require('./modules/risk/risk');
const search = require('./modules/search/search');
const codecompletion = require('./modules/codecompletion/codecompletion');
import { Settings } from './settings';

export let currentWorkspaceFolder : vscode.WorkspaceFolder | undefined = undefined;

export function activate(context: vscode.ExtensionContext) {
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('visualization')) {
      // TODO: reload cached values.
      Settings.readSettings(context);
    }
  }, null,
    context.subscriptions
  );

  console.log("Activate plugin");
  console.log(vscode.workspace.workspaceFolders)

  currentWorkspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
//uri, name, index

  context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(event => {
    console.log("change workspaceFolder");
    console.log(event);
    currentWorkspaceFolder = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0] : undefined;
  }));

  // read settings from configuration
  Settings.readSettings(context);

  risk.activate(context);
  highlight.activate(context);
  codelens.activate(context);
  treemap.activate(context);
  search.activate(context);
  codecompletion.activate(context);
}

export function deactivate() { }