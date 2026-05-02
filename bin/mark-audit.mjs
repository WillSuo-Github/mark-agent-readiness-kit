#!/usr/bin/env node
import { runCli } from "../src/cli.mjs";

runCli(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exitCode = 1;
  });
