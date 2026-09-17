#!/usr/bin/env node
const { readFileSync } = require("fs");
const { join } = require("path");

if (process.argv.includes("--version")) {
    const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8"));
    console.log(pkg.version);
} else {
    console.log("hello");
}
