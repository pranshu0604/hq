// PM2 process definition — runs HQ in production on port 3411 and keeps it alive.
module.exports = {
  apps: [
    {
      name: "hq",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3411",
      cwd: "/Users/pranshupandey/Developer/Personal/hq",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 15,
      watch: false,
      env: {
        NODE_ENV: "production",
        PORT: "3411",
      },
    },
    {
      name: "hq-mcp-http",
      script: "mcp/hq-http.mjs",
      cwd: "/Users/pranshupandey/Developer/Personal/hq",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 15,
      watch: false,
    },
    {
      name: "hq-assistant",
      script: "mcp/assistant-bridge.mjs",
      cwd: "/Users/pranshupandey/Developer/Personal/hq",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      watch: false,
    },
  ],
};
