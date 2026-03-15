#!/bin/bash

# ログディレクトリの作成
mkdir -p test/log
ALL_LOG="test/log/all.txt"
ERR_LOG="test/log/error.txt"

# ログを初期化
> "$ALL_LOG"
> "$ERR_LOG"

# テスト前に最新の状態をビルド（タイポ修正済みの build.sh を実行）
echo "--- Step 0: 最新の成果物をビルド中... ---" | tee -a "$ALL_LOG"
./build.sh >> "$ALL_LOG" 2>&1 || { echo "ビルド失敗" | tee -a "$ERR_LOG"; exit 1; }

# テストスクリプトのパス（パス形式で指定）
TEST_SCRIPT="./test/js/warichu.ts"

echo "=== 1. ソースコード(TS)の検証 ===" | tee -a "$ALL_LOG"
export TEST_TARGET="./src/js/warichu.ts"
export FORMAT="esm"
export MODE="debug"
# 失敗した時だけ詳細を ERR_LOG にコピーして中断
bun test $TEST_SCRIPT >> "$ALL_LOG" 2>&1 || { tail -n 50 "$ALL_LOG" > "$ERR_LOG"; echo "TS検証失敗。詳細は $ERR_LOG を確認。"; exit 1; }

echo "=== 2. ビルド済み全27ファイルの網羅検証 ===" | tee -a "$ALL_LOG"
targets=("bun" "browser" "node")
formats=("esm" "no-esm" "script")
modes=("debug" "code" "min")

for t in "${targets[@]}"; do
  for f in "${formats[@]}"; do
    for m in "${modes[@]}"; do
      FILE_PATH="./dist/js/$t/$f/$m.js"
      if [ -f "$FILE_PATH" ]; then
        echo "検証中: $FILE_PATH" | tee -a "$ALL_LOG"
        export TEST_TARGET="$FILE_PATH"
        export FORMAT="$f"
        export MODE="$m"
        
        # 失敗時に最後のエラー内容を ERR_LOG に抽出して停止
        bun test $TEST_SCRIPT >> "$ALL_LOG" 2>&1 || {
          echo "FAILED: $FILE_PATH" | tee -a "$ERR_LOG"
          tail -n 50 "$ALL_LOG" >> "$ERR_LOG"
          echo "エラー発生。 $ERR_LOG を確認してください。"
          exit 1
        }
      fi
    done
  done
done

echo "=== 全27パターンの検証が完了しました ===" | tee -a "$ALL_LOG"

