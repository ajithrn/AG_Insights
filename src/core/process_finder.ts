/**
 * Process Finder
 * Detects Antigravity language server process and extracts connection parameters
 * SECURITY: Only communicates with LOCAL processes on 127.0.0.1
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import { ProcessInfo } from '../utils/types';
import { logger } from '../utils/logger';

const execAsync = promisify(exec);

export class ProcessFinder {
  /**
   * Detect Antigravity language server process
   * SECURITY NOTE: This only scans LOCAL processes and extracts LOCAL connection info
   */
  async detectProcessInfo(workspacePath?: string): Promise<ProcessInfo | null> {
    logger.info('ProcessFinder', 'Starting process detection...', { workspacePath });

    try {
      // Find language_server process
      // Increase buffer size in case of many processes/long output
      const { stdout } = await execAsync('ps aux | grep language_server | grep -v grep', { maxBuffer: 1024 * 1024 });
      logger.debug('ProcessFinder', 'Process list output length:', stdout.length);

      const lines = stdout.split('\n');
      let targetLine = '';

      if (workspacePath) {
        // Try to find exact match for current workspace
        // Workspace ID format in args: file_Users_username_path_to_workspace
        // Convert local path to this format to search
        const sanitizedPath = workspacePath.replace(/[\/\\:]/g, '_');
        // Also try just the folder name as fallback
        const folderName = workspacePath.split(/[\\/]/).pop();

        logger.debug('ProcessFinder', 'Searching for workspace match', { sanitizedPath, folderName });

        targetLine = lines.find(line =>
          line.includes(sanitizedPath) ||
          (folderName && line.includes(folderName))
        ) || '';
      }

      // Fallback: Use the first line containing proper flags if no specific workspace match
      if (!targetLine) {
        logger.info('ProcessFinder', 'No specific workspace process found, using first available Antigravity process');
        targetLine = lines.find(line => line.includes('--extension_server_port') || line.includes('--api_server_port')) || '';
      }

      if (!targetLine) {
        logger.error('ProcessFinder', 'No Antigravity language server process found with valid ports');
        return null;
      }

      logger.debug('ProcessFinder', 'Target process line:', targetLine);

      // Extract port from command line arguments
      // Regex to find --extension_server_port 12345 or --extension_server_port=12345
      const portMatch = targetLine.match(/--(?:extension|api)_server_port[=\s]+(\d+)/);
      if (!portMatch) {
        logger.error('ProcessFinder', 'Could not find API server port in process arguments');
        return null;
      }

      const extensionPort = parseInt(portMatch[1], 10);
      logger.info('ProcessFinder', `Found extension port: ${extensionPort}`);

      // Extract PID from ps output (2nd column)
      // "user pid ..."
      const parts = targetLine.trim().split(/\s+/);
      const pid = parseInt(parts[1], 10);

      let discoveredPorts: number[] = [];
      if (!isNaN(pid) && pid > 0) {
        try {
          discoveredPorts = await this.findPortsUsingLsof(pid);
          logger.info('ProcessFinder', `Discovered listening ports for PID ${pid}: ${discoveredPorts.join(', ')}`);
        } catch (e: any) {
          logger.error('ProcessFinder', `Failed to find ports using lsof for PID ${pid}: ${e.message}`);
        }
      }

      // Try to find the actual connect port using discovered ports or common offsets
      const connectPort = await this.findConnectPort(extensionPort, discoveredPorts);
      if (!connectPort) {
        logger.error('ProcessFinder', 'Could not find connect port');
        return null;
      }

      // Get CSRF token from the process environment or generate one
      const csrfToken = await this.extractCsrfToken(targetLine);

      logger.info('ProcessFinder', 'Successfully detected process info', {
        extensionPort,
        connectPort,
        csrfTokenLength: csrfToken.length,
      });

      return {
        extensionPort,
        connectPort,
        csrfToken,
      };
    } catch (error: any) {
      logger.error('ProcessFinder', 'Failed to detect process', {
        message: error.message,
        stack: error.stack,
      });
      return null;
    }
  }

  /**
   * Find listening TCP ports for a given PID using lsof
   */
  private async findPortsUsingLsof(pid: number): Promise<number[]> {
    try {
      // -a: AND selection
      // -p: PID
      // -iTCP: TCP ports
      // -sTCP:LISTEN: Only listening state
      // -P: No port names (numeric only)
      // -n: No host names
      // -F n: Output only network file lines (start with n)
      const { stdout } = await execAsync(`lsof -a -p ${pid} -iTCP -sTCP:LISTEN -P -n`);

      // Output format varies, but usually we look for lines like "TCP 127.0.0.1:53507 (LISTEN)"
      // Or simply parse all numbers that look like ports from the output
      const ports: Set<number> = new Set();

      const lines = stdout.split('\n');
      for (const line of lines) {
        // Regex to find port in "IP:PORT" or just "PORT" (lsof output can be complex)
        // Looking for pattern like ":12345" followed by (LISTEN) or similar
        const match = line.match(/:(\d+)\s+/);
        if (match) {
          const port = parseInt(match[1], 10);
          if (!isNaN(port) && port > 1024) {
            ports.add(port);
          }
        }
      }

      return Array.from(ports);
    } catch (error) {
      // lsof might fail if process doesn't belong to user or other integrity protection
      return [];
    }
  }

  /**
   * Find the actual connect port by testing discovered ports and common offsets
   * SECURITY NOTE: Only tests ports on 127.0.0.1 (localhost)
   */
  private async findConnectPort(basePort: number, discoveredPorts: number[] = []): Promise<number | null> {
    // 1. Prioritize discovered ports from lsof (excluding the known extension port if possible, or test all)
    // 2. Fallback to common offsets

    // Filter out basePort from discovered if we know it's the extension server (we need the language server API port)
    // Usually one is extension_server and another is generic gRPC or http server

    const portsToTry = [...discoveredPorts];

    // Add fallback offsets just in case lsof missed something or failed
    const offsets = [basePort, basePort + 1, basePort - 1, basePort + 2, basePort + 3];
    for (const p of offsets) {
      if (!portsToTry.includes(p)) {
        portsToTry.push(p);
      }
    }

    // Deduplicate
    const uniquePorts = [...new Set(portsToTry)];

    for (const port of uniquePorts) {
      // Skip likely irrelevant ports if we have many? 
      // For now test all, localhost connect is fast.

      logger.debug('ProcessFinder', `Testing port ${port}...`);

      if (await this.testPort(port)) {
        logger.info('ProcessFinder', `Found working connect port: ${port}`);
        return port;
      }
    }

    return null;
  }

  /**
   * Test if a port is accessible
   * SECURITY NOTE: Only connects to 127.0.0.1 (localhost)
   */
  private testPort(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const options: https.RequestOptions = {
        hostname: '127.0.0.1', // SECURITY: Local only
        port,
        path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
        method: 'POST',
        rejectUnauthorized: false,
        timeout: 2000,
      };

      const req = https.request(options, res => {
        resolve(res.statusCode !== undefined);
        req.destroy();
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.write('{}');
      req.end();
    });
  }

  /**
   * Extract CSRF token from process info
   * SECURITY NOTE: Token is only used for LOCAL API authentication
   */
  private async extractCsrfToken(processOutput: string): Promise<string> {
    // Try to extract from process arguments
    const tokenMatch = processOutput.match(/--csrf[_-]token[=\s]+([a-zA-Z0-9-]+)/);
    if (tokenMatch) {
      return tokenMatch[1];
    }

    // If not found, generate a placeholder (some versions don't require it)
    // Try to find a UUID-like string if the flag matching failed
    const uuidMatch = processOutput.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    if (uuidMatch) {
      return uuidMatch[0];
    }

    return 'antigravity-quota-monitor';
  }
}
