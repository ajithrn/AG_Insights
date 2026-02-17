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
      pollingInterval: (config.get<number>('pollingInterval') ?? 120) * 1000, // Convert to ms
      showPromptCredits: config.get<boolean>('showPromptCredits') ?? true,
      pinnedModels: config.get<string[]>('pinnedModels') ?? [],
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
