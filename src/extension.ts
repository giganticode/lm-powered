'use_strict';
import * as vscode from 'vscode';
const highlight = require('./modules/highlight/highlight');
const codelens = require('./modules/codelens/codelens');
const treemap = require('./modules/treemap/treemap');
const risk = require('./modules/risk/risk');
const search = require('./modules/search/search');
import { Settings } from './settings';

export function activate(context: vscode.ExtensionContext) {
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('visualization')) {
      Settings.readSettings(context);
    }
  }, null,
    context.subscriptions
  );

  // read settings from configuration
  Settings.readSettings(context);

  highlight.activate(context);
  codelens.activate(context);
  treemap.activate(context);
  risk.activate(context);
  search.activate(context);
}

export function deactivate() { }