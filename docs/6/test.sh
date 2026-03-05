#!/bin/bash

echo "=== Starting Warichu Distribution Tests ==="

# JS 27パターンの検証
targets=("bun" "browser" "node")
formats=("ems" "no-esm" "script")
modes=("debug" "code" "min")

for t in "${targets[@]}"; do
  for f in "${formats[@]}"; do
    for m in "${modes[@]}"; do
      export TARGET_PATH="dist/js/$t/$f/$m.js"
      export MODE="$m"
      export FORMAT="$f"
      
      echo "Testing JS: $TARGET_PATH"
      # ファイル名を直接指定して実行
      bun test test/js/warichu.ts || exit 1
    done
  done
done

# CSSの検証
echo "Testing CSS: dist/css/code.css & min.css"
bun test test/css/warichu.ts || exit 1

echo "=== All 29 distribution files passed! ==="

