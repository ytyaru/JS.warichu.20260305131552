#!/bin/bash

# 出力ディレクトリの作成
mkdir -p dist/css dist/js/debug dist/js/max dist/js/min

# CSSのコピー
cp src/css/warichu.css dist/css/warichu.css

# 削除対象のconsoleメソッドリスト（info,warn,errorのみ残す）
CONSOLE_DROPS='["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

# ビルドプロセス実行
cat << EOF > build_process.ts
import { build } from "bun";
import { readFileSync, writeFileSync } from "fs";

const entry = "src/js/warichu.ts";
const drops = ${CONSOLE_DROPS};

const specs = [
  // DEBUG (非ミニファイ＆console全残し)
  { dir: "dist/js/debug", minify: false, drop: [] },
  // MAX (非ミニファイ＆info, warn, error 以外削除)
  { dir: "dist/js/max",   minify: false, drop: drops },
  // MIN (ミニファイ＆info, warn, error 以外削除)
  { dir: "dist/js/min",   minify: true,  drop: drops },
];

for (const s of specs) {
  // 1. bun.js / bun.ts (ESM)
  await build({ entrypoints: [entry], outdir: s.dir, minify: s.minify, format: "esm", naming: "bun.js", target: "bun", drop: s.drop });
  await build({ entrypoints: [entry], outdir: s.dir, minify: s.minify, format: "esm", naming: "bun.ts", target: "bun", drop: s.drop });

  // 2. browser-module.js (ESM)
  await build({ entrypoints: [entry], outdir: s.dir, minify: s.minify, format: "esm", naming: "browser-module.js", target: "browser", drop: s.drop });

  // 3. browser-script.js (ESMからexportを削って作成)
  // iifeのオーバーヘッドを避けるため、一旦esmで出力してから加工
  const modPath = \`\${s.dir}/browser-module.js\`;
  const scriptPath = \`\${s.dir}/browser-script.js\`;
  let content = readFileSync(modPath, "utf-8");
  // export 構文を削除 (ESMの単純なexport class... 等を想定)
  content = content.replace(/export\s+\{.*?\};?/g, "").replace(/export\s+/g, "");
  writeFileSync(scriptPath, content);
}
EOF

bun run build_process.ts
rm build_process.ts

echo "Build complete. Distribution matches the specified structure."

