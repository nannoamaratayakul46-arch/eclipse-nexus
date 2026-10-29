const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("public/index.html", "utf8");
const match = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!match) throw new Error("No inline dashboard script found.");
new vm.Script(match[1], { filename: "public/index.html:inline-script" });
console.log("NEXUS browser script syntax: OK");
