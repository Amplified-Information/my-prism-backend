interface Evt {
  type: 'contract',
  net: string,
  event: string,
  args: Record<string, string>,
  timestamp: string,
  txHash: string,
  host: string
}

export type { Evt }
