export interface OKXTickerResponse {
  code: string;
  msg: string;
  data: Array<{
    instId: string;
    last: string;
    askPx: string;
    bidPx: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    ts: string;
  }>;
}

export interface OKXCandlesticksResponse {
  code: string;
  msg: string;
  data: Array<[
    time: string, // Open time
    open: string, // Open price
    high: string, // Highest price
    low: string, // Lowest price
    close: string, // Close price
    vol: string, // Trading volume
    volCcy: string, // Trading volume in currency
  ]>;
}
