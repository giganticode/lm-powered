import * as vscode from 'vscode';
import * as fs from 'fs';

export interface ColorRange {
  Minimum: number;
  Maximum: number;
  Color: string;
}

export class Settings {
  // Settings cache
  private static configuration: vscode.WorkspaceConfiguration;
  public static excludeFolderName: string[];
  public static excludeFileType: string[];
  public static supportedFileTypes: string[] = [".java"];

  static readSettings(context: vscode.ExtensionContext) {
    Settings.configuration = vscode.workspace.getConfiguration('visualization');
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
      {"Minimum": 0, "Maximum": 1, "Color": "green"}, 
      {"Minimum": 1, "Maximum": 2, "Color": "rgb(126, 128, 0)"}, 
      {"Minimum": 2, "Maximum": 3, "Color": "orange"},
      {"Minimum": 3, "Maximum": 5, "Color": "rgb(255, 72, 0)"}, 
      {"Minimum": 5, "Maximum": 25, "Color": "red"}
    ]);
  }

  // Search
  static getSearchHostname(): string {
    return Settings.configuration.get<string>("search.url", "http://localhost:8080/api/search");
  }

  static getSearchMatchIndicator(): number {
    return Settings.configuration.get<number>("search.matchindicator", 20);
  }

  static getSearchQueryInterval(): number {
    return Settings.configuration.get<number>("search.queryinterval", 10);
  }

  // Languagemodel (Risk + Treemap)
  static getLanguagemodelHostname(): string {
    return Settings.configuration.get<string>("languagemodel.url", "http://localhost:8080/api/languagemodel");
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
    return Settings.configuration.get<string>("autocompletion.url", "http://localhost:8080/api/autocompletion");
  }

  static getSelectedModel(): string {
    return Settings.configuration.get<string>("languagemodel.model", "langmodel-small-split_10k_1_512_190906.154943");
  }

  // constants
  static getSelectedMetric(): string {
    return 'full_token_entropy';
  }

  static getSelectedTokenType(): string {
    return 'all';
  }

  // update
  static setColorRangesEntropy(colorRangesEntropyObj: any) {
    Settings.configuration.update('general.colorranges', colorRangesEntropyObj);
  }

}