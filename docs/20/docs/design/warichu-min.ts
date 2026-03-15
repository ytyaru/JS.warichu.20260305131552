/**
 * src/ts/warichu.ts
 * 割注（Warichu）ライブラリ
 * 日本語組版の二段注釈をHTMLで実現する
 * 〔割注の内容が二行で入ります〕
 * 〔割注の内容が｜二行で入ります〕
 */
// カスタムエラークラス
export class WarichuError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WarichuError';
  }
}
// 型定義
export type ErrorBehavior = 
  | 'throw' 
  | 'warn' 
  | { new (message: string): Error } 
  | ((message: string) => boolean | void);

export interface WarichuSyntaxOptions {
  start?: string; // 割注の開始記号 (デフォルト: 〔)
  end?: string;   // 割注の終了記号 (デフォルト: 〕)
  split?: string; // 割注の分割記号 (デフォルト: ｜)
}

export interface WarichuBracketOptions {
  chars?: string | string[]; // 前後の括弧記号（例: '（）'）
  copyable?: boolean;        // 括弧をコピー可能にするか
  narrow?: boolean;          // 全角括弧を半角幅にするか
}
export interface WarichuSplitOptions {
  diff?: number;             // 自動分割で許容する最大字数差(0以上の正数)
  priority?: number;         // 等分不能な時一行目と二行目のどちらを長くするか(1か2)
}
export interface WarichuAlignOptions {
  start?: string;            // 開始行の配置(start,end,center,justify)
  end?: string;              // 開始行の配置(start,end,center,justify)
}
export interface WarichuOptions {
  syntax?: WarichuSyntaxOptions;    // 割注のメタ文字
  brackets?: WarichuBracketOptions; // 割注の前後にある記号
  split?: WarichuSplitOptions;      // 割注のテキスト分割位置
  align?: WarichuAlignOptions;      // 割注のテキスト配置
  error?: ErrorBehavior;            // エラー時の挙動
}
const defaultOptions: Required<WarichuOptions> = {
  syntax: { start: '〔', end: '〕', split: '｜' },
  brackets: { chars: ['(', ')'], copyable: true, narrow: false },
  split: { diff: 1, priority: 1 },
  align: { start: 'start', end: 'start' },
  error: 'throw'
};

export class Warichu {
  private _: { options: WarichuOptions };

  constructor(options: WarichuOptions = {}) {
    // オプションのマージ（簡易的なディープマージ）
    this._ = {
      options: {
        brackets: { ...defaultOptions.brackets, ...options.brackets },
        split: { ...defaultOptions.split, ...options.split },
        align: { ...defaultOptions.align, ...options.align },
        error: options.error ?? defaultOptions.error
      }
    };
    this.normalizeOptions();
    this.validateOption();
  }

