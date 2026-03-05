// 割注: 〔割注の内容が二行で入ります〕、割注の内容が｜二行で入ります
export type PipeBehavior = 'throw' | 'warn' | Error | ((diff: number) => void);

export interface WarichuConfig {
  sign?: string;
  copyable?: boolean;
  align1?: string;
  align2?: string;
  narrowSign?: boolean;
  pipe?: PipeBehavior;
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
      pipe: 'warn',
      ...config
    };
    this.segmenterWord = new Intl.Segmenter('ja', { granularity: 'word' });
    this.segmenterGrapheme = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  }

  private getGraphemes(text: string): string[] {
    return Array.from(this.segmenterGrapheme.segment(text)).map(s => s.segment);
  }

  private _handlePipeError(diff: number) {
    const { pipe } = this.config;
    const message = `割注の字差が規定（1以内）を超えています（差: ${diff}）`;
    
    if (pipe === 'throw') throw new Error(message);
    if (pipe === 'warn') { console.warn(message); return; }
    if (pipe instanceof Error) throw pipe;
    if (typeof pipe === 'function') { pipe(diff); return; }
  }

  private _getSplitPoint(content: string): number {
    const graphemes = this.getGraphemes(content);
    const total = graphemes.length;
    
    // --- 工程1: 手動分割（｜） ---
    const pipeIndex = content.indexOf('｜');
    if (pipeIndex !== -1) {
      const line1 = content.slice(0, pipeIndex);
      const line2 = content.slice(pipeIndex + 1);
      const diff = Math.abs(this.getGraphemes(line1).length - this.getGraphemes(line2).length);
      
      if (diff <= 1) return pipeIndex;
      this._handlePipeError(diff);
      // エラーを投げない設定の場合は、パイプを除去した文字列で工程2以降へ
      return this._getSplitPoint(line1 + line2); 
    }

    // --- 工程2: Intl.Segmenter (word) ---
    // 整数演算で誤差を回避: |2 * prefixCount - total| <= 1 
    const segments = Array.from(this.segmenterWord.segment(content));
    for (const seg of segments) {
      if (seg.index === 0 || seg.index === content.length) continue;
      const prefixCount = this.getGraphemes(content.slice(0, seg.index)).length;
      if (Math.abs(2 * prefixCount - total) <= 1) {
        return seg.index;
      }
    }

    // --- 工程3: 物理中央分割（一行目優先） ---
    const splitPos = Math.ceil(total / 2);
    return graphemes.slice(0, splitPos).join('').length;
  }

  parse(text: string): string {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;

    return text.replace(regex, (_, content) => {
      const splitAt = this._getSplitPoint(content);
      // パイプが含まれている場合は除去して分割（_getSplitPoint内で除去済みテキストが渡されるケースも考慮）
      const cleanContent = content.replace('｜', '');
      const line1 = cleanContent.slice(0, splitAt);
      const line2 = cleanContent.slice(splitAt);

      const signs = sign ? Array.from(this.segmenterGrapheme.segment(sign)).map(s => s.segment) : [];
      const hasSign = signs.length >= 2;
      const copyAttr = copyable ? '' : ' aria-hidden="true" style="user-select:none;"';
      const bracketClass = `warichu-bracket${narrowSign ? ' is-narrow' : ''}`;

      const openTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[0]}</span>` : '';
      const closeTag = hasSign ? `<span class="${bracketClass}"${copyAttr}>${signs[1]}</span>` : '';

      return `<span class="warichu-container">${openTag}<span class="warichu-content">` +
             `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` +
             `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` +
             `</span>${closeTag}</span>`;
    });
  }
}
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any).Warichu = Warichu; }


