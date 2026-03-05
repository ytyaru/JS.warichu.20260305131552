// 割注: 〔割注の内容が二行で入ります〕、割注の内容が｜二行で入ります
export interface WarichuConfig {
  sign?: string;
  copyable?: boolean;
  align1?: string;
  align2?: string;
  narrowSign?: boolean;
}

export class Warichu {
  private config: Required<WarichuConfig>;
  private segmenterWord: Intl.Segmenter;
  private segmenterGrapheme: Intl.Segmenter;

  constructor(config: WarichuConfig = {}) {
    this.config = {
      sign: '（）',
      copyable: true,
      align1: 'justify',
      align2: 'justify',
      narrowSign: true,
      ...config
    };
    this.segmenterWord = new Intl.Segmenter('ja', { granularity: 'word' });
    this.segmenterGrapheme = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  }

  private getGraphemes(text: string): string[] {
    return Array.from(this.segmenterGrapheme.segment(text)).map(s => s.segment);
  }

  private _getAutoSplitPoint(content: string): number {
    const graphemes = this.getGraphemes(content);
    const totalCount = graphemes.length;
    const mid = totalCount / 2;
    const isEven = totalCount % 2 === 0;
    const allowedDiff = isEven ? 0 : 0.5;

    const segments = Array.from(this.segmenterWord.segment(content));
    let bestSplitIndex = -1;

    for (const seg of segments) {
      if (seg.index === 0 || seg.index === content.length) continue;
      
      // 分割点までの文字数をカウント
      const prefixCount = this.getGraphemes(content.slice(0, seg.index)).length;
      const diff = Math.abs(prefixCount - mid);

      if (diff === allowedDiff) {
        bestSplitIndex = seg.index;
        break; 
      }
    }

    // 条件を満たす分割点がない場合は単純二分割（1行目優先）
    if (bestSplitIndex === -1) {
      const splitPos = Math.ceil(totalCount / 2);
      return graphemes.slice(0, splitPos).join('').length;
    }
    return bestSplitIndex;
  }

  parse(text: string): string {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;

    return text.replace(regex, (_, content) => {
      let [line1, line2] = content.split('｜');

      if (line2 === undefined) {
        const splitAt = this._getAutoSplitPoint(content);
        line1 = content.slice(0, splitAt);
        line2 = content.slice(splitAt);
      }

      const signs = sign ? Array.from(this.segmenterGrapheme.segment(sign)).map(s => s.segment) : [];
      const hasSign = signs.length >= 2;
      const copyAttr = copyable ? '' : ' aria-hidden="true" style="user-select:none;"';
      const bracketClass = `warichu-bracket${narrowSign ? ' is-narrow' : ''}`;

      const openTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[0]}</span>` : '';
      const closeTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[1]}</span>` : '';

      return (
`<span class="warichu-container">` +
  `${openTag}` +
  `<span class="warichu-content">` +
    `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` +
    `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` +
  `</span>` +
  `${closeTag}` +
`</span>`);
    });
  }
}
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any).Warichu = Warichu; }
