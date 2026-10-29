const fs = require("node:fs");

const source = fs.readFileSync("server.js", "utf8");
const route = source.match(/app\.post\("\/api\/bot\/groups\/:threadId\/chat\/close"[\s\S]*?\n\}\);/);
if (!route) throw new Error("Group chat close route is missing.");
if (!route[0].includes("if (!/^\\d{1,128}$/.test(id))")) {
  throw new Error("Group chat close route must accept numeric thread IDs.");
}
console.log("NEXUS server route regression checks: OK");
