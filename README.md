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


## Client - when you want to have your own client and not use vscode or claude desktop
How to run the client 
``` sh 
cd client 
deno run --allow-env --env-file=.env main.ts
```