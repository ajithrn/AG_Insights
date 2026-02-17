/**
 * Type definitions for AG Insights
 */

/** API response from GetUserStatus endpoint */
export interface ServerUserStatusResponse {
  userStatus: {
    planStatus?: {
      planInfo?: {
        monthlyPromptCredits: string;
      };
      availablePromptCredits?: string;
    };
    cascadeModelConfigData?: {
      clientModelConfigs: Array<{
        label: string;
        modelOrAlias?: {
          model: string;
        };
        quotaInfo?: {
          remainingFraction: number;
          resetTime: string;
        };
      }>;
    };
    user?: {
      email: string;
      id: string;
    };
  };
}

/** Information about a single model's quota */
export interface ModelQuotaInfo {
  label: string;
  modelId: string;
  remainingFraction: number;
  remainingPercentage?: number;
  isExhausted: boolean;
  resetTime: Date;
  timeUntilReset: number;
  timeUntilResetFormatted: string;
}

/** Information about prompt credits */
export interface PromptCreditsInfo {
  available: number;
  monthly: number;
  usedPercentage: number;
  remainingPercentage: number;
}

/** Snapshot of quota data at a point in time */
export interface QuotaSnapshot {
  timestamp: Date;
  email?: string;
  promptCredits?: PromptCreditsInfo;
  models: ModelQuotaInfo[];
}

/** Extension configuration */
export interface ExtensionConfig {
  enabled: boolean;
  pollingInterval: number;
  showPromptCredits: boolean;
  pinnedModels: string[];
}

/** Process information for Antigravity language server */
export interface ProcessInfo {
  extensionPort: number;
  connectPort: number;
  csrfToken: string;
}
