import * as vscode from 'vscode';
import * as fs from 'fs';
const axios = require('axios');
import {save_session_cookie} from './util';

export interface ColorRange {
  Minimum: number;
  Maximum: number;
  Color: string;
}

export interface TokenWeight {
  tokenType: string;
  weight: number;
}

interface TokenWeightMap {
	[key: string]: number;
}

const HOST = "";

export class Settings {
  // Settings cache
  private static configuration: vscode.WorkspaceConfiguration;
  public static excludeFolderName: string[];
  public static excludeFileType: string[];
  public static supportedFileTypes: string[] = [".java"];

  static readSettings(context: vscode.ExtensionContext) {
    Settings.configuration = vscode.workspace.getConfiguration('lmpowered');
    this.excludeFolderName = Settings.configuration.get<string[]>("exclude.directories", ["node_modules", "out"]);
    this.excludeFileType = Settings.configuration.get<string[]>("exclude.filetype", [".png", ".jpg", ".jpeg", ".svg"]);

    // create icons
    let colors = Settings.getColorRanges();
    for (let key in colors) {
      let item: ColorRange = colors[key];
      let color = item.Color;
      let path = context.asAbsolutePath(`/images/gutter/gutter_${(1+parseInt(key))}.svg`);
      let svg = '<svg width="32" height="48" viewPort="0 0 32 48" xmlns="http://www.w3.org/2000/svg"><polygon points="16,0 32,0 32,48 16,48" fill="' + color + '"/></svg>';
      Settings.createFile(path, svg);
    }
  }

  private static createFile(name: string, content: string) {
    fs.writeFile(name, content,  function(err) {
			if (err) {
				return console.error(err);
			}
		});
  }

  // General
  static getColorRanges(): ColorRange[] {
    return Settings.configuration.get<ColorRange[]>("general.colorranges", [
      // {"Minimum": 0, "Maximum": 1, "Color": "#005600"}, 
      // {"Minimum": 1, "Maximum": 2, "Color": "#57BF04"}, 
      // {"Minimum": 2, "Maximum": 3, "Color": "#F1F000"},
      // {"Minimum": 3, "Maximum": 5, "Color": "#E4602E"}, 
      // {"Minimum": 5, "Maximum": 25, "Color": "#A90606"}
    ]);
  }

  static getTokenWeigths(): TokenWeightMap {
    let tokenWeightMap = {} as TokenWeightMap;
    let tokenWeightsArray = Settings.configuration.get<TokenWeight[]>("general.tokenweights", []);
    for (let weight of tokenWeightsArray) {
      tokenWeightMap[weight.tokenType] = weight.weight;
    }
    return tokenWeightMap;
  }

  static getBackendUrl(): string {
    return "http://localhost:8080";
  }

  static getSearchHostname(): string {
    return Settings.configuration.get<string>("search.url", this.getBackendUrl() + "/api/search");
  }

  static getSearchMatchIndicator(): number {
    return Settings.configuration.get<number>("search.matchindicator", 20);
  }

  static getSearchQueryInterval(): number {
    return Settings.configuration.get<number>("search.queryinterval", 10);
  }

  static getRiskUrl(): string {
    return Settings.configuration.get<string>("languagemodel.url", this.getBackendUrl() + "/api/risk");
  }

  // Risk
  static isRiskEnabled(): boolean {
    return Settings.configuration.get<boolean>("risk.enabled", true);
  }

  // Minimap / Scrollmap
  static isMinimapEnabled(): boolean {
    return Settings.configuration.get<boolean>("minimap.enabled", true);
  }

  static getMinimapMinRisk(): number {
    return Settings.configuration.get<number>("minimap.minrisk", 75);
  }

  // Folding
  static isFoldingEnabled(): boolean {
    return Settings.configuration.get<boolean>("folding.enabled", false);
  }

  static getFoldingMaxRisk(): number {
    return Settings.configuration.get<number>("folding.maxrisk", 35);
  }

  static isFoldingOnOpenEnabled(): boolean {
    return Settings.configuration.get<boolean>("folding.foldonopen", false);
  }

  // Autocompletion
  static isAutoCompletionEnabled(): boolean {
    return Settings.configuration.get<boolean>("autocompletion.enabled", false);
  }

  static getAutoCompletionHostname(): string {
    return Settings.configuration.get<string>("autocompletion.url", this.getBackendUrl() + "/api/autocompletion");
  }

  static getSelectedModel(): string {
    return Settings.configuration.get<string>("languagemodel.model", "");
  }

  // constants
  static getSelectedMetric(): string {
    return 'full_token_entropy';
  }

  static getSelectedTokenType(): string {
    return 'all';
  }

  static getSession(): string {
    return Settings.configuration.get<string>('general.session', '');
  }

  // update

  static setSession(session: string) {
    Settings.configuration.update('general.session', session);
  }

  static setColorRangesEntropy(colorRangesEntropyObj: any) {
    Settings.configuration.update('general.colorranges', colorRangesEntropyObj);
  }

  static setDefaultTokenWeights() {
    const token_types_url = this.getBackendUrl() + "/api/token-types";

    axios.get(token_types_url).then((response: any) => {
      save_session_cookie(response);

      let tokenTypes = response.data;
      let tokenWeights = tokenTypes.map((item: string) => {return {tokenType: item, weight: 1.0};});
      
      Settings.configuration.update('general.tokenweights', tokenWeights, vscode.ConfigurationTarget.Global);
    }).catch((error: any) => {
      console.log(error);
    });
  }

  static setAvailableLangModels() {
    const models_url = this.getBackendUrl() + "/api/models";

    axios.get(models_url).then((response: any) => {
      save_session_cookie(response);
      let modelDescriptions = response.data.models;
      let modelIds = modelDescriptions.map((item: any) => {return item.id;});

      console.log(`Loaded a list of available models from the back-end : ${modelIds}`);
      
      let modelsObject = {
        "type": "string",
        "default": "langmodel-small-split-reversed_10k_1_512_200117.095729",
        "description": "Indicates the name of the languagemodel to use for entropy calculation",
        "enum": modelIds,
        "enumDescriptions": modelIds
      };

      console.log(modelsObject);

      Settings.configuration.update('languagemodel.model', modelsObject, vscode.ConfigurationTarget.Global);
    }).catch((error: any) => {
      console.log(error);
    });
  }
}