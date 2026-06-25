/**
 * Config module
 * 
 * Provides methods for loading server configuration and metadata.
 */

import { AxiosInstance } from 'axios';
import { extractData, ApiResponse } from '../types/common.js';
import type {
  ServerMetadata,
  DeploymentConfig,
  BankConfig,
  AssetConfig,
  MonitorStatus,
} from './types.js';

/**
 * Config module for loading server configuration.
 */
export class ConfigModule {
  private cachedMetadata: ServerMetadata | null = null;
  private cachedBankConfig: BankConfig | null = null;
  private cachedDeployment: DeploymentConfig | null = null;

  constructor(private api: AxiosInstance) {}

  /**
   * Get server metadata (project, version, capabilities, auth domain).
   * 
   * For bank configuration (vaults, assets), use getBankConfig() instead.
   * 
   * @param useCache - Use cached value if available (default: true)
   */
  async getMetadata(useCache: boolean = true): Promise<ServerMetadata> {
    if (useCache && this.cachedMetadata) {
      return this.cachedMetadata;
    }

    const response = await this.api.get<ApiResponse<ServerMetadata>>(
      '/config/metadata'
    );
    this.cachedMetadata = extractData(response);
    return this.cachedMetadata;
  }

  /**
   * Get per-monitor runtime status from `/health` (start/last-scanned block,
   * confirmations, last error). Empty until monitors have started.
   */
  async getMonitors(): Promise<MonitorStatus[]> {
    const response = await this.api.get<{ runtime?: { monitors?: MonitorStatus[] } }>('/health');
    return response.data?.runtime?.monitors ?? [];
  }

  /**
   * Get bank configuration (vaults, assets, chain info).
   *
   * This is the authoritative source for bank/vault configuration.
   * Note: Bank supports multiple vaults on different chains.
   *
   * @param useCache - Use cached value if available (default: true)
   */
  async getBankConfig(useCache: boolean = true): Promise<BankConfig | null> {
    if (useCache && this.cachedBankConfig) {
      return this.cachedBankConfig;
    }

    const baseURL = this.api.defaults?.baseURL || '';
    const fullUrl = `${baseURL}/bank/config`;
    try {
      const response = await this.api.get<ApiResponse<BankConfig>>(
        '/bank/config'
      );
      const extracted = extractData(response);
      this.cachedBankConfig = extracted;
      return this.cachedBankConfig;
    } catch (error: any) {
      // Bank capability may not be enabled - expected when server has no bank
      const status = error?.response?.status;
      const isNotFoundOrUnavailable =
        status === 404 ||
        status === 501 ||
        error?.code === 'ERR_NETWORK' ||
        error?.message?.includes('Network Error');

      const logPayload = {
        message: error?.message ?? String(error),
        status,
        statusText: error?.response?.statusText,
        url: fullUrl,
      };

      if (isNotFoundOrUnavailable) {
        // Expected when bank is not enabled; avoid noisy console.error
        if (typeof console.debug === 'function') {
          console.debug('[ConfigModule] Bank config not available (bank capability may be disabled):', logPayload);
        }
      } else {
        console.warn('[ConfigModule] Failed to fetch bank config:', logPayload);
      }
      return null;
    }
  }

