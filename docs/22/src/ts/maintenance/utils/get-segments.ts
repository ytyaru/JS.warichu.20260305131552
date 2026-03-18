/**
 * src/ts/utils/get-segments.ts
 */

/**
 * テキストを指定された粒度で分割して文字列配列を取得する。
 * Intl.Segmenter 未対応環境の場合は grapheme 単位のみ Array.from でフォールバックする。
 * 
 * @param text 分割対象のテキスト
 * @param granularity 分割単位 ('grapheme' | 'word' | 'sentence')
 * @param lang 言語コード (デフォルト: 'ja')
 * @returns 分割された文字列の配列
 */
export function getSegments(
  text: string, 
  granularity: 'grapheme' | 'word' | 'sentence' = 'grapheme', 
  lang: string = 'ja'
): string[] {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter(lang, { granularity });
    return Array.from(segmenter.segment(text)).map(s => s.segment);
  }
  // フォールバック: grapheme以外は分割不能なため空配列を返す
  return granularity === 'grapheme' ? Array.from(text) : [];
}

