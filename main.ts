import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { OKXCandlesticksResponse, OKXTickerResponse } from "./src/types.ts";

class OKXServer {
  private server: Server;
  private axiosInstance;

  constructor() {

    this.server = new Server({
      name: "mcp-server",
      version: "0.1.0",
    }, {
      capabilities: {
        tools: {},
      },
    });

    this.axiosInstance = axios.create({
      baseURL: "https://www.okx.com/api/v5",
      timeout: 5000,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[Error]", error);
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: "get_price",
          description: "Get latest price for an OKX instrument",
          inputSchema: {
            type: "object",
            properties: {
              instrument: {
                type: "string",
                description: "Instrument ID (e.g. BTC-USDT)",
              },
            },
            required: ["instrument"],
          },
        },
        {
          name: "get_candlesticks",
          description: "Get candlestick data for an OKX instrument",
          inputSchema: {
            type: "object",
            properties: {
              instrument: {
                type: "string",
                description: "Instrument ID (e.g. BTC-USDT)",
              },
              bar: {
                type: "string",
                description: "Time interval (e.g. 1m, 5m, 1H, 1D)",
                default: "1m",
              },
              limit: {
                type: "number",
                description: "Number of candlesticks (max 100)",
                default: 100,
              },
            },
            required: ["instrument"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        if (!["get_price", "get_candlesticks"].includes(request.params.name)) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`,
          );
        }

        const args = request.params.arguments as {
          instrument: string;
          bar?: string;
          limit?: number;
        };

        if (!args.instrument) {
          throw new McpError(
            ErrorCode.InvalidParams,
            "Missing required parameter: instrument",
          );
        }

        if (request.params.name === "get_price") {
          console.error(
            `[API] Fetching price for instrument: ${args.instrument}`,
          );
          const response = await this.axiosInstance.get<OKXTickerResponse>(
            "/market/ticker",
            {
              params: { instId: args.instrument },
            },
          );

          if (response.data.code !== "0") {
            throw new Error(`OKX API error: ${response.data.msg}`);
          }

          if (!response.data.data || response.data.data.length === 0) {
            throw new Error("No data returned from OKX API");
          }

          const ticker = response.data.data[0];
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    instrument: ticker.instId,
                    lastPrice: ticker.last,
                    bid: ticker.bidPx,
                    ask: ticker.askPx,
                    high24h: ticker.high24h,
                    low24h: ticker.low24h,
                    volume24h: ticker.vol24h,
                    timestamp: new Date(parseInt(ticker.ts)).toISOString(),
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } else {
          // get_candlesticks
          console.error(
            `[API] Fetching candlesticks for instrument: ${args.instrument}, bar: ${
              args.bar || "1m"
            }, limit: ${args.limit || 100}`,
          );
          const response = await this.axiosInstance.get<
            OKXCandlesticksResponse
          >(
            "/market/candles",
            {
              params: {
                instId: args.instrument,
                bar: args.bar || "1m",
                limit: args.limit || 100,
              },
            },
          );

          if (response.data.code !== "0") {
            throw new Error(`OKX API error: ${response.data.msg}`);
          }

          if (!response.data.data || response.data.data.length === 0) {
            throw new Error("No data returned from OKX API");
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  response.data.data.map((
                    [time, open, high, low, close, vol, volCcy],
                  ) => ({
                    timestamp: new Date(parseInt(time)).toISOString(),
                    open,
                    high,
                    low,
                    close,
                    volume: vol,
                    volumeCurrency: volCcy,
                  })),
                  null,
                  2,
                ),
              },
            ],
          };
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          console.error("[Error] Failed to fetch data:", error);
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to fetch data: ${error.message}`,
          );
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new OKXServer();
server.run().catch(console.error);
