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

  info(category: string, message: string, data?: any) {
    this.log('INFO', category, message, data);
  }

  debug(category: string, message: string, data?: any) {
    this.log('DEBUG', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('ERROR', category, message, data);
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
