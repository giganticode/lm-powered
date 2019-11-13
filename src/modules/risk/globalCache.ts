import * as vscode from 'vscode';
import {Token, EntropyLine, EntropyResult, EntropyCacheMap} from '../../baseDefinitions';

class GlobalCache {

    private static entropyCacheMap: EntropyCacheMap = {};

    static add(fileName: string, entropyResult: EntropyResult) {
        this.entropyCacheMap[fileName] = entropyResult;
    }

    static get(fileName: string): EntropyResult {
        return this.entropyCacheMap[fileName];
    }

    static delete(fileName: string) {
        delete(this.entropyCacheMap[fileName]);
    }

    

    constructor() {

    }
}

export default GlobalCache;