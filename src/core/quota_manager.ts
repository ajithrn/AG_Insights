/**
 * Quota Manager
 * Handles API communication with Antigravity language server
 * SECURITY: Only communicates with LOCAL processes on 127.0.0.1
 */

import * as https from 'https';
import { QuotaSnapshot, ServerUserStatusResponse, ModelQuotaInfo, PromptCreditsInfo } from '../utils/types';
import { logger } from '../utils/logger';

export class QuotaManager {
  private port: number = 0;
  private csrfToken: string = '';
  private updateCallback?: (snapshot: QuotaSnapshot) => void;
  private errorCallback?: (error: Error) => void;
  private pollingTimer?: NodeJS.Timeout;
  private isFetching: boolean = false;

  init(port: number, csrfToken: string) {
    this.port = port;
    this.csrfToken = csrfToken;
  }

  onUpdate(callback: (snapshot: QuotaSnapshot) => void) {
    this.updateCallback = callback;
  }

  onError(callback: (error: Error) => void) {
    this.errorCallback = callback;
  }

  startPolling(intervalMs: number) {
    this.stopPolling();
    this.fetchQuota();
    this.pollingTimer = setInterval(() => this.fetchQuota(), intervalMs);
  }

  stopPolling() {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }

  async fetchQuota() {
    if (this.isFetching) {
      logger.debug('QuotaManager', 'Fetch already in progress, skipping...');
      return;
    }

    try {
      this.isFetching = true;
      logger.debug('QuotaManager', 'Fetching quota...');
      const data = await this.request<ServerUserStatusResponse>(
        '/exa.language_server_pb.LanguageServerService/GetUserStatus', // Local API endpoint
        {
          metadata: {
            ideName: 'antigravity',
            extensionName: 'antigravity',
            locale: 'en',
          },
        }
      );

      const snapshot = this.parseResponse(data);

      logger.debug('QuotaManager', 'Parsed response', {
        email: snapshot.email,
        hasPromptCredits: !!snapshot.promptCredits,
        modelsMatches: snapshot.models.length,
        rawUserStatusKeys: Object.keys(data.userStatus || {})
      });

      if (this.updateCallback) {
        this.updateCallback(snapshot);
      }
    } catch (error: any) {
      logger.error('QuotaManager', 'Quota fetch error:', error.message);
      if (this.errorCallback) {
        this.errorCallback(error);
      }
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Make HTTPS request to local language server
   * SECURITY: Hardcoded to localhost (127.0.0.1)
   */
  private request<T>(path: string, body: object): Promise<T> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const options: https.RequestOptions = {
        hostname: '127.0.0.1', // SECURITY: Local only
        port: this.port,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          'Connect-Protocol-Version': '1',
          'X-Codeium-Csrf-Token': this.csrfToken, // Local token for auth
        },
        rejectUnauthorized: false, // Local cert is self-signed
        timeout: 5000,
      };

      const req = https.request(options, res => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`Request failed with status ${res.statusCode}: ${body}`));
              return;
            }
            resolve(JSON.parse(body) as T);
          } catch (e) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.write(data);
      req.end();
    });
  }

  private parseResponse(data: ServerUserStatusResponse): QuotaSnapshot {
    const userStatus = data.userStatus;
    const planStatus = userStatus.planStatus;
    const planInfo = planStatus?.planInfo;
    const availableCredits = planStatus?.availablePromptCredits;

    // Parse prompt credits
    let promptCredits: PromptCreditsInfo | undefined;
    if (planInfo && availableCredits !== undefined) {
      const monthly = Number(planInfo.monthlyPromptCredits);
      const available = Number(availableCredits);
      if (monthly > 0) {
        promptCredits = {
          available,
          monthly,
          usedPercentage: ((monthly - available) / monthly) * 100,
          remainingPercentage: (available / monthly) * 100,
        };
      }
    }

    // Parse models quota
    const rawModels = userStatus.cascadeModelConfigData?.clientModelConfigs || [];

    let debugLogged = false;
    const models: ModelQuotaInfo[] = rawModels
      .filter((m: any) => m.quotaInfo)
      .map((m: any) => {
        const resetTime = new Date(m.quotaInfo.resetTime);
        const now = new Date();
        const diff = resetTime.getTime() - now.getTime();

        // CRITICAL FIX: The API might return "remainingFraction" as the USED fraction
        // OR it might be missing entirely for models that haven't been used yet or are N/A.
        // We default to 0 (empty) instead of 1 (full) to avoid misleading the user.
        const rawFraction = m.quotaInfo.remainingFraction !== undefined
          ? Number(m.quotaInfo.remainingFraction)
          : 0;

        // Debug: Log the raw value for the first model to understand the API
        if (!debugLogged) {
          debugLogged = true;
          logger.debug('QuotaManager', `First model quota sample for ${m.label}:`, {
            rawFraction,
            quotaInfoKeys: Object.keys(m.quotaInfo || {}),
            fullQuotaInfo: m.quotaInfo
          });
        }

        const remainingFraction = rawFraction !== undefined ? rawFraction : 0;
        const isExhausted = (rawFraction !== undefined && rawFraction <= 0.001) || m.quotaInfo.status === 'EXHAUSTED';
        const isNA = rawFraction === undefined && m.quotaInfo.status !== 'EXHAUSTED';

        return {
          label: m.label,
          modelId: m.modelOrAlias?.model || 'unknown',
          remainingFraction,
          remainingPercentage: remainingFraction * 100,
          isExhausted,
          isNA,
          resetTime,
          timeUntilReset: diff,
          timeUntilResetFormatted: this.formatTime(diff, resetTime),
        };
      });

    // Try to find email in various locations with extended fallbacks
    // Some versions might use snake_case or different nesting
    const userStatusAny = userStatus as any;
    const dataAny = data as any;

    const email = userStatusAny.email ||
      userStatusAny.user?.email ||
      userStatusAny.userProfile?.email ||
      userStatusAny.user_profile?.email ||
      dataAny.user?.email ||
      dataAny.userProfile?.email ||
      dataAny.user_status?.user?.email;

    if (!email) {
      logger.debug('QuotaManager', 'Email not found in standard paths. Dumping keys for debugging:', {
        userStatusKeys: Object.keys(userStatus || {}),
        userKeys: Object.keys(userStatusAny.user || {}),
        userProfileKeys: Object.keys(userStatusAny.userProfile || {}),
        rootKeys: Object.keys(data || {})
      });
    }

    return {
      timestamp: new Date(),
      email,
      promptCredits,
      models,
    };
  }

  private formatTime(ms: number, resetTime: Date): string {
    if (ms <= 0) return 'Ready';

    const mins = Math.ceil(ms / 60000);
    let duration = '';

    if (mins < 60) {
      duration = `${mins}m`;
    } else if (mins < 24 * 60) {
      const hours = Math.floor(mins / 60);
      duration = `${hours}h ${mins % 60}m`;
    } else {
      const days = Math.floor(mins / (60 * 24));
      const hours = Math.floor((mins % (60 * 24)) / 60);
      duration = `${days}d ${hours}h`;
    }

    // Format date: "Mon 22:09" or similar
    const dateStr = resetTime.toLocaleDateString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return `${duration} (${dateStr})`;
  }
}
