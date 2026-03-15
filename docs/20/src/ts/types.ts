/**
 * src/ts/types.ts
 */
import { ErrorClass } from './utils/error-class';

/**
 * 割注処理に関する汎用例外クラス
 * ErrorClass.make により動的に生成され、定数としてエクスポートされる
 */
export const { WarichuError } = ErrorClass.make('WarichuError');

/**
 * 割注処理に関する汎用エラー
 * 実行時には globalThis.WarichuError が使用される
 */
export declare class WarichuError extends Error {
  constructor(message: string, cause?: unknown);
}

// --- 定数: ホワイトリスト ---
/**
 * 構文として許可される囲み文字のペア
 */
export const ALLOWED_PAIRS: Record<string, string> = {
  '(': ')', '[': ']', '{': '}', '<': '>',
  '（': '）', '［': '］', '｛': '｝', '＜': '＞',
  '〔': '〕', '〘': '〙', '〚': '〛',
  '【': '】', '〖': '〗',
  '『': '』', '「': '」',
  '〈': '〉', '《': '》',
  '“': '”', '‘': '’', '«': '»'
};

// ==========================================
// ユーザー入力用オプション (Input Options)
// ==========================================

/**
 * 割注の構文設定オプション
 */
export interface WarichuSyntaxOptions {
  /**
   * 割注を囲む記号。
   * 文字列(2文字)、文字列配列(2要素)、またはオブジェクトで指定可能。
   * 例: `'()'`, `['<', '>']`, `{ open: '(', close: ')' }`
   * 内部的には `{ open: string, close: string }` に正規化される。
   */
  enclosers?: string | [string, string] | { open: string; close: string };
  
  /**
   * 割注の分割記号。
   * デフォルト: `'｜'`
   */
  separator?: string;
}

/**
 * 割注の装飾（括弧）設定オプション
 */
export interface WarichuBracketOptions {
  /**
   * 出力時に表示する前後の括弧記号。
   * 文字列(2文字) または 文字列配列(2要素) で指定。
   * 例: `'()'`
   */
  chars?: string | string[];
  
  /**
   * 括弧をテキストコピーの対象にするか。
   * false の場合、CSSで user-select: none が適用される。
   */
  copyable?: boolean;
  
  /**
   * 全角括弧を半角幅（0.5em）で表示するか。
   * true の場合、CSSクラス is-narrow が付与される。
   */
  narrow?: boolean;
}

/**
 * 割注の分割位置設定オプション
 */
export interface WarichuSplitOptions {
  /**
   * 自動分割（単語単位）で許容する最大字数差。
   * 0以上の整数を指定。デフォルト: 1
   */
  diff?: number;
  
  /**
   * 等分不能な時、一行目と二行目のどちらを長くするか。
   * 1: 一行目を長くする (デフォルト)
   * 2: 二行目を長くする
   */
  priority?: number;
}

/**
 * 割注のテキスト配置設定オプション
 */
export interface WarichuAlignOptions {
  /**
   * 開始行（上段/右段）の配置。
   * start, end, center, justify のいずれか。
   */
  start?: string;
  
  /**
   * 終了行（下段/左段）の配置。
   * start, end, center, justify のいずれか。
   */
  end?: string;
}

/**
 * Warichu クラスのコンストラクタに渡すオプション全体
 */
export interface WarichuOptions {
  /** 構文設定（メタ文字など） */
  syntax?: WarichuSyntaxOptions;
  /** 装飾設定（出力される括弧など） */
  brackets?: WarichuBracketOptions;
  /** 分割設定（自動分割の挙動など） */
  split?: WarichuSplitOptions;
  /** 配置設定（行揃えなど） */
  align?: WarichuAlignOptions;
}

// ==========================================
// 内部保持用オプション (Internal Options)
// ==========================================

/**
 * 構文設定（正規化後）
 */
export interface WarichuSyntax {
  /** 開始記号と終了記号のペア */
  enclosers: { open: string; close: string };
  /** 分割記号 */
  separator: string;
}

/**
 * 装飾設定（正規化後）
 */
export interface WarichuBrackets {
  /** 前後の括弧（必ず文字列配列） */
  chars: string[];
  copyable: boolean;
  narrow: boolean;
}

/**
 * 全体オプション（正規化後）
 * 全てのプロパティが確定し、必須化された状態
 */
export interface WarichuInternalOptions {
  syntax: WarichuSyntax;
  brackets: WarichuBrackets;
  split: Required<WarichuSplitOptions>;
  align: Required<WarichuAlignOptions>;
}

// デフォルト値
export const defaultOptions: WarichuInternalOptions = {
  syntax: { 
    enclosers: { open: '〔', close: '〕' }, 
    separator: '｜' 
  },
  brackets: { 
    chars: ['(', ')'], 
    copyable: true, 
    narrow: false 
  },
  split: { 
    diff: 1, 
    priority: 1 
  },
  align: { 
    start: 'start', 
    end: 'start' 
  }
};
