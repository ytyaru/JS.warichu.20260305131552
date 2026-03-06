#!/bin/bash

# 1. ディレクトリ構造の作成
for t in bun browser node; do
  for f in esm no-esm iife; do
    mkdir -p "dist/js/$t/$f"
  done
done
mkdir -p dist/css
mkdir -p dist/ts/bun/esm # TSソース用のディレクトリを追加

# 2. CSSの基本コピー
cp src/css/warichu.css dist/css/code.css

# 3. 削除対象のconsoleメソッド定義
export CONSOLE_DROPS='["console.debug","console.log","console.assert","console.clear","console.count","console.countReset","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

# 4. ビルドプロセス実行（一時的なTSファイルを作成して実行）
cat << 'EOF' > build_process.ts
import { build, Transpiler } from "bun";
import { writeFileSync, readFileSync } from "node:fs";

const entry = "src/ts/warichu.ts";
const drops = JSON.parse(process.env.CONSOLE_DROPS!);

const targets = ["bun", "browser", "node"] as const;
const releases = [
  { name: "debug", minify: false, drop: [] },
  { name: "code",  minify: false, drop: drops },
  { name: "min",   minify: true,  drop: drops }
];

for (const target of targets) {
  for (const release of releases) {
    const baseDir = `dist/js/${target}`;
    const common = { 
      entrypoints: [entry], 
      minify: release.minify, 
      drop: release.drop as any[], 
      target: target as any 
    };

    // --- A. ESM ビルド ---
    const esmRes = await build({ ...common, format: "esm" });
    if (!esmRes.success) throw new Error(esmRes.logs.join("\n"));
    const esmCode = await esmRes.outputs[0].text(); 
    writeFileSync(`${baseDir}/esm/${release.name}.js`, esmCode);

    // --- B. NO-ESM ビルド ---
    // ミニファイ前のコードから export を除去するために、別途非ミニファイでビルド
    const noEsmBaseRes = await build({ ...common, format: "esm", minify: false });
    let noEsmCode = await noEsmBaseRes.outputs[0].text();
    
    // 構文木を意識した export 除去（行頭の export class や末尾の export { ... } を対象）
    noEsmCode = noEsmCode
      .replace(/^export\s+(class|const|let|var|function|type|interface)\s+/gm, "$1 ")
      .replace(/\nexport\s*\{[\s\S]*?\};?\s*$/g, "");

    // release.name が min の場合は、export 除去後のコードを再度トランスパイルしてミニファイ
    if (release.minify) {
      const transpiler = new Transpiler({ minify: true });
      noEsmCode = transpiler.transformSync(noEsmCode);
    }
    writeFileSync(`${baseDir}/no-esm/${release.name}.js`, noEsmCode);

    // --- C. IIFE ビルド ---
    const iifeRes = await build({ ...common, format: "iife" });
    if (!iifeRes.success) throw new Error(iifeRes.logs.join("\n"));
    const iifeCode = await iifeRes.outputs[0].text();
    writeFileSync(`${baseDir}/iife/${release.name}.js`, iifeCode);
  }
}

// CSSのミニファイ
const cssSrc = readFileSync("src/css/warichu.css", "utf-8");
const cssMin = cssSrc
  .replace(/\/\*[\s\S]*?\*\//g, "") // コメント削除
  .replace(/\s+/g, " ")             // 空白集約
  .replace(/\s*([\{\}\:\;\,])\s*/g, "$1") // 記号周りの空白削除
  .trim();
writeFileSync("dist/css/min.css", cssMin);
EOF

# ビルド実行
bun run build_process.ts || exit 1
rm build_process.ts

# 5. 原本ソースコード(TS)を配布用にコピー
cp src/ts/warichu.ts dist/ts/bun/esm/source.ts

echo "ビルド完了：27パターンのJS（esm/no-esm/iife）とCSSを生成しました。"

