/**
 * src/ts/min/warichu.ts
 * 実行性能を最優先し、責任の混在を許容した単一ファイル実装
 */

export class WarichuError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause ? { cause } : undefined);
    this.name = 'WarichuError';
  }
}

// ==========================================
// 型定義
// ==========================================

export interface WarichuSyntaxOptions {
  enclosers?: string | [string, string] | { open: string; close: string };
  separator?: string;
}
export interface WarichuBracketOptions {
  chars?: string | string[];
  copyable?: boolean;
  narrow?: boolean;
}
export interface WarichuSplitOptions {
  diff?: number;
  priority?: number;
}
export interface WarichuAlignOptions {
  start?: string;
  end?: string;
}
export interface WarichuOptions {
  syntax?: WarichuSyntaxOptions;
  brackets?: WarichuBracketOptions;
  split?: WarichuSplitOptions;
  align?: WarichuAlignOptions;
}

interface WarichuInternalOptions {
  syntax: { enclosers: { open: string; close: string }; separator: string };
  brackets: { chars: string[]; copyable: boolean; narrow: boolean };
  split: Required<WarichuSplitOptions>;
  align: Required<WarichuAlignOptions>;
}

const defaultOptions: WarichuInternalOptions = {
  syntax: { enclosers: { open: '〔', close: '〕' }, separator: '｜' },
  brackets: { chars: ['(', ')'], copyable: true, narrow: false },
  split: { diff: 1, priority: 1 },
  align: { start: 'start', end: 'start' }
};

const ALLOWED_PAIRS: Record<string, string> = {
  '(': ')', '[': ']', '{': '}', '<': '>',
  '（': '）', '［': '］', '｛': '｝', '＜': '＞',
  '〔': '〕', '〘': '〙', '〚': '〛',
  '【': '】', '〖': '〗',
  '『': '』', '「': '」',
  '〈': '〉', '《': '》',
  '“': '”', '‘': '’', '«': '»'
};

// ==========================================
// メインクラス
// ==========================================

export class Warichu {
  private _: { options: WarichuInternalOptions };

  constructor(options: WarichuOptions = {}) {
    this._ = { options: this.normalize(options) };
    this.validate();
  }