  get options(): WarichuOptions {
    return JSON.parse(JSON.stringify(this._.options));
  }
  /**
   * オプションの正規化
   * バリデーションの前に、データの形式を扱いやすい形（配列）に整える
   */
  private normalizeOptions() {
    const { brackets } = this._.options;
    if (!brackets) return;

    // 1. string型なら配列に変換
    if (typeof brackets.chars === 'string') {
      brackets.chars = this.getSegments(brackets.chars);
    }

    // 2. 空文字('')や空配列([])として渡された場合、['', ''] に正規化する
    // これにより、バリデーションやgenerateHtmlでの扱いを容易にする
    if (Array.isArray(brackets.chars) && brackets.chars.length === 0) {
      brackets.chars = ['', ''];
    }
  }
  /**
   * オプションのバリデーション
   * normalizeOptions() の実行後に呼び出されることを前提とする
   */
  private validateOptions() {
    const { brackets, split, align, error } = this._.options;

    // 型チェックヘルパー
    const checkType = (key: string, value: unknown, expected: string) => {
      if (typeof value !== expected) {
        throw new WarichuError(`型が不正です。対象キー:${key} 期待値:${expected} 実際値:${typeof value}`);
      }
    };

    // 値チェックヘルパー
    const checkValue = (key: string, value: unknown, isValid: boolean, expected: string) => {
      if (!isValid) {
        throw new WarichuError(`値が不正です。対象キー:${key} 期待値:${expected} 実際値:${String(value)}`);
      }
    };

    // 1. brackets
    if (brackets) {
      const chars = brackets.chars;

      // 型チェック: normalizeOptions を経ても配列でない場合は、元の入力型が不正
      if (!Array.isArray(chars)) {
        throw new WarichuError(`型が不正です。対象キー:brackets.chars 期待値:string|string[] 実際値:${typeof chars}`);
      }

      // 要素数・各要素の型・各要素の文字数・合計文字数のチェック
      const isLen2 = chars.length === 2;
      const areStrings = isLen2 && typeof chars[0] === 'string' && typeof chars[1] === 'string';
      
      // 各要素の書記素数 (0 or 1 であるべき)
      const s0Len = areStrings ? this.getSegments(chars[0]).length : -1;
      const s1Len = areStrings ? this.getSegments(chars[1]).length : -1;
      const isEachLenValid = areStrings && (s0Len === 0 || s0Len === 1) && (s1Len === 0 || s1Len === 1);
      
      // 合計文字数 (0 または 2 であるべき。片方だけ 1文字 は禁止)
      const isTotalValid = areStrings && (s0Len + s1Len === 0 || s0Len + s1Len === 2);

      if (!isLen2 || !areStrings || !isEachLenValid || !isTotalValid) {
        throw new WarichuError(`値が不正です。対象キー:brackets.chars 期待値:空か2字('', '()', [], ['(',')'] 等) 実際値:${JSON.stringify(chars)}`);
      }

      if (brackets.copyable !== undefined) checkType('brackets.copyable', brackets.copyable, 'boolean');
      if (brackets.narrow !== undefined) checkType('brackets.narrow', brackets.narrow, 'boolean');
    }

    // 2. split
    if (split) {
      if (split.diff !== undefined) {
        checkType('split.diff', split.diff, 'number');
        checkValue('split.diff', split.diff, Number.isInteger(split.diff) && split.diff >= 0, '0以上の整数');
      }
      if (split.priority !== undefined) {
        checkType('split.priority', split.priority, 'number');
        checkValue('split.priority', split.priority, [1, 2].includes(split.priority), '1または2');
      }
    }

    // 3. align
    const validAligns = ['start', 'end', 'center', 'justify'];
    if (align) {
      if (align.start !== undefined) {
        checkType('align.start', align.start, 'string');
        checkValue('align.start', align.start, validAligns.includes(align.start!), validAligns.join(','));
      }
      if (align.end !== undefined) {
        checkType('align.end', align.end, 'string');
        checkValue('align.end', align.end, validAligns.includes(align.end!), validAligns.join(','));
      }
    }

    // 4. error
    if (error !== undefined) {
      const isString = typeof error === 'string';
      const isFunction = typeof error === 'function';
      const isErrorClass = isFunction && (error as any).prototype instanceof Error;
      
      const isValid = 
        (isString && (error === 'throw' || error === 'warn')) ||
        (isFunction && !isErrorClass) || 
        isErrorClass;

      if (!isValid) {
         throw new WarichuError(`値が不正です。対象キー:error 期待値:'throw','warn',任意Errorクラス,任意関数 実際値:${String(error)}`);
      }
    }
  }

  /**
   * エラーハンドリング
   */
  private handleError(message: string): void {
    const behavior = this._.option.error;

    if (behavior === 'throw') {
      throw new WarichuError(message);
    } else if (behavior === 'warn') {
      console.warn(`[Warichu] ${message}`);
    } else if (typeof behavior === 'function') {
      // クラス（コンストラクタ）か関数かの判定
      if (behavior.prototype && behavior.prototype instanceof Error) {
        // 例外クラスの場合
        const ErrorClass = behavior as new (msg: string) => Error;
        throw new ErrorClass(message);
      } else {
        // 任意関数の場合
        const shouldStop = (behavior as (msg: string) => boolean | void)(message);
        if (shouldStop === true) {
          throw new WarichuError(`中断されました: ${message}`);
        }
      }
    }
  }

