const { spawn } = require("child_process");
const path = require("path");

const toolPath = path.join(__dirname, "..", "tool", "executa-tool.js");
const child = spawn(process.execPath, [toolPath], {
  stdio: ["pipe", "pipe", "pipe"],
});

child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
});

child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
});

const requests = [
  {
    jsonrpc: "2.0",
    id: "describe-1",
    method: "describe",
    params: {},
  },
  {
    jsonrpc: "2.0",
    id: "call-1",
    method: "call",
    params: {
      name: "summarize",
      arguments: {
        notes: [
          { id: "1", content: "Fix login bug" },
          { id: "2", content: "Follow up with design team" },
          { id: "3", content: "Workshop content draft" },
        ],
      },
    },
  },
];

for (const request of requests) {
  child.stdin.write(`${JSON.stringify(request)}\n`);
}

child.stdin.end();