  private getSegments(text: string, granularity: 'grapheme' | 'word' = 'grapheme', lang: string = 'ja'): string[] {
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(lang, { granularity });
      return Array.from(segmenter.segment(text)).map(s => s.segment);
    }
    return granularity === 'grapheme' ? Array.from(text) :[];
  }

  private normalize(userOptions: WarichuOptions): WarichuInternalOptions {
    const merged: WarichuInternalOptions = {
      syntax: { ...defaultOptions.syntax, ...userOptions.syntax } as any,
      brackets: { ...defaultOptions.brackets, ...userOptions.brackets } as any,
      split: { ...defaultOptions.split, ...userOptions.split },
      align: { ...defaultOptions.align, ...userOptions.align }
    };

    if (userOptions.syntax?.enclosers) {
      const raw = userOptions.syntax.enclosers;
      let open = '', close = '';
      if (typeof raw === 'string') {
        const chars = this.getSegments(raw);
        open = chars[0] ?? '';
        close = chars[1] ?? '';
      } else if (Array.isArray(raw)) {
        open = raw[0] ?? '';
        close = raw[1] ?? '';
      } else {
        open = raw.open ?? '';
        close = raw.close ?? '';
      }
      merged.syntax.enclosers = { open, close };
    }

    if (userOptions.brackets?.chars) {
      const raw = userOptions.brackets.chars;
      merged.brackets.chars = typeof raw === 'string' ? this.getSegments(raw) : raw;
    }
    if (Array.isArray(merged.brackets.chars) && merged.brackets.chars.length === 0) {
      merged.brackets.chars =['', ''];
    }

    return merged;
  }

  private validate() {
    const { syntax, brackets, split, align } = this._.options;

    // 型チェックヘルパー (ユーザー入力由来の値の型が正しいか確認)
    const checkType = (key: string, value: unknown, expected: string) => {
      if (typeof value !== expected) {
        throw new WarichuError(`型が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${typeof value}`);
      }
    };

    // 値チェックヘルパー
    const checkValue = (key: string, value: unknown, isValid: boolean, expected: string) => {
      if (!isValid) {
        throw new WarichuError(`値が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${String(value)}`);
      }
    };

    // --- Syntax Validation ---
    const { open, close } = syntax.enclosers;
    const { separator } = syntax;

    if (!ALLOWED_PAIRS[open] || ALLOWED_PAIRS[open] !== close) {
      const allowed = Object.keys(ALLOWED_PAIRS).map(k => `${k}${ALLOWED_PAIRS[k]}`).join(', ');
      throw new WarichuError(`options.syntax.enclosers が不正です。許可されているペア: ${allowed} 実際値: ${open}${close}`);
    }

    const sepLen = this.getSegments(separator).length;
    checkValue('syntax.separator', separator, sepLen === 1, '1文字（書記素）');

    if (separator === open || separator === close) {
      throw new WarichuError(`options.syntax.separator は enclosers と異なる文字である必要があります: ${separator}`);
    }
    const hasControl = (s: string) => /[\p{C}]/u.test(s);
    if (hasControl(open) || hasControl(close) || hasControl(separator)) {
      throw new WarichuError('options.syntax に制御文字を含めることはできません。');
    }

    // --- Brackets Validation ---
    // 構造チェック(Array.isArray等)は normalize を信用して削除

    const c0 = this.getSegments(brackets.chars[0]).length;
    const c1 = this.getSegments(brackets.chars[1]).length;
    const totalLen = c0 + c1;
    checkValue(
      'brackets.chars', 
      brackets.chars, 
      c0===c1 && (totalLen === 0 || totalLen === 2), 
      '両方とも空文字、または両方とも1文字'
    );

    checkType('brackets.copyable', brackets.copyable, 'boolean');
    checkType('brackets.narrow', brackets.narrow, 'boolean');

    // --- Split Validation ---
    checkType('split.diff', split.diff, 'number');
    checkValue('split.diff', split.diff, Number.isInteger(split.diff) && split.diff >= 0, '0以上の整数');

    checkType('split.priority', split.priority, 'number');
    checkValue('split.priority', split.priority, [1, 2].includes(split.priority), '1 または 2');

    // --- Align Validation ---
    const validAligns =['start', 'end', 'center', 'justify'];
    checkType('align.start', align.start, 'string');
    checkValue('align.start', align.start, validAligns.includes(align.start), validAligns.join(', '));

    checkType('align.end', align.end, 'string');
    checkValue('align.end', align.end, validAligns.includes(align.end), validAligns.join(', '));
  }

  private getWordSplitIndex(content: string, totalLen: number): number | null {
    const { diff, priority } = this._.options.split;
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

  private getDefaultSplitIndex(totalLen: number): number {
    return Math.ceil(totalLen / 2);
  }

  private splitContent(content: string): [string, string] {
    const graphemes = this.getSegments(content, 'grapheme');
    const totalLen = graphemes.length;
    const splitChar = this._.options.syntax.separator;

    // skipハードコーディングパターン（実行性優先）
    let index = this.getExplicitSplitIndex(graphemes, splitChar);
    let skip = 1;

    if (index === null) {
      index = this.getWordSplitIndex(content, totalLen);
      skip = 0;
    }

    if (index === null) {
      index = this.getDefaultSplitIndex(totalLen);
      skip = 0;
    }

    return[
      graphemes.slice(0, index!).join(''),
      graphemes.slice(index! + skip).join('')
    ];
  }

  private generateHtml(startText: string, endText: string): string {
    const { brackets, align } = this._.options;
    const chars = brackets.chars;

    const copyAttr = brackets.copyable ? '' : ' aria-hidden="true" style="user-select: none; -webkit-user-select: none;"';
    const bracketClass = `warichu-bracket${brackets.narrow ? ' is-narrow' : ''}`;

    const bracketHtmls = chars.map(c => 
      c ? `<span class="${bracketClass}"${copyAttr}>${c}</span>` : ''
    );

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

  public parse(text: string): string {
    const { open, close } = this._.options.syntax.enclosers;
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`${escapeRegExp(open)}(.*?)${escapeRegExp(close)}`, 'g');

    return text.replace(pattern, (_, content) => {
      const [startStr, endStr] = this.splitContent(content);
      return this.generateHtml(startStr, endStr);
    });
  }
}
/*
// 難読化対策済みのグローバル登録
// @ts-ignore
if (typeof globalThis !== "undefined") { (globalThis as any)["Warichu"] = Warichu; }
// @ts-ignore
if (typeof window !== "undefined") { (window as any)["Warichu"] = Warichu; }
*/

// WarichuError を明示的に再エクスポート（Tree Shaking 対策）
//export { WarichuError };

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