  /**
   * テキストを指定された粒度で分割して文字列配列を取得する
   * Intl.Segmenter未対応環境の場合:
   * - grapheme: Array.fromでフォールバック
   * - word: 分割できないため空配列を返す（呼び出し元で処理をスキップさせる）
   */
  private getSegments(text: string, granularity: 'grapheme' | 'word' | 'sentence' = 'grapheme'): string[] {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter('ja', { granularity });
      return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    return granularity === 'grapheme' ? Array.from(text) : [];
  }

  /**
   * 分割位置の決定
   */
/*
  private getSplitPoint(text: string): number {
    const { diff = 1, priority = 1 } = this._.option.split!;
    
    // 1. 手動分割（｜）
    if (text.includes('｜')) {
      const parts = text.split('｜');
      if (parts.length > 2) {
        //this.handleError('割注にパイプ｜が複数あります。一個まで有効です。');
        this.throwError('割注にパイプ｜が複数あります。一個まで有効です。');
        // 継続の場合は最初のパイプを採用
        return parts[0].length; 
      }
      if (parts[0].length === 0 || parts[1].length === 0) {
        //this.handleError(`割注の片方の行が空です。: start:${parts[0]}, end:${parts[1]}`);
        this.throwError(`割注の片方の行が空です。: start:${parts[0]}, end:${parts[1]}`);
      }
      return parts[0].length;
    }

    //const graphemes = this.getGraphemes(text);
    //const graphemes = this.getSegments(text);
    //const totalLen = graphemes.length;
    const totalLen = this.getSegments(text).length;
    const idealCenter = totalLen / 2;

    // 2. Intl.Segmenterによる単語単位分割
    const wordSegments = this.getSegments(text, 'word');
    if (wordSegments.length > 0) {
      let bestSplitIndex = -1;
      let minDiff = Infinity;
      let currentLen = 0;

      for (const segment of wordSegments) {
        // 単語の長さを書記素単位で加算
        currentLen += this.getSegments(segment).length;
        
        // 行字差 = |(前半) - (後半)| = |currentLen - (totalLen - currentLen)| = |2*currentLen - totalLen|
        const currentDiff = Math.abs(2 * currentLen - totalLen);
        
        if (currentDiff <= diff) {
          // 許容範囲内なら、より中央に近いものを採用
          if (currentDiff < minDiff) {
            minDiff = currentDiff;
            bestSplitIndex = currentLen;
          }
        }
      }
      if (bestSplitIndex !== -1) {
        return bestSplitIndex;
      }
    }

    // 3. 中点分割（フォールバック）
    return Math.ceil(totalLen / 2);
    // priority 1: 一行目を長く (ceil), 2: 二行目を長く (floor)
    // 例: 5文字 -> 2.5 -> priority1: 3, priority2: 2
    //return priority === 1 ? Math.ceil(idealCenter) : Math.floor(idealCenter);

  }
*/
  /**
   * 割注のコンテンツを二行に分割する
   */
  private splitContent(content: string): [string, string] {
    const graphemes = this.getSegments(content, 'grapheme');
    const totalLen = graphemes.length;

    // 設定された分割記号を取得
    const splitChar = this.options.syntax!.split!;
    // 分割記号自体の長さ（書記素数）を計算しておく（通常は 1）
    const splitCharLen = this.getSegments(splitChar, 'grapheme').length;

    return Else.gotoEnd(
      [
        () => this.getExplicitSplitIndex(graphemes, splitChar),
        () => this.getWordSplitIndex(content, totalLen),
        () => this.getDefaultSplitIndex(totalLen)
      ],
      (index) => index !== null,
      (index, i) => {
        // パイプ分割（i === 0）の場合のみ、設定された記号の分だけスキップする
        const skip = i === 0 ? splitCharLen : 0;
        
        return [
          graphemes.slice(0, index!).join(''),
          graphemes.slice(index! + skip).join('')
        ];
      }
    );
  }

