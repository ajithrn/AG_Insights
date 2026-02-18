/**
 * Main Extension Entry Point
 */

import * as vscode from 'vscode';
import { ConfigManager } from './core/config_manager';
import { ProcessFinder } from './core/process_finder';
import { QuotaManager } from './core/quota_manager';
import { StatusBarManager } from './ui/status_bar';

import { logger } from './utils/logger';
import { QuotaSnapshot } from './utils/types';

let configManager: ConfigManager;
let processFinder: ProcessFinder;
let quotaManager: QuotaManager;
let statusBar: StatusBarManager;

let isInitialized = false;
let lastSnapshot: QuotaSnapshot | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize Logger
  logger.init(context);
  logger.info('Extension', 'AG Insights activating...');

  // Initialize Components
  configManager = new ConfigManager();
  processFinder = new ProcessFinder();
  quotaManager = new QuotaManager();
  statusBar = new StatusBarManager();


  context.subscriptions.push(statusBar);

  // Register Commands
  registerCommands(context);

  // Setup Event Listeners
  setupEventListeners(context);

  // Start Initialization
  initializeExtension().catch(err => {
    logger.error('Extension', 'Initialization failed:', err);
    statusBar.showError('Init failed');
  });
}

function registerCommands(context: vscode.ExtensionContext) {
  // Refresh Command
  context.subscriptions.push(
    vscode.commands.registerCommand('agInsights.refresh', async () => {
      logger.info('Command', 'Manual refresh triggered');
      if (isInitialized) {
        await quotaManager.fetchQuota();
      } else {
        await initializeExtension();
      }
    })
  );

  // Reconnect Command
  context.subscriptions.push(
    vscode.commands.registerCommand('agInsights.reconnect', async () => {
      logger.info('Command', 'Reconnect triggered');
      isInitialized = false;
      quotaManager.stopPolling();
      await initializeExtension();
    })
  );

  // Show Logs Command
  context.subscriptions.push(
    vscode.commands.registerCommand('agInsights.showLogs', () => {
      logger.show();
    })
  );

  // Show Details Command (triggered by clicking status bar)
  context.subscriptions.push(
    vscode.commands.registerCommand('agInsights.showDetails', () => {
      logger.info('Command', 'Show details triggered');
      if (lastSnapshot) {
        statusBar.showDetailsPanel(lastSnapshot, configManager.getConfig());
      } else {
        vscode.window.showInformationMessage('AG Insights: No quota data available yet. Please wait...');
      }
    })
  );

}

function setupEventListeners(context: vscode.ExtensionContext) {
  // Quota Updates
  quotaManager.onUpdate((snapshot) => {
    lastSnapshot = snapshot;
    const config = configManager.getConfig();
    logger.debug('Extension', 'Quota update received', {
      models: snapshot.models.length,
      timestamp: snapshot.timestamp
    });
    statusBar.update(snapshot, config);
  });

  // Quota Errors
  quotaManager.onError((error) => {
    logger.error('Extension', 'Quota error:', error);

    // Auto-reconnect on connection or auth errors
    const msg = error.message || '';
    if (msg.includes('ECONNREFUSED') || msg.includes('status 403') || msg.includes('status 404')) {
      logger.info('Extension', 'Connection issue detected (Process restarted?), attempting to reconnect...');
      isInitialized = false;
      quotaManager.stopPolling();
      // Add a small delay to avoid rapid loops if process is flapping
      setTimeout(() => initializeExtension(), 1000);
      return;
    }

    statusBar.showError('Fetch failed');
  });

  // Config Changes
  context.subscriptions.push(
    configManager.onConfigChange((newConfig) => {
      logger.info('Extension', 'Configuration changed');
      if (newConfig.enabled) {
        if (isInitialized) {
          quotaManager.startPolling(newConfig.pollingInterval);
        } else {
          initializeExtension();
        }
      } else {
        quotaManager.stopPolling();
        statusBar.hide();
      }

      // Update status bar immediately if we have data
      if (lastSnapshot && newConfig.enabled) {
        statusBar.update(lastSnapshot, newConfig);
      }
    })
  );
}

async function initializeExtension() {
  if (isInitialized) return;

  logger.info('Extension', 'Initializing...');

  try {
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const processInfo = await processFinder.detectProcessInfo(workspacePath);

    if (processInfo) {
      logger.info('Extension', 'Connected to Antigravity process');

      quotaManager.init(processInfo.connectPort, processInfo.csrfToken);

      const config = configManager.getConfig();
      if (config.enabled) {
        quotaManager.startPolling(config.pollingInterval);
      }

      isInitialized = true;
    } else {
      logger.error('Extension', 'Antigravity process not found');
      statusBar.showError('Process not found');

      // Retry after delay?
      setTimeout(() => {
        if (!isInitialized) initializeExtension();
      }, 10000);
    }
  } catch (error: any) {
    logger.error('Extension', 'Initialization error:', error);
    statusBar.showError('Init error');
  }
}

export function deactivate() {
  logger.info('Extension', 'Deactivating...');
  quotaManager?.stopPolling();
  statusBar?.dispose();
}
