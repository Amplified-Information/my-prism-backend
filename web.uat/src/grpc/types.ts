/**
 * TypeScript types generated from api.proto
 * These match the protobuf message definitions
 */

// Enums
export enum KeyType {
  ED25519 = 1,
  ECDSA_SECP256K1 = 2,
}

export type HederaNetwork = 'mainnet' | 'testnet' | 'previewnet';
export type MarketLimitType = 'market' | 'limit';
export type PriceResolution = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' | 'decade';

// Message types
export interface Empty {}

export interface StdResponse {
  message: string;
  errorCode: number;
}

export interface PredictionIntentRequest {
  txId: string;
  net: HederaNetwork;
  marketId: string;
  generatedAt: string;
  accountId: string;
  marketLimit: MarketLimitType;
  priceUsd: number;
  qty: number;
  sig: string;
  publicKey: string;
  evmAddress: string;
  keyType: KeyType;
}

export interface MarketIdRequest {
  marketId: string;
}

export interface LimitOffsetRequest {
  limit: number;
  offset: number;
}

export interface MarketResponse {
  marketId: string;
  net: HederaNetwork;
  statement: string;
  isOpen: boolean;
  createdAt: string;
  resolvedAt: string;
}

export interface MarketsResponse {
  markets: MarketResponse[];
}

export interface NewMarketRequest {
  marketId: string;
  net: HederaNetwork;
  statement: string;
  imageUrl?: string;
}

export interface PriceHistoryRequest {
  marketId: string;
  net: HederaNetwork;
  resolution: PriceResolution;
  from: string;
  to: string;
  limit?: number;
  offset?: number;
}

export interface PriceHistoryResponse {
  ticks: number[];
}

export interface GetCommentsRequest {
  marketId: string;
  limit?: number;
  offset?: number;
}

export interface Comment {
  commentId: string;
  accountId: string;
  content: string;
  sig: string;
  publicKey: string;
  keyType: KeyType;
  createdAt: string;
}

export interface GetCommentsResponse {
  comments: Comment[];
}

export interface CreateCommentRequest {
  marketId: string;
  accountId: string;
  content: string;
  sig: string;
  publicKey: string;
  keyType: KeyType;
}

export interface CreateCommentResponse {
  comment: Comment;
}
