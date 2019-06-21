import {Settings} from '../../settings';

export class Sparkline {
  static sparklineValues = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

  public static getCharForValue(percentage: number): string {
    var index = percentage / 100 * (this.sparklineValues.length - 1);
    return Sparkline.sparklineValues[Math.floor(index)];
  }

  public static get(percentages: number[]): string {
    if (percentages) {
      if (!Settings.isSparklineEnabled()) {
        return "";
      }

      var sparkline = "    ";
      percentages.forEach(element => {
        sparkline += Sparkline.getCharForValue(element);
      });
      return sparkline;
    }
    return "";
  }
}