// 割注: 〔割注の内容が二行で入ります〕、割注の内容が｜二行で入ります
export type PipeBehavior = 'throw' | 'warn' | Error | ((message: string) => void);

export interface WarichuConfig {
  sign?: string;
  copyable?: boolean;
  align1?: string;
  align2?: string;
  narrowSign?: boolean;
  pipe?: PipeBehavior;
  diff?: number; // 許容する字数差（デフォルト1）
}

export class Warichu {
  private config: Required<WarichuConfig>;
  private segmenterWord: Intl.Segmenter;
  private segmenterGrapheme: Intl.Segmenter;

  constructor(config: WarichuConfig = {}) {
    // constructor 内
    this.config = {
      sign: '（）',
      copyable: true,
      align1: 'start', // 青空文庫準拠のデフォルト
      align2: 'start', 
      narrowSign: true,
      pipe: 'warn',
      diff: 1, // デフォルト
      ...config
    };
    this.segmenterWord = new Intl.Segmenter('ja', { granularity: 'word' });
    this.segmenterGrapheme = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  }

  private getGraphemes(text: string): string[] {
    return Array.from(this.segmenterGrapheme.segment(text)).map(s => s.segment);
  }

  private _handleError(message: string) {
    const { pipe } = this.config;
    if (pipe === 'throw') throw new Error(message);
    if (pipe === 'warn') { console.warn(message); return; }
    if (pipe instanceof Error) throw pipe;
    if (typeof pipe === 'function') { pipe(message); return; }
  }

    private _getSplitPoint(content: string): number {
      const graphemes = this.getGraphemes(content);
      const total = graphemes.length;
      const { diff, pipe } = this.config;

      // バリデーション: 合計2文字未満はエラー
      if (total < 2) {
        this._handleError("割注は合計2文字以上必要です。");
        return total; // 変換せず返すためのインデックス
      }

      // 1. 手動分割
      const pipeIndex = content.indexOf('｜');
      if (pipeIndex !== -1) {
        const l1 = this.getGraphemes(content.slice(0, pipeIndex)).length;
        const l2 = total - l1;
        

    if (l1 > 0 && l2 > 0) return pipeIndex;
        this._handleError("手動分割の片方の行が空です。");
        return this._getSplitPoint(content.replace('｜', '')); // 再起的に自動分割へ
      }

      // 2. 自動分割 (config.diff 以内)
      const segments = Array.from(this.segmenterWord.segment(content));
      for (const seg of segments) {
        if (seg.index === 0 || seg.index === content.length) continue;
        const prefix = this.getGraphemes(content.slice(0, seg.index)).length;
        const suffix = total - prefix;
        if (prefix > 0 && suffix > 0 && Math.abs(prefix - suffix) <= diff) {
          return seg.index;
        }
      }

      // 3. 物理分割
      const splitPos = Math.ceil(total / 2);
      return graphemes.slice(0, splitPos).join('').length;
    }


  parse(text: string): string {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;

    return text.replace(regex, (_, content) => {
      const splitAt = this._getSplitPoint(content);
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

// Minify対策済みのグローバル登録
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any)["Warichu"] = Warichu; }
// @ts-ignore
if (typeof window !== "undefined") { (window as any)["Warichu"] = Warichu; }
