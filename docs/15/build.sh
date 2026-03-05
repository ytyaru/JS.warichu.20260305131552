#!/bin/bash
# 必要なディレクトリ構造をすべて作成（ems を esm に修正）
for t in bun browser node; do
  for f in esm no-esm script; do
    mkdir -p "dist/js/$t/$f"
  done
done
mkdir -p dist/css

# CSSのコピー
cp src/css/warichu.css dist/css/code.css

# 削除対象のconsoleメソッド
export CONSOLE_DROPS='["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

# ビルドプロセス実行
cat << 'EOF' > build_process.ts
import { build, Transpiler } from "bun";
import { writeFileSync, readFileSync } from "fs";

const entry = "src/js/warichu.ts";
const drops = JSON.parse(process.env.CONSOLE_DROPS!);

const transpiler = new Transpiler({
  loader: "ts",
  trimUnusedImports: true,
});

const targets = ["bun", "browser", "node"];
const modes = [
  { name: "debug", minify: false, drop: [] },
  { name: "code",  minify: false, drop: drops },
  { name: "min",   minify: true,  drop: drops }
];

for (const target of targets) {
  for (const mode of modes) {
    const baseDir = `dist/js/${target}`;
    const common = { 
      entrypoints: [entry], 
      minify: mode.minify, 
      drop: mode.drop as any[], 
      target: target as any 
    };

    // 1. esm (format: esm)
    const esmRes = await build({ ...common, format: "esm" });
    if (!esmRes.success) {
      console.error(esmRes.logs);
      process.exit(1);
    }
    const esmCode = await esmRes.outputs[0].text(); 
    writeFileSync(`${baseDir}/esm/${mode.name}.js`, esmCode);

    // 2. no-esm (Transpilerを使用して構文からexportを除去)
    let noEsmCode = transpiler.transformSync(esmCode, "js");
    noEsmCode = noEsmCode.replace(/export\s*\{[\s\S]*?\};?/g, "").replace(/export\s+default\s+[\w$]+;?/g, "").replace(/export\s+/g, "");
    writeFileSync(`${baseDir}/no-esm/${mode.name}.js`, noEsmCode);

    // 3. script (format: iife)
    const scriptRes = await build({ ...common, format: "iife" });
    if (!scriptRes.success) {
      console.error(scriptRes.logs);
      process.exit(1);
    }
    const scriptCode = await scriptRes.outputs[0].text();
    writeFileSync(`${baseDir}/script/${mode.name}.js`, scriptCode);
  }
}

// CSSのミニファイ
const cssSrc = readFileSync("src/css/warichu.css", "utf-8");
const cssMin = cssSrc.replace(/\s+/g, " ").replace(/\/\*.*?\*\//g, "").replace(/ ?([\{\}\:\;\,]) ?/g, "$1").trim();
writeFileSync("dist/css/min.css", cssMin);
EOF

bun run build_process.ts || exit 1
rm build_process.ts

# 原本ソースコード(TS)を1つだけ配布用にコピー
cp src/js/warichu.ts dist/js/bun/esm/warichu.ts

echo "ビルド完了：27パターンのJS（esm/no-esm/script）を正常に生成しました。"

