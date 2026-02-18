/**
 * Configuration Manager
 * Manages extension settings from VS Code configuration
 */

import * as vscode from 'vscode';
import { ExtensionConfig } from '../utils/types';

export class ConfigManager {
  private static readonly CONFIG_SECTION = 'agInsights';

  getConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);

    return {
      enabled: config.get<boolean>('enabled') ?? true,
      pollingInterval: config.get<number>('pollingInterval') ?? 300000, // Default: 5 minutes in ms
      showPromptCredits: config.get<boolean>('showPromptCredits') ?? true,
      showUserEmail: config.get<boolean>('showUserEmail') ?? true,
    };
  }

  onConfigChange(callback: (config: ExtensionConfig) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(ConfigManager.CONFIG_SECTION)) {
        callback(this.getConfig());
      }
    });
  }
}
