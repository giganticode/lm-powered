import * as vscode from 'vscode';
import {Token, EntropyLine, EntropyResult} from '../../baseDefinitions';
import GlobalCache from './globalCache';

export function register() {
    vscode.languages.registerHoverProvider(
        { scheme: 'file', language: 'java' },
        {
            provideHover(document: vscode.TextDocument, position: vscode.Position) {
                let fileEntropyInfo: EntropyResult = GlobalCache.get(document.fileName);
                let lineEntropyInfo: EntropyLine = fileEntropyInfo.lines[position.line];
    
                if (!fileEntropyInfo || !lineEntropyInfo) {
                    // return new vscode.Hover(`No data available`);
                    return null;
                }
    
                let remainingText = lineEntropyInfo.text;
                let targetColumn = position.character;
                let globalIndex = 0;
    
                for (let j = 0; j < lineEntropyInfo.tokens.length; j++) {
                    let token = lineEntropyInfo.tokens[j];
                    let text = token.text.replace('</t>', '');
                    let entropy = token.entropy;
    
                    // search text in line Text
                    let found = false;
                    let startIndex = 0;
                    let endIndex = text.length;
                    let iteration = 0;
                    while (found === false) {
    
                        if (remainingText.substring(startIndex, endIndex) === text) {
                            remainingText = remainingText.substring(endIndex);
    
                            if (targetColumn >= globalIndex + startIndex && targetColumn < globalIndex + endIndex) {
                                return new vscode.Hover(`Line entropy: ${lineEntropyInfo.line_entropy.toFixed(3)} - Token '${text}' -> ${entropy.toFixed(3)} ||| tokens: ${lineEntropyInfo.tokens.map((token: Token) => token.text)}`);
                            }
    
                            globalIndex += endIndex;
                            found = true;
                        }
                        else {
                            // handle a whitespace that is not part of the token
                            startIndex++;
                            endIndex++;
                        }
                        iteration++;
                        if (iteration > 12) {
                            break;
                        }
                    }
                }
    
                return new vscode.Hover(`Line entropy: ${lineEntropyInfo.line_entropy.toFixed(3)}`);
            }
        });
}