import { expect, test, describe } from "bun:test";
import { readFileSync } from "fs";
import { resolve } from "path";

const filePath = process.env.TEST_TARGET!;
const format = (process.env.FORMAT || "").toLowerCase();
const mode = process.env.MODE || "";

describe(`【最終網羅検証】対象: ${filePath}`, async () => {
  let WarichuClass: any;
  let WarichuErrorClass: any;

  // --- クラス抽出ロジック（ESM/non-ESM、難読化対応） ---
  const isModule = filePath.includes("/esm/") || filePath.endsWith(".ts") || format === "esm";
  if (isModule) {
    const absolutePath = resolve(process.cwd(), filePath);
    const mod = await import(absolutePath);
    WarichuClass = mod.Warichu; 
    WarichuErrorClass = mod.WarichuError;
  } else {
    const code = readFileSync(filePath, "utf-8");
    const runner = new Function(`${code}; const g = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : {}; return { W: g["Warichu"] || (typeof Warichu !== 'undefined' ? Warichu : null), E: g["WarichuError"] || (typeof WarichuError !== 'undefined' ? WarichuError : null) };`);
    const res = runner();
    WarichuClass = res.W; 
    WarichuErrorClass = res.E;
  }

  if (!WarichuClass) throw new Error(`クラス抽出失敗: ${filePath}`);
});
