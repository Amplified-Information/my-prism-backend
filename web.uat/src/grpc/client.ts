/**
 * gRPC-Web Client for ApiService
 * Uses fetch-based gRPC-Web implementation for browser compatibility
 */

import type {
  Empty,
  StdResponse,
  PredictionIntentRequest,
  MarketIdRequest,
  LimitOffsetRequest,
  MarketResponse,
  MarketsResponse,
  NewMarketRequest,
  PriceHistoryRequest,
  PriceHistoryResponse,
  GetCommentsRequest,
  GetCommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
} from './types';

// Configuration from environment
const GRPC_ENDPOINT = import.meta.env.VITE_GRPC_ENDPOINT || 'http://localhost:8080';
const GRPC_AUTH_USER = import.meta.env.VITE_GRPC_AUTH_USER || '';
const GRPC_AUTH_PASS = import.meta.env.VITE_GRPC_AUTH_PASS || '';

// Generate Basic Auth header
const getAuthHeader = (): string => {
  if (GRPC_AUTH_USER && GRPC_AUTH_PASS) {
    const credentials = btoa(`${GRPC_AUTH_USER}:${GRPC_AUTH_PASS}`);
    return `Basic ${credentials}`;
  }
  return '';
};

interface UnaryMethodDescriptor<TRequest, TResponse> {
  methodName: string;
  service: { serviceName: string };
  requestStream: false;
  responseStream: false;
  requestType: { serializeBinary: (req: TRequest) => Uint8Array };
  responseType: { deserializeBinary: (bytes: Uint8Array) => TResponse };
}

// Generic unary call helper using fetch (gRPC-Web over HTTP/1.1)
async function unaryCall<TRequest, TResponse>(
  methodName: string,
  request: TRequest,
  deserialize: (data: any) => TResponse
): Promise<TResponse> {
  const url = `${GRPC_ENDPOINT}/api.ApiService/${methodName}`;
  
  console.log(`[gRPC] Calling ${methodName}`, request);
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/grpc-web+json',
    'X-Grpc-Web': '1',
  };
  
  // Add Basic Auth if configured
  const authHeader = getAuthHeader();
  if (authHeader) {
    headers['Authorization'] = authHeader;
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[gRPC] ${methodName} failed:`, response.status, errorText);
    throw new Error(`gRPC call failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  console.log(`[gRPC] ${methodName} response:`, data);
  
  return deserialize(data);
}

// API Service Client
export const apiServiceClient = {
  /**
   * Health check
   */
  health: async (): Promise<StdResponse> => {
    return unaryCall<Empty, StdResponse>('Health', {}, (data) => data as StdResponse);
  },

  /**
   * Submit a prediction intent (order)
   */
  predictIntent: async (request: PredictionIntentRequest): Promise<StdResponse> => {
    return unaryCall<PredictionIntentRequest, StdResponse>(
      'PredictIntent',
      request,
      (data) => data as StdResponse
    );
  },

  /**
   * Get a single market by ID
   */
  getMarketById: async (request: MarketIdRequest): Promise<MarketResponse> => {
    return unaryCall<MarketIdRequest, MarketResponse>(
      'GetMarketById',
      request,
      (data) => data as MarketResponse
    );
  },

  /**
   * Get list of markets with pagination
   */
  getMarkets: async (request: LimitOffsetRequest): Promise<MarketsResponse> => {
    return unaryCall<LimitOffsetRequest, MarketsResponse>(
      'GetMarkets',
      request,
      (data) => data as MarketsResponse
    );
  },

  /**
   * Create a new market
   */
  createMarket: async (request: NewMarketRequest): Promise<MarketResponse> => {
    return unaryCall<NewMarketRequest, MarketResponse>(
      'CreateMarket',
      request,
      (data) => data as MarketResponse
    );
  },

  /**
   * Get price history for a market
   */
  priceHistory: async (request: PriceHistoryRequest): Promise<PriceHistoryResponse> => {
    return unaryCall<PriceHistoryRequest, PriceHistoryResponse>(
      'PriceHistory',
      request,
      (data) => data as PriceHistoryResponse
    );
  },

  /**
   * Get available networks
   */
  availableNetworks: async (): Promise<StdResponse> => {
    return unaryCall<Empty, StdResponse>('AvailableNetworks', {}, (data) => data as StdResponse);
  },

  /**
   * Create a comment on a market
   */
  createComment: async (request: CreateCommentRequest): Promise<CreateCommentResponse> => {
    return unaryCall<CreateCommentRequest, CreateCommentResponse>(
      'CreateComment',
      request,
      (data) => data as CreateCommentResponse
    );
  },

  /**
   * Get comments for a market
   */
  getComments: async (request: GetCommentsRequest): Promise<GetCommentsResponse> => {
    return unaryCall<GetCommentsRequest, GetCommentsResponse>(
      'GetComments',
      request,
      (data) => data as GetCommentsResponse
    );
  },
};

// Export types for convenience
export type { 
  Empty,
  StdResponse,
  PredictionIntentRequest,
  MarketIdRequest,
  LimitOffsetRequest,
  MarketResponse,
  MarketsResponse,
  NewMarketRequest,
  PriceHistoryRequest,
  PriceHistoryResponse,
  GetCommentsRequest,
  GetCommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
} from './types';
