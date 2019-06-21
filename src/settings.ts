import * as vscode from 'vscode';
import * as fs from 'fs';

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
    let colors = Settings.getColors();
    for (let key in colors) {
      let color = colors[key];
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
  static getRanges(): number[] {
    return Settings.configuration.get<number[]>("general.ranges",  [20,40,60,80,100]);
  }

  static getRangesWithLowerBound(): number[] {
    return [0].concat(Settings.getRanges());
  }

  static getColors(): string[] {
    return Settings.configuration.get<string[]>("general.colors",  ["green", "rgb(126, 128, 0)", "orange", "rgb(255, 72, 0)", "red"]);
  }

  // Codelens
  static isCodelensEnabled(): boolean {
    return Settings.configuration.get<boolean>("codelens.enabled", true);
  }

  static isSparklineEnabled(): boolean {
    return Settings.configuration.get<boolean>("codelens.sparkline.enabled", true);
  }

  static getCodelensHostname(): string {
    return Settings.configuration.get<string>("codelens.hostname", "http://localhost/webservice/codelens.php");
  }

  static getCodelensNumberOfDays(): number {
    return Settings.configuration.get<number>("codelens.number_of_days", 30);
  }

  static getCodelensNumberOfBars(): number {
    if (!this.isSparklineEnabled()) {
      return 0;
    }
    let numberOfBars = Settings.configuration.get<number>("codelens.sparkline.number_of_bars", 15);
    let numberOfDays = this.getCodelensNumberOfDays();
    return Math.min(numberOfBars, numberOfDays);
  }

  // Highlight
  static isHighlightEnabled(): boolean {
    return Settings.configuration.get<boolean>("highlight.enabled", true);
  }

  static getHighlightHostname(): string {
    return Settings.configuration.get<string>("highlight.hostname", "http://localhost/webservice/highlight.php");
  }

  static getHighlightOKColor(): string {
    return Settings.configuration.get<string>("highlight.ok_color", "rgba(0,255,0,0.2)");
  }

  static getHighlightWarningColor(): string {
    return Settings.configuration.get<string>("highlight.warning_color", "rgba(255,0,0,0.2)");
  }

  // Search
  static getSearchHostname(): string {
    return Settings.configuration.get<string>("search.hostname", "http://localhost/webservice/languagemodel.php");
  }

  // Languagemodel (Risk + Treemap)
  static getLanguagemodelHostname(): string {
    return Settings.configuration.get<string>("languagemodel.hostname", "http://localhost/webservice/languagemodel.php");
  }

  static getLanguagemodelAggregator(): string {
    return Settings.configuration.get<string>("languagemodel.aggregator", "full-token-average");
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

}