  /**
   * Get deployment configuration derived from bank config.
   * 
   * Uses the first vault from the bank configuration. For multi-chain support,
   * you can filter vaults by chainId before calling this method.
   * 
   * @param rpcUrl - RPC URL for the chain (default: http://localhost:8545)
   * @param useCache - Use cached value if available (default: true)
   * @param chainId - Optional chain ID to select a specific vault (default: uses first vault)
   */
  async getDeploymentConfig(
    rpcUrl: string = 'http://localhost:8545',
    useCache: boolean = true,
    chainId?: number
  ): Promise<DeploymentConfig> {
    // Only use cache if:
    // 1. useCache is true
    // 2. Cached deployment exists
    // 3. Either no chainId requested, or cached chainId matches requested chainId
    // 4. Cached chainId is valid (not undefined/NaN)
    if (useCache && this.cachedDeployment) {
      const cachedChainId = this.cachedDeployment.chainId;
      const chainIdMatches = !chainId || cachedChainId === chainId;
      const chainIdValid = typeof cachedChainId === 'number' && !isNaN(cachedChainId);
      
      if (chainIdMatches && chainIdValid) {
        return this.cachedDeployment;
      } else {
        // Clear cache if chainId doesn't match or is invalid
        this.cachedDeployment = null;
      }
    }

    const bank = await this.getBankConfig(useCache);

    if (!bank || !bank.vaults || bank.vaults.length === 0) {
      // Check if bank capability is enabled to provide a better error message
      let errorMessage = 'No bank configuration found.';
      try {
        const metadata = await this.getMetadata(useCache);
        const hasBankCapability = metadata.capabilities.includes('bank');
        if (!hasBankCapability) {
          errorMessage = 'No bank configuration found. The bank capability is not enabled on this server.';
        } else {
          errorMessage = 'No bank configuration found. The bank capability is enabled but /bank/config endpoint returned no vaults.';
        }
      } catch (e) {
        // If we can't get metadata, use the default message
        errorMessage = 'No bank configuration found. Is the bank capability enabled?';
      }
      throw new Error(errorMessage);
    }
    
    const vault = chainId
      ? bank.vaults.find((v) => {
          // Normalize chainId for comparison (handle both number and string)
          const vChainId = typeof v.chainId === 'number' 
            ? v.chainId 
            : typeof v.chainId === 'string' 
              ? parseInt(v.chainId as unknown as string, 10) 
              : NaN;
          const matches = !isNaN(vChainId) && vChainId === chainId;
          return matches;
        })
      : bank.vaults[0];

    if (!vault) {
      console.error('[ConfigModule] No vault found:', {
        requestedChainId: chainId,
        availableVaults: bank.vaults.map(v => v.chainId),
      });
      throw new Error(
        chainId
          ? `No vault found for chain ID ${chainId}`
          : 'No vaults available in bank configuration'
      );
    }
    
    // Validate vault has chainId before proceeding
    const chainIdValue = vault.chainId;
    
    if (chainIdValue === undefined || chainIdValue === null) {
      console.error('[ConfigModule] Vault missing chainId:', {
        vault: vault,
        vaultKeys: Object.keys(vault),
        hasChainId: 'chainId' in vault,
        chainIdValue: chainIdValue,
        vaultString: JSON.stringify(vault, null, 2),
      });
      throw new Error(`Selected vault is missing chainId property. Vault keys: ${Object.keys(vault).join(', ')}. Full vault: ${JSON.stringify(vault, null, 2)}`);
    }
    
    // Use the chainIdValue we found
    const vaultChainId = chainIdValue;

    const defaultAsset = vault.asset && vault.asset.length > 0 ? vault.asset[0] : null;

    // Build contracts object - only add asset contract if symbol is available
    const contracts: Record<string, string> = {};
    if (defaultAsset && defaultAsset.address) {
      // Use symbol if available, otherwise use name, otherwise use 'USDC' as fallback
      const symbol = defaultAsset.symbol || defaultAsset.name || 'USDC';
      contracts[symbol] = defaultAsset.address;
    }
    if (vault.UserVault) {
      contracts.UserVault = vault.UserVault;
    }

    // Ensure assets have required fields (symbol and decimals)
    // Handle both old format (without symbol/decimals) and new format (with symbol/decimals)
    const assets: AssetConfig[] = (vault.asset || []).map((asset: any, index: number) => {
      
      // Validate required fields
      if (!asset.id) {
        console.error(`[ConfigModule] Asset ${index} missing id:`, asset);
        throw new Error(`Asset at index ${index} is missing required field 'id'`);
      }
      if (!asset.address) {
        console.error(`[ConfigModule] Asset ${index} missing address:`, asset);
        throw new Error(`Asset at index ${index} is missing required field 'address'`);
      }
      
      const mapped: AssetConfig = {
        id: String(asset.id),
        address: String(asset.address),
        symbol: asset.symbol ?? asset.name ?? 'UNKNOWN',
        decimals: typeof asset.decimals === 'number' ? asset.decimals : 18,
        name: asset.name ?? undefined,
      };

      return mapped;
    });

    // Ensure chainId is a number (handle string conversion)
    // Use vaultChainId from validation above
    if (vaultChainId === undefined || vaultChainId === null) {
      const errorMsg = `Vault chainId is ${vaultChainId}. This should have been caught earlier. Vault: ${JSON.stringify(vault)}`;
      console.error('[ConfigModule]', errorMsg);
      throw new Error(errorMsg);
    }
    
    let deploymentChainId: number;
    if (typeof vaultChainId === 'number') {
      deploymentChainId = vaultChainId;
    } else if (typeof vaultChainId === 'string') {
      deploymentChainId = parseInt(vaultChainId, 10);
    } else {
      const errorMsg = `Invalid chainId type in vault: ${vaultChainId} (type: ${typeof vaultChainId}). Vault: ${JSON.stringify(vault)}`;
      console.error('[ConfigModule]', errorMsg);
      throw new Error(errorMsg);
    }
    
    if (isNaN(deploymentChainId)) {
      const errorMsg = `chainId parsed to NaN: ${vault.chainId} (type: ${typeof vault.chainId}). Vault: ${JSON.stringify(vault)}`;
      console.error('[ConfigModule]', errorMsg);
      throw new Error(errorMsg);
    }

    // Double-check deploymentChainId is valid before creating the object
    if (deploymentChainId === undefined || deploymentChainId === null || isNaN(deploymentChainId)) {
      const errorMsg = `deploymentChainId is invalid before creating deployment: ${deploymentChainId}. Vault chainId was: ${vault.chainId}`;
      console.error('[ConfigModule]', errorMsg, { vault, deploymentChainId });
      throw new Error(errorMsg);
    }

    // CRITICAL: Ensure deploymentChainId is valid - this should NEVER be undefined
    if (deploymentChainId === undefined || deploymentChainId === null || isNaN(deploymentChainId)) {
      const error = new Error(`CRITICAL: deploymentChainId is invalid! vault.chainId=${vault.chainId}, vaultChainId=${vaultChainId}, deploymentChainId=${deploymentChainId}`);
      console.error('[ConfigModule]', error.message, {
        vault,
        vaultChainId,
        deploymentChainId,
        chainIdValue,
        vaultKeys: Object.keys(vault),
        vaultString: JSON.stringify(vault, null, 2),
      });
      throw error;
    }

    const deployment: DeploymentConfig = {
      chainId: deploymentChainId,
      rpcUrl,
      contracts,
      assets,
      defaultAssetId: defaultAsset?.id ?? null,
    };

    // Final validation - this should NEVER fail if code above is correct
    if (deployment.chainId === undefined || deployment.chainId === null || isNaN(deployment.chainId)) {
      const error = new Error(`CRITICAL: Deployment config created with invalid chainId: ${deployment.chainId}. deploymentChainId was: ${deploymentChainId}`);
      console.error('[ConfigModule]', error.message, {
        deployment,
        deploymentChainId,
        vaultChainId,
        vault,
        vaultString: JSON.stringify(vault, null, 2),
      });
      throw error;
    }
    
    // Final validation - ensure chainId is set
    if (deployment.chainId === undefined || deployment.chainId === null || isNaN(deployment.chainId)) {
      const errorMsg = `Deployment config created with invalid chainId: ${deployment.chainId}. This should never happen.`;
      console.error('[ConfigModule]', errorMsg, {
        deployment,
        deploymentChainId,
        vaultChainId,
        chainIdValue,
        vault: JSON.stringify(vault, null, 2),
      });
      throw new Error(errorMsg);
    }
    
    // Final sanity check before caching and returning
    this.cachedDeployment = deployment;
    return deployment;
  }

  /**
   * Clear cached configuration.
   */
  clearCache(): void {
    this.cachedMetadata = null;
    this.cachedBankConfig = null;
    this.cachedDeployment = null;
  }
}
