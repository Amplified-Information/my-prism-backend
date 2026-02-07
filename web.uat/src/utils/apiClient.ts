import { hederaConfig } from '@/config/hedera';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

class ApiClient {
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number, baseDelay: number, maxDelay: number): number {
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;
    return Math.min(exponentialDelay + jitter, maxDelay);
  }

  async fetchWithRetry<T>(
    url: string, 
    options: RequestInit = {},
    retryOptions: RetryOptions = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 10000
    } = retryOptions;

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          break;
        }

        // Don't retry on certain errors
        if (error.name === 'AbortError' || 
            (error.message && error.message.includes('401')) ||
            (error.message && error.message.includes('403'))) {
          break;
        }

        const delay = this.calculateDelay(attempt, baseDelay, maxDelay);
        await this.sleep(delay);
      }
    }

    throw lastError!;
  }

  async getHederaAccountBalance(accountId: string): Promise<any> {
    return this.fetchWithRetry(
      `${hederaConfig.mirrorNodeUrl}/accounts/${accountId}`,
      {},
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  async getHederaAccountInfo(accountId: string): Promise<any> {
    return this.fetchWithRetry(
      `${hederaConfig.mirrorNodeUrl}/accounts/${accountId}`,
      {},
      { maxRetries: 2, baseDelay: 500 }
    );
  }

  async getHederaTokenBalance(accountId: string, tokenId: string): Promise<number> {
    try {
      const accountInfo = await this.fetchWithRetry<any>(
        `${hederaConfig.mirrorNodeUrl}/accounts/${accountId}`,
        {},
        { maxRetries: 1, baseDelay: 500 }
      );
      
      const tokenBalance = accountInfo.balance?.tokens?.find(
        (token: any) => token.token_id === tokenId
      );
      
      return tokenBalance ? parseInt(tokenBalance.balance) : 0;
    } catch (error) {
      return 0;
    }
  }
}

export const apiClient = new ApiClient();