/**
 * src/ts/code/main.ts
 * 割注ライブラリのメインエントリポイント
 */
import { WarichuOptions, WarichuInternalOptions } from './types';
import { normalize } from './normalize';
import { validate } from './validate';
import { WarichuSplitter } from './split';

/**
 * 割注（わりちゅう）を解析・変換するメインクラス
 */
export class Warichu {
  /** 内部保持用オプションと分割器のインスタンス */
  private _: {
    options: WarichuInternalOptions;
    splitter: WarichuSplitter;
  };

  /**
   * @param options ユーザー指定のオプション
   */
  constructor(options: WarichuOptions = {}) {
    // 1. オプションの正規化
    const normalized = normalize(options);
    // 2. オプションの妥当性検証
    validate(normalized);

    this._ = {
      options: normalized,
      splitter: new WarichuSplitter(normalized)
    };
  }

  /**
   * 現在設定されているオプションのディープコピーを取得する
   * @returns 正規化済みのオプションオブジェクト
   */
  get options(): WarichuOptions {
    return JSON.parse(JSON.stringify(this._.options));
  }

  /**
   * 簡易構文テキストを受け取り、割注をHTMLに変換した文字列を返却する
   * @param text 変換対象のテキスト
   * @returns HTML変換後のテキスト
   */
  public parse(text: string): string {
    const { open, close } = this._.options.syntax.enclosers;
    
    // 正規表現のメタ文字をエスケープ
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapeRegExp(open)}(.*?)${escapeRegExp(close)}`, 'g');

    return text.replace(pattern, (_, content) => {
      // 分割ロジックの実行
      const [startStr, endStr] = this._.splitter.split(content);
      // HTMLの生成
      return this.generateHtml(startStr, endStr);
    });
  }

  /**
   * 分割されたテキストから割注のHTML構造を生成する
   * @param startText 一行目（開始行）のテキスト
   * @param endText 二行目（終了行）のテキスト
   * @returns 割注のHTML文字列
   */
  private generateHtml(startText: string, endText: string): string {
    const { brackets, align } = this._.options;

    // 属性とクラスの準備
    const copyAttr = brackets.copyable ? '' : ' aria-hidden="true" style="user-select: none; -webkit-user-select: none;"';
    const bracketClass = `warichu-bracket${brackets.narrow ? ' is-narrow' : ''}`;

    // 括弧のHTML生成
    const bracketHtmls = brackets.chars.map(c =>
      c ? `<span class="${bracketClass}"${copyAttr}>${c}</span>` : ''
    );

    // 本文（二行）のHTML生成
    const contentHtml = (['start', 'end'] as const).map(pos => {
      const text = pos === 'start' ? startText : endText;
      const style = `text-align-last: ${align[pos]};`;
      return `<span class="warichu-${pos}" style="${style}">${text}</span>`;
    }).join('');

    return `<span class="warichu-container">` +
      bracketHtmls[0] +
      `<span class="warichu-content">${contentHtml}</span>` +
      bracketHtmls[1] +
    `</span>`;
  }
}
// 難読化対策済みのグローバル登録
// @ts-ignore
if (typeof globalThis !== "undefined") { 
  (globalThis as any)["Warichu"] = Warichu; 
  (globalThis as any)["WarichuError"] = WarichuError; 
}
// @ts-ignore
if (typeof window !== "undefined") { 
  (window as any)["Warichu"] = Warichu; 
  (window as any)["WarichuError"] = WarichuError; 
}
// WarichuError を明示的に再エクスポート（Tree Shaking 対策）
//export { WarichuError };
export { WarichuError } from './types';
