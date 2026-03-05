/**
 * 割注（Warichu）ライブラリ
 * 日本語組版の二段注釈をHTMLで実現する
 * 〔割注の内容が二行で入ります〕
 * 〔割注の内容が｜二行で入ります〕
 */
export class WarichuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WarichuError';
  }
}

export type ErrorBehavior = 

  | 'throw' 
  | 'warn' 
  | { new (message: string): Error } 

  | ((message: string) => boolean | void);

export interface WarichuConfig {
  sign?: string;        // 前後の括弧記号（例: '（）'）
  copyable?: boolean;   // 括弧をコピー可能にするか
  align1?: string;      // 一行目の揃え（デフォルト: start）
  align2?: string;      // 二行目の揃え（デフォルト: start）
  narrowSign?: boolean; // 全角括弧を半角幅にするか
  error?: ErrorBehavior; // エラー時の挙動
  diff?: number;        // 自動分割で許容する最大字数差（デフォルト1）
}

export class Warichu {
  private config: Required<WarichuConfig>;
  private segmenterWord: Intl.Segmenter;
  private segmenterGrapheme: Intl.Segmenter;

  constructor(config: WarichuConfig = {}) {
    this.config = {
      sign: '（）',
      copyable: true,
      align1: 'start',
      align2: 'start',
      narrowSign: true,
      error: 'warn',
      diff: 1,
      ...config
    };
    this.segmenterWord = new Intl.Segmenter('ja', { granularity: 'word' });
    this.segmenterGrapheme = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  }

  private getGraphemes(text: string): string[] {
    return Array.from(this.segmenterGrapheme.segment(text)).map(s => s.segment);
  }

  private _handleError(message: string): boolean {
    const { error } = this.config;
    if (error === 'throw') throw new WarichuError(message);
    if (error === 'warn') { console.warn(`[Warichu] ${message}`); return false; }
    if (typeof error === 'function') {
      if (error.prototype instanceof Error) {
        const ErrorClass = error as { new (msg: string): Error };
        throw new ErrorClass(message);
      }
      return (error as (msg: string) => boolean | void)(message) === true;
    }
    return false;
  }

  private _getSplitPoint(content: string): number {
    const graphemes = this.getGraphemes(content);
    const total = graphemes.length;
    const { diff } = this.config;

    // バリデーション: 2文字未満は割注として成立しない
    if (total < 2) {
      if (this._handleError(`割注は合計2文字以上必要です: "${content}"`)) return total;
    }

    // 1. 手動分割（｜）
    const pipeIndex = content.indexOf('｜');
    if (pipeIndex !== -1) {
      const l1 = this.getGraphemes(content.slice(0, pipeIndex)).length;
      const l2 = total - 1 - l1; // パイプ自身を除いた二行目の数
      if (l1 > 0 && l2 > 0) return pipeIndex;
      if (this._handleError("割注の片方の行が空です。")) return total;
      // 続行なら｜を消して自動分割へ
      return this._getSplitPoint(content.replace('｜', ''));
    }

    // 2. 自動分割 (Intl.Segmenter: word)
    const segments = Array.from(this.segmenterWord.segment(content));
    for (const seg of segments) {
      if (seg.index === 0 || seg.index === content.length) continue;
      const prefixCount = this.getGraphemes(content.slice(0, seg.index)).length;
      const suffixCount = total - prefixCount;
      // 整数演算で字差チェック
      if (prefixCount > 0 && suffixCount > 0 && Math.abs(prefixCount - suffixCount) <= diff) {
        return seg.index;
      }
    }

    // 3. 物理中央分割（一行目優先）
    const splitPos = Math.ceil(total / 2);
    return graphemes.slice(0, splitPos).join('').length;
  }

  parse(text: string): string {
    const { sign, copyable, align1, align2, narrowSign } = this.config;
    const regex = /〔(.+?)〕/g;

    return text.replace(regex, (_, rawContent) => {
      const splitAt = this._getSplitPoint(rawContent);
      // 分割位置が決まった後、不要なパイプを除去して文字列を生成
      const content = rawContent.replace('｜', '');
      const line1 = content.slice(0, splitAt);
      const line2 = content.slice(splitAt);

      const signs = sign ? Array.from(this.segmenterGrapheme.segment(sign)).map(s => s.segment) : [];
      const hasSign = signs.length >= 2;
      const copyAttr = copyable ? '' : ' aria-hidden="true" style="user-select:none;"';
      const bCls = `warichu-bracket${narrowSign ? ' is-narrow' : ''}`;

      const open = hasSign ? `<span class="${bCls}"${copyAttr}>${signs[0]}</span>` : '';
      const close = hasSign ? `<span class="${bCls}"${copyAttr}>${signs[1]}</span>` : '';

      return `<span class="warichu-container">${open}<span class="warichu-content">` +
             `<span class="warichu-line1" style="text-align-last: ${align1};">${line1}</span>` +
             `<span class="warichu-line2" style="text-align-last: ${align2};">${line2}</span>` +
             `</span>${close}</span>`;
    });
  }
}

// 難読化対策済みのグローバル登録
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any)["Warichu"] = Warichu; }
// @ts-ignore
if (typeof window !== "undefined") { (window as any)["Warichu"] = Warichu; }
