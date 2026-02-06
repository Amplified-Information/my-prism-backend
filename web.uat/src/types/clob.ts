// Minimal CLOB types for mock UI display

export interface OrderBookLevel {
  price: number;
  quantity: number;
  orderCount: number;
}

export interface OrderBook {
  marketId: string;
  bids: OrderBookLevel[]; // sorted by price descending
  asks: OrderBookLevel[]; // sorted by price ascending
  lastUpdate: number;
}

export interface CLOBOrder {
  orderId: string;
  marketId: string;
  side: 'BUY' | 'SELL';
  priceTicks: number;
  quantity: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: string;
}

export interface CLOBPosition {
  marketId: string;
  accountId: string;
  positionType: 'YES' | 'NO';
  quantity: number;
  avgEntryPrice: number;
  unrealizedPnl: number;
}

export interface CLOBMarketStats {
  volume24h: number;
  tradeCount24h: number;
  lastPrice: number;
}
