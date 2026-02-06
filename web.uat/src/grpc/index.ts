/**
 * gRPC-Web API Client
 * 
 * Usage:
 *   import { apiServiceClient } from '@/grpc';
 *   
 *   // Health check
 *   const health = await apiServiceClient.health();
 *   
 *   // Get markets
 *   const markets = await apiServiceClient.getMarkets({ limit: 10, offset: 0 });
 *   
 *   // Get single market
 *   const market = await apiServiceClient.getMarketById({ marketId: 'uuid-here' });
 * 
 * Configuration:
 *   Set VITE_GRPC_ENDPOINT in your .env file to point to your gRPC-Web server
 */

export { apiServiceClient } from './client';
export * from './types';
