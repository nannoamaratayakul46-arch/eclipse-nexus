const fs = require("node:fs");

const source = fs.readFileSync("server.js", "utf8");
const route = source.match(/app\.post\("\/api\/bot\/groups\/:threadId\/chat\/close"[\s\S]*?\n\}\);/);
if (!route) throw new Error("Group chat close route is missing.");
if (!/if \(!\/\^\\d\{1,128\}\$\/\.test\(id\)\)/.test(route[0])) {
  throw new Error("Group chat close route must validate numeric thread IDs with the correct digit regex.");
}
console.log("NEXUS server route regression checks: OK");
