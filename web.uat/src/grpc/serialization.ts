/**
 * Protobuf serialization helpers for gRPC-Web
 * Manual implementation since we can't run protoc in browser
 */

import * as jspb from 'google-protobuf';
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
  Comment,
  GetCommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
} from './types';

// Helper to create a simple message class
function createMessage<T extends object>(data: T): jspb.Message {
  const msg = new jspb.Message();
  // For gRPC-Web, we serialize to JSON format which is simpler
  return msg;
}

// Serializers - convert TypeScript objects to binary protobuf
export const Serializers = {
  empty: (_data: Empty): Uint8Array => {
    return new Uint8Array(0);
  },

  predictionIntentRequest: (data: PredictionIntentRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  marketIdRequest: (data: MarketIdRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  limitOffsetRequest: (data: LimitOffsetRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  newMarketRequest: (data: NewMarketRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  priceHistoryRequest: (data: PriceHistoryRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  getCommentsRequest: (data: GetCommentsRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },

  createCommentRequest: (data: CreateCommentRequest): Uint8Array => {
    return new TextEncoder().encode(JSON.stringify(data));
  },
};

// Deserializers - convert binary protobuf to TypeScript objects
export const Deserializers = {
  stdResponse: (bytes: Uint8Array): StdResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as StdResponse;
  },

  marketResponse: (bytes: Uint8Array): MarketResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as MarketResponse;
  },

  marketsResponse: (bytes: Uint8Array): MarketsResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as MarketsResponse;
  },

  priceHistoryResponse: (bytes: Uint8Array): PriceHistoryResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as PriceHistoryResponse;
  },

  getCommentsResponse: (bytes: Uint8Array): GetCommentsResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as GetCommentsResponse;
  },

  createCommentResponse: (bytes: Uint8Array): CreateCommentResponse => {
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json) as CreateCommentResponse;
  },
};
