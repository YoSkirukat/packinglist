import fs from "node:fs";
import { parsePackingList, summarizeItems } from "../src/lib/packing-list";

async function main() {
  const file = process.argv[2] || "PackingList.xlsx";
  const started = Date.now();
  const buf = fs.readFileSync(file);
  console.log("size_mb", (buf.length / 1024 / 1024).toFixed(2));
  const items = await parsePackingList(buf);
  const sum = summarizeItems(items);
  console.log("parsed_ms", Date.now() - started);
  console.log("count", items.length);
  console.log("sum", sum);
  console.log("first", items[0]);
  console.log("last", items[items.length - 1]);
}

main();
