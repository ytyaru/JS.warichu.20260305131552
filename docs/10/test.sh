#!/bin/bash

# テスト前に必ず最新の状態にビルドする
echo "--- Step 0: 最新の成果物をビルド中... ---"
./build.sh || { echo "ビルドに失敗したためテストを中断します"; exit 1; }

# テストスクリプトのパス（./から始めることでフィルタではなくパスとして認識させる）
TEST_SCRIPT="./test/js/warichu.ts"

echo "=== 1. ソースコード(TS)の検証 ==="
export TEST_TARGET="./src/js/warichu.ts"
export FORMAT="ems"
bun test $TEST_SCRIPT || exit 1

echo "=== 2. ビルド済み全27ファイルの網羅検証 ==="
targets=("bun" "browser" "node")
formats=("ems" "no-esm" "script")
modes=("debug" "code" "min")

for t in "${targets[@]}"; do
  for f in "${formats[@]}"; do
    for m in "${modes[@]}"; do
      FILE_PATH="./dist/js/$t/$f/$m.js"
      
      if [ -f "$FILE_PATH" ]; then
        echo "検証中: $FILE_PATH"
        export TEST_TARGET="$FILE_PATH"
        export FORMAT="$f"
        # パス指定により .test なしのファイルでも実行可能
        bun test $TEST_SCRIPT || { echo "失敗: $FILE_PATH"; exit 1; }
      fi
    done
  done
done

echo "=== 全27パターンの検証が完了しました ==="
