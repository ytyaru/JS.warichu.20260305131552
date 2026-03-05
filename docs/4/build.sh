#!/bin/bash
mkdir -p dist/css dist/js/debug dist/js/max dist/js/min
cp src/css/warichu.css dist/css/warichu.css

# 削除対象のリスト
CONSOLE_DROPS='["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"]'

# 'EOF' とすることで内部の ` をエスケープせず JS コードとして正しく解釈させます
cat << 'EOF' > build_process.ts
import { build, Transpiler } from "bun";
import { writeFileSync } from "fs";

const entry = "src/js/warichu.ts";
// 環境変数や引数を経由せず、ビルドスクリプト内で定義
const drops = ["console.assert","console.clear","console.count","console.countReset","console.debug","console.dir","console.dirxml","console.group","console.groupCollapsed","console.groupEnd","console.log","console.profile","console.profileEnd","console.table","console.time","console.timeEnd","console.timeLog","console.timeStamp","console.trace"];

const transpiler = new Transpiler({
  loader: "ts",
  trimUnusedImports: true,
});

const specs = [
  { dir: "dist/js/debug", minify: false, drop: [] },
  { dir: "dist/js/max",   minify: false, drop: drops },
  { dir: "dist/js/min",   minify: true,  drop: drops },
];

for (const s of specs) {
  // 共通ビルド
  const common = { entrypoints: [entry], outdir: s.dir, minify: s.minify, drop: s.drop as any[] };
  
  await build({ ...common, format: "iife", naming: "bun.js", target: "bun" });
  await build({ ...common, format: "esm", naming: "bun.ts", target: "bun" });
  await build({ ...common, format: "esm", naming: "browser-module.js", target: "browser" });

  // browser-script.js の生成とクリーンアップ
  const result = await build({ ...common, format: "esm", target: "browser" });
  if (result.outputs.length > 0) {
    let cleanCode = await result.outputs[0].text();
    // export 構文と末尾の export { Warichu }; を削除
    cleanCode = cleanCode.replace(/export\s*\{[\s\S]*?\};?/g, "").replace(/export\s+/g, "");
    writeFileSync(`${s.dir}/browser-script.js`, cleanCode);
  }
}
EOF

bun run build_process.ts
rm build_process.ts
echo "Build complete. (Debug/Max/Min directories validated)"