  /**
   * パイプ（分割記号）による分割位置を取得
   * @param splitChar 設定された分割記号
   */
  private getExplicitSplitIndex(graphemes: string[], splitChar: string): number | null {
    const index = graphemes.indexOf(splitChar);
    if (index === -1) return null;

    // バリデーション: 複数は禁止
    if (graphemes.indexOf(splitChar, index + 1) !== -1) {
      this.throwError(`割注に分割記号「${splitChar}」が複数あります。一個まで有効です。`);
    }

    // バリデーション: 端にある（片方が空になる）のは禁止
    if (index === 0 || index === graphemes.length - 1) {
      // エラーメッセージ用に文字列に戻す
      const start = graphemes.slice(0, index).join('');
      const end = graphemes.slice(index + 1).join('');
      this.throwError(`割注の片方の行が空です。: start:${start}, end:${end}`);
    }

    return index;
  }

  /**
   * 単語境界による分割位置を取得
   */
  private getWordSplitIndex(content: string, totalLen: number): number | null {
    const { diff = 1, priority = 1 } = this.options.split!;
    const wordSegments = this.getSegments(content, 'word');
    if (wordSegments.length <= 1) return null;

    let candidates: number[] =[];
    let currentLen = 0;
    for (let i = 0; i < wordSegments.length - 1; i++) {
      currentLen += this.getSegments(wordSegments[i], 'grapheme').length;
      const absDiff = Math.abs(2 * currentLen - totalLen);
      if (absDiff <= diff) candidates.push(currentLen);
    }

    if (candidates.length === 0) return null;

    const minAbsDiff = Math.min(...candidates.map(c => Math.abs(2 * c - totalLen)));
    const bestCandidates = candidates.filter(c => Math.abs(2 * c - totalLen) === minAbsDiff);

    return bestCandidates.length === 1 
      ? bestCandidates[0]
      : (priority === 1 
          ? bestCandidates.find(c => 2 * c >= totalLen)! 
          : bestCandidates.find(c => 2 * c < totalLen)!);
  }

  /**
   * デフォルトの中間分割位置を取得
   */
  private getDefaultSplitIndex(totalLen: number): number {
    return Math.ceil(totalLen / 2);
  }
  /**
   * HTML生成
   * normalizeOptions と validateOptions を経ているため、
   * brackets.chars は必ず string[] かつ length === 2 であることが保証されている
   */
  private generateHtml(startText: string, endText: string): string {
    const { brackets, align } = this._.options;
    
    // 1. 属性とクラスの準備
    const copyAttr = brackets?.copyable ? '' : ' aria-hidden="true" style="user-select: none; -webkit-user-select: none;"';
    const bracketClass = `warichu-bracket${brackets?.narrow ? ' is-narrow' : ''}`;

    // 2. 括弧のHTML生成
    // chars は必ず [string, string] なので、そのまま map で処理
    const bracketHtmls = (brackets!.chars as string[]).map(c => 
      c ? `<span class="${bracketClass}"${copyAttr}>${c}</span>` : ''
    );

    // 3. 本文のHTML生成 (DRY)
    const contentHtml = (['start', 'end'] as const).map(pos => {
      const text = pos === 'start' ? startText : endText;
      const style = `text-align-last: ${align?.[pos]};`;
      return `<span class="warichu-${pos}" style="${style}">${text}</span>`;
    }).join('');

    // 4. 組み立て
    return `<span class="warichu-container">` +
      bracketHtmls[0] +
      `<span class="warichu-content">${contentHtml}</span>` +
      bracketHtmls[1] +
    `</span>`;
  }
  /**
   * パース実行
   */
  public parse(text: string): string {
    const { start, end } = this.options.syntax!;
    
    // メタ文字のエスケープ（正規表現用）
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapeRegExp(start!)}(.*?)${escapeRegExp(end!)}`, 'g');

    return text.replace(pattern, (_, content) => {
      const [startStr, endStr] = this.splitContent(content);
      return this.generateHtml(startStr, endStr);
    });
  }
}
// 難読化対策済みのグローバル登録
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any)["Warichu"] = Warichu; }
// @ts-ignore
if (typeof window !== "undefined") { (window as any)["Warichu"] = Warichu; }
