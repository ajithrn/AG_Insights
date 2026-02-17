/**
 * Status Bar Manager
 * Handles the display of quota information in the VS Code status bar
 */

import * as vscode from 'vscode';
import { QuotaSnapshot, ExtensionConfig, ModelQuotaInfo } from '../utils/types';

export class StatusBarManager implements vscode.Disposable {
  private item: vscode.StatusBarItem;
  private lastSnapshot?: QuotaSnapshot;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'agInsights.refresh'; // Now clicking refreshes the quota
    this.item.text = '$(hubot) AG Insights';
    this.item.tooltip = 'Initializing...';
    this.item.show();
  }

  dispose() {
    this.item.dispose();
  }

  showLoading() {
    this.item.text = '$(sync~spin) AG Insights';
    this.item.tooltip = 'Connecting to Antigravity process...';
    this.item.show();
  }

  showError(msg: string) {
    this.item.text = '$(error) AG Insights';
    this.item.tooltip = `Error: ${msg}`;
    this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    this.item.show();
  }

  update(snapshot: QuotaSnapshot, config: ExtensionConfig) {
    if (!config.enabled) {
      this.item.hide();
      return;
    }

    this.lastSnapshot = snapshot;

    // Simple text display as requested
    this.item.text = '$(hubot) AG Insights';

    // Rich tooltip with all details
    this.item.tooltip = this.buildTooltip(snapshot);

    this.item.backgroundColor = undefined;
    this.item.show();
  }

  hide() {
    this.item.hide();
  }

  private buildTooltip(snapshot: QuotaSnapshot): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;
    md.supportHtml = true;
    md.supportThemeIcons = true; // CRITICAL: Enable $(icon) support

    // Header (Left Aligned)
    md.appendMarkdown('\n### $(hubot) AG User Insights\n');

    if (snapshot.email) {
      md.appendMarkdown(`\n$(person) **User**: \`${snapshot.email}\`\n`);
    }

    // Prompt Credits Section
    if (snapshot.promptCredits) {
      const { available, monthly, remainingPercentage } = snapshot.promptCredits;
      const pct = remainingPercentage.toFixed(0);
      md.appendMarkdown(`\n$(pulse) **Prompt Credits**: ${available} / ${monthly} (${pct}%)`);
    }

    // Add explicit double newline before table to prevent overlap
    md.appendMarkdown('\n\n');

    // Use a code block with 'diff' language to get colors
    // + Green (Added)
    // - Red (Removed)
    md.appendCodeblock(this.buildQuotaTable(snapshot.models), 'diff');

    // Add padding after the table
    md.appendMarkdown('\n\n');

    // Footer (Left Aligned)
    md.appendMarkdown('[ $(refresh) REFRESH QUOTA ](command:agInsights.refresh) \u00A0\u00A0 [ $(gear) CONFIGURE ](command:workbench.action.openSettings?%22agInsights%22)');
    md.appendMarkdown('\n'); // Extra footer padding

    return md;
  }

  private buildQuotaTable(models: ModelQuotaInfo[]): string {
    let output = '';
    // Header for readability in the code block
    // output += ' MODEL                     | USAGE      | REMAINING \n';
    // output += '---------------------------+------------+-----------\n';

    for (const m of models) {
      const pctValue = m.remainingPercentage !== undefined ? m.remainingPercentage : 0;

      // Determine color indicator: + for Good (Green), - for Bad (Red/Yellowish in some themes)
      // We use - for <= 40% (Low/Exhausted) to ensure Red color for 0%
      const indicator = pctValue > 40 ? '+' : '-';

      const bar = this.getProgressBar(pctValue);
      const pctDisplay = m.remainingPercentage !== undefined ? `${m.remainingPercentage.toFixed(0)}%` : '0%';

      // Pad model name for alignment (approximate width 25 chars)
      const paddedName = m.label.padEnd(25).substring(0, 25);

      // Add Reset time column
      output += `${indicator} ${paddedName} | ${bar} | ${pctDisplay.padEnd(4)} | ${m.timeUntilResetFormatted}\n`;
    }
    return output;
  }

  private getProgressBar(percentage: number): string {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
  }
}
