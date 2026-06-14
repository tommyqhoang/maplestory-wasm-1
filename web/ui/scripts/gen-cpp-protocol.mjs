import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const spec = JSON.parse(readFileSync(resolve(here, "../src/bridge/protocol.spec.json"), "utf8"));

const lines = [
  "// AUTO-GENERATED from web/ui/src/bridge/protocol.spec.json — do not edit by hand.",
  "#pragma once",
  "namespace jrc { namespace bridge {",
  `constexpr int PROTOCOL_VERSION = ${spec.version};`,
];
for (const m of spec.messages) {
  const name = m.type.toUpperCase();
  lines.push(`constexpr const char* MSG_${name} = "${m.type}";`);
}
lines.push("}}");

const out = resolve(here, "../../../src/client/IO/UiBridgeProtocol.h");
writeFileSync(out, lines.join("\n") + "\n");
console.log("wrote", out);
