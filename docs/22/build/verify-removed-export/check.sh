#!/bin/bash
# build/verify-removed-export/check.sh
# export 削除処理が正しく行われ、かつ末尾以外を破壊していないか検証する

BEFORE=$1
AFTER=$2

if [ ! -f "$BEFORE" ] || [ ! -f "$AFTER" ]; then
    echo "[Error] 検証対象のファイルが見つかりません。"
    exit 1
fi

# 1. 元のファイルの総行数を取得
TOTAL_LINES=$(wc -l < "$BEFORE")

# 2. 差分が発生した最初の行番号を取得
FIRST_DIFF_LINE=$(diff "$BEFORE" "$AFTER" | grep '^[0-9]' | head -n 1 | sed -E 's/([0-9]+).*/\1/')

# 3. 差分がない場合のエラー処理
if [ -z "$FIRST_DIFF_LINE" ]; then
    cat << EOF
[Error] 差分が検出されませんでした。
export 文の削除に失敗したか、あるいは元ファイルに export 文が存在しなかった可能性があります。

理由は以下のいずれかが考えられます。実装コードを確認してください。

* 渡されたファイルが間違っている（ESMコード(export有)と非ESMコード(export無)の比較になっているか）
    * build/build.ts: Builder.run() の実装を確認してください。
* export 削除処理自体に失敗している
    * build/processor.ts: Processor.removeExport() の正規表現を確認してください。
EOF
    exit 2
fi

# 4. 判定ロジック（末尾 5 行以内の変更なら合格）
SAFE_LIMIT=$((TOTAL_LINES - 5))

if [ "$FIRST_DIFF_LINE" -lt "$SAFE_LIMIT" ]; then
    cat << EOF
[Critical] 不正なコード破壊を検出しました！
ファイルの中間（${FIRST_DIFF_LINE}行目）で変更が発生しています。
意図しない箇所が正規表現によって削除された恐れがあります。

--- DIFF START ---
$(diff -u "$BEFORE" "$AFTER")
--- DIFF END ---
EOF
    exit 1
else
    echo "[Success] export 削除の安全性を確認しました。 (変更開始行: ${FIRST_DIFF_LINE}/${TOTAL_LINES})"
    exit 0
fi

