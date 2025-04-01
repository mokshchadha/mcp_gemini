import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenerativeAI, Tool } from "@google/generative-ai";
import * as readline from "node:readline/promises";
import process from "node:process";

const GOOGLE_GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_KEY");
if (!GOOGLE_GEMINI_KEY) {
  throw new Error("GOOGLE_GEMINI_KEY is not set");
}

class MCPClient {
  private mcp: Client;
  private llm: GoogleGenerativeAI;

  private transport: StdioClientTransport | null = null;
  private tools: any = [];

  constructor() {
    this.llm = new GoogleGenerativeAI(GOOGLE_GEMINI_KEY ?? "");
    this.mcp = new Client({ name: "mcp-server", version: "0.1.0" });
  }

  // connect to the MCP server
  async connectToServer(serverScriptPath: string) {
    const command = "deno"; // because we are using deno for our server
    this.transport = new StdioClientTransport({
      command,
      args: ["run", "-A", serverScriptPath],
    });
    await this.mcp.connect(this.transport);

    const toolList = await this.mcp.listTools();
    console.log(toolList);
    this.tools = toolList.tools.map(
      (tool) => {
        return {
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema,
        };
      },
    );
  }

  // Processes the query

  async processQuery(query: string): Promise<string> {
    try {
      // Initialize the Gemini model
      const model = this.llm.getGenerativeModel({ model: "gemini-pro" });
      
      // Configure the chat with tools
      const chat = model.startChat({
        tools: this.tools.map((tool:any) => ({
          functionDeclarations: [{
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema
          }]
        }))
      });
      
      // Send user query to the model
      const result = await chat.sendMessage(query);
      const response = await result.response;
      const responseText = response.text();
      
      // Check if the model wants to call a tool
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        console.log(`Calling tool: ${functionCall.name}`);
        
        // Call the MCP tool with the parameters provided by the model
        const toolResponse = await this.mcp.callTool(
          functionCall.name, 
          JSON.parse(functionCall.args)
        );
        
        // Send the tool response back to the model
        const followUpResult = await chat.sendMessage(
          `Tool response: ${JSON.stringify(toolResponse)}`
        );
        return followUpResult.response.text();
      }
      
      return responseText;
    } catch (error) {
      console.error("Error processing query:", error);
      return `Error: ${error}`;
    }
  }

  async chatLoop() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    try {
      while (true) {
        const message = await rl.question("\nQuery: ");
        if (["quit", "q", "exit"].includes(message.toLowerCase())) {
          break;
        }

        const response = await this.processQuery(message);
        console.log("\n" + response);
      }
    } finally {
      rl.close();
    }
  }

  async cleanup() {
    await this.mcp.close();
  }
}

async function main() {
  if (process.argv.length < 2) {
    console.log(JSON.stringify(process.argv))
    console.log("Usage: deno run main.ts <path_to_server_file>");
    return;
  }

  const mcpClient = new MCPClient();

  try {
    await mcpClient.connectToServer(process.argv[2]);
    await mcpClient.chatLoop();
  } catch (error) {
    console.error(error);
    await mcpClient.cleanup();
    process.exit(0);
  }
}

main();
