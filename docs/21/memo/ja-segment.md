# Ja.segment / Ja.tokenize (将来の拡張用)

日本語テキストの多階層分割を単一インターフェースで提供する。

## 名前の検討: `segment` vs `tokenize`
- **`segment`**: 大きな意味ある塊（文／段落）に分けるニュアンス。
- **`tokenize`**: 文を最小単位（単語や助詞）に分けるニュアンス。
※ Unicode的にはサロゲートペアや合字などを一字としてカウントすべきなので「書記素」が最小単位となる。用途に合わせてメソッド名を分けるか、統一するかは要検討。

## 日本語における分割単位の考察
自然言語処理の観点を含めると、以下の単位が存在する。
1. 意味段落 / 2. 形式段落 / 3. 文 / 4. 係り受け / 5. 文節 / 6. 単語 / 7. 形態素 / 8. モーラ / 9. 書記素

**本APIの守備範囲:**
段落単位は文字量が多すぎるため別API（位置返却など）が適している。また、形態素（活用変化用）やモーラ（詩用）は用途が異なるため除外。
結果として、以下の5つをサポート対象とする。
- `sentence` (文)
- `dependency` (係り受け)
- `phrase` (文節)
- `word` (単語)
- `grapheme` (書記素)

## インターフェース案
`Ja.segment(text: string, granularity: Granularity = 'grapheme', engine: Engine = 'intl'): string[]`

- **Granularity**: `grapheme` | `word` | `phrase` | `dependency` | `sentence`
- **Engine**: `intl` | `budou-x` | `wakachigaki` | `tiny-segmenter` | `kuromoji` | `fallback`

## 実装イメージ（擬似コード）
```typescript
class Ja {
  public segment(text: string, granularity = 'grapheme', engine = ''): string[] {
    // 1. granularity='phrase'ならengine='budoux'にする。
    // 2. granularity='phrase'でengine!='budoux'なら、他のエンジンで文節区切りは多分不可能なので例外発生する。
    // 3. このように分割単位とエンジン実行可能性の組合せで実現可能是非をチェックする。
    // 4. もし所定のエンジンが存在しないなら自前実装にフォールバックする。
    // 5. もし自前実装に指定分割方法の実装がないなら例外発生する。
    // 6. 各種エンジンによる実行。
    // 7. 各種エンジンの結果を文字列配列に変換して返す。
  }
}
```

## 参照ライブラリ
- [Intl.Segmenter](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
- [BudouX](https://github.com/google/budoux) (Google: 文節分割)
- [wakachigaki](https://github.com/yuhsak/wakachigaki) (yuhsak: 形態素解析)
- [TinySegmenter](http://chasen.org/~taku/software/TinySegmenter/) (Taku Kudo: 軽量単語分割)
- [kuromoji.js](https://github.com/takuyaa/kuromoji.js/) (takuyaa: 辞書ベース解析)
