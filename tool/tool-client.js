const { spawn } = require("child_process");
const path = require("path");

function invokeSummarize(notes) {
  return new Promise((resolve, reject) => {
    const toolPath = path.join(__dirname, "executa-tool.js");
    const child = spawn(process.execPath, [toolPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();

      const lines = stdout.split(/\r?\n/).filter(Boolean);
      const lastLine = lines.at(-1);
      if (!lastLine || settled) {
        return;
      }

      try {
        const message = JSON.parse(lastLine);
        settled = true;
        child.kill();

        if (message.error) {
          reject(new Error(message.error.message || "Tool error"));
          return;
        }

        resolve(message.result);
      } catch {
        // Wait for a complete JSON line.
      }
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("exit", (code) => {
      if (!settled && code !== 0) {
        reject(new Error(stderr || `Tool exited with code ${code}`));
      }
    });

    child.stdin.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: "summarize-request",
        method: "call",
        params: {
          name: "summarize",
          arguments: { notes },
        },
      })}\n`
    );
    child.stdin.end();
  });
}

module.exports = { invokeSummarize };
