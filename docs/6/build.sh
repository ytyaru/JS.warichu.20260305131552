#!/bin/bash
# 必要なディレクトリ構造を事前に作成
for t in bun browser node; do
  for f in ems no-esm script; do
    mkdir -p "dist/js/$t/$f"
  done
done
mkdir -p dist/css

# console削除対象リスト
CONSOLE_DROPS='["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

cat << 'EOF' > build_process.ts
import { build } from "bun";
import { writeFileSync, readFileSync } from "fs";

const entry = "src/js/warichu.ts";
const drops = ["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"];

const targets = ["bun", "browser", "node"];
const modes = [
  { name: "debug", minify: false, drop: [] },
  { name: "code",  minify: false, drop: drops },
  { name: "min",   minify: true,  drop: drops }
];

for (const target of targets) {
  for (const mode of modes) {
    const baseDir = `dist/js/${target}`;
    const common = { entrypoints: [entry], minify: mode.minify, drop: mode.drop as any[], target: target as any };

    // 1. ems (format: esm)
    const emsResult = await build({ ...common, format: "esm" });
    const emsCode = await emsResult.outputs[0].text();
    writeFileSync(`${baseDir}/ems/${mode.name}.js`, emsCode);

    // 2. no-esm (esmコードからexportを除去)
    // 末尾の export { Warichu as default }; 等のパターンを網羅して置換
    const noEsmCode = emsCode
      .replace(/export\s*\{[\s\S]*?\};?/g, "")
      .replace(/export\s+default\s+[\w$]+;?/g, "")
      .replace(/export\s+/g, "");
    writeFileSync(`${baseDir}/no-esm/${mode.name}.js`, noEsmCode);

    // 3. script (format: iife)
    const scriptResult = await build({ ...common, format: "iife" });
    const scriptCode = await scriptResult.outputs[0].text();
    writeFileSync(`${baseDir}/script/${mode.name}.js`, scriptCode);
  }
}

// CSS処理
const cssSrc = readFileSync("src/css/warichu.css", "utf-8");
writeFileSync("dist/css/code.css", cssSrc);
// 簡易ミニファイ（改行と余分な空白を削除）
const cssMin = cssSrc.replace(/\s+/g, " ").replace(/\/\*.*?\*\//g, "").replace(/ ?([\{\}\:\;\,]) ?/g, "$1").trim();
writeFileSync("dist/css/min.css", cssMin);
EOF

bun run build_process.ts
rm build_process.ts

# 不要な中間ファイル（もしあれば）の掃除
find dist/js -name "warichu.js" -delete

echo "Build complete. 27 JS patterns and 2 CSS patterns generated."

