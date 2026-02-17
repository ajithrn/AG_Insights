/**
 * Logger utility for debugging
 */

import * as vscode from 'vscode';

class Logger {
  private outputChannel?: vscode.OutputChannel;

  init(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('AG Insights');
    context.subscriptions.push(this.outputChannel);
  }

  section(category: string, message: string) {
    const line = '='.repeat(60);
    this.log('INFO', category, `\n${line}\n${message}\n${line}`);
  }

  info(category: string, message: string, data?: any) {
    this.log('INFO', category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    this.log('DEBUG', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('ERROR', category, message, data);
  }

  timeStart(label: string): () => void {
    const start = Date.now();
    return () => {
      const duration = Date.now() - start;
      this.debug('Timer', `${label} completed in ${duration}ms`);
    };
  }

  show() {
    this.outputChannel?.show();
  }

  private log(level: string, category: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level}] [${category}] ${message}`;

    if (data !== undefined) {
      logMessage += `\n${JSON.stringify(data, null, 2)}`;
    }

    this.outputChannel?.appendLine(logMessage);
  }
}

export const logger = new Logger();
