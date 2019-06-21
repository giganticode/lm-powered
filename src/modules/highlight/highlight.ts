'use_strict';
import * as vscode from 'vscode';
import {Settings} from '../../settings';
import URLQueryBuilder from 'url-query-builder';
const axios = require('axios');

interface DecoratorMap {
    [key: string]: DecoratorDescription;
}

interface DecoratorDescription {
    name: string;
    regions: vscode.DecorationOptions[];
    decorator: undefined | vscode.TextEditorDecorationType;
}

interface DecoratorInstances {
    [key: string]: vscode.TextEditorDecorationType;
}

const decoratorInstances: DecoratorInstances = {};

export function activate(context: vscode.ExtensionContext) {
	vscode.workspace.onDidOpenTextDocument((event) => {
        let editor = vscode.window.activeTextEditor as vscode.TextEditor;
        formatEditorDocument(editor);
    });
    
    vscode.workspace.onDidChangeTextDocument((event) => {
        let editor = vscode.window.activeTextEditor as vscode.TextEditor;
        formatEditorDocument(editor);
	});
}

function formatEditorDocument(activeEditor: vscode.TextEditor) {
    if (activeEditor === undefined || activeEditor._viewColumn === undefined || !Settings.isHighlightEnabled()) {
        return;
    }
    // Clear decorations
    const keys = Object.keys(decoratorInstances);
    for (const key of keys) {
        activeEditor.setDecorations(decoratorInstances[key], []);
    }

    const text = activeEditor.document.getText();
    const decoratorMap: DecoratorMap = {};

    let queryBuilder = new URLQueryBuilder(Settings.getHighlightHostname());
    queryBuilder.set({
        subject: activeEditor._documentData._uri.fsPath,
        languageId: activeEditor._documentData._languageId,
        fileName: activeEditor._documentData._document.fileName,
    });

    axios.post(queryBuilder.get(), {
        input: text
    }).then(response => {
        for (var i = 0; i < response.data.length; i++) {
            let covered = response.data[i];
            let color = covered ? Settings.getHighlightOKColor() : Settings.getHighlightWarningColor();

            const decorator = createDecoratorInstance(color);
            const decoration = {
                range: new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0))
            };

            if (decoratorMap[color] === undefined) {
                decoratorMap[color] = {
                    name: color,
                    regions: [],
                    decorator: undefined
                };
            }

            decoratorMap[color].regions.push(decoration);
            decoratorMap[color].decorator = decorator;
        }

        const keys = Object.keys(decoratorMap);
        for (const key of keys) {
            const decoratorDescription = decoratorMap[key];

            if (decoratorDescription.decorator !== undefined) {
                activeEditor.setDecorations(decoratorDescription.decorator, []);
                activeEditor.setDecorations(
                    decoratorDescription.decorator,
                    decoratorDescription.regions
                );
            }
        }

    })
    .catch(error => {
        console.log(error);
    });
}

function createDecoratorInstance(color: string) {
    if (decoratorInstances[color] !== undefined) {
        return decoratorInstances[color];
    }

    const instance = vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: color
    });

    decoratorInstances[color] = instance;
    return instance;
}