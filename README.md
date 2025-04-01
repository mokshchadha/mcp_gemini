# mcp_gemini

Model Context Protocol client and server with Gemini LLM

## Server 
the server code is in main.ts - which you can run and connect with claude by updating the developer config there 
```json
{
  "mcpServers":{
    "mcp-server":{
      "command":"deno",
      "args":[
        "run",
        "-A",
        "path_to_repo/main.ts"
      ]
    }
  }
}


```