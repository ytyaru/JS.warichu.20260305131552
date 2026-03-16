/**
 * src/ts/normalize.ts
 * オプションの正規化ロジック
 */
import { 
  WarichuOptions, 
  WarichuInternalOptions, 
  WarichuSyntax, 
  WarichuBracketOptions,
  WarichuSyntaxOptions,
  defaultOptions 
} from './types';
import { getSegments } from './utils/get-segments';

/**
 * ユーザーオプションを正規化し、内部用の厳密な型に変換する
 * @param userOptions ユーザーから渡されたオプション
 * @returns 正規化された内部用オプション
 */
export function normalize(userOptions: WarichuOptions = {}): WarichuInternalOptions {
  return {
    syntax: normalizeSyntax(userOptions.syntax),
    brackets: normalizeBrackets(userOptions.brackets),
    split: { ...defaultOptions.split, ...userOptions.split },
    align: { ...defaultOptions.align, ...userOptions.align }
  };
}

/**
 * Syntax オプションの正規化
 * @param userSyntax ユーザー指定の構文オプション
 * @returns 正規化された構文設定
 */
function normalizeSyntax(userSyntax: WarichuSyntaxOptions | undefined): WarichuSyntax {
  if (!userSyntax) {
    return { ...defaultOptions.syntax };
  }

  return {
    enclosers: normalizeEnclosers(userSyntax.enclosers),
    separator: userSyntax.separator ?? defaultOptions.syntax.separator
  };
}

/**
 * Enclosers の正規化
 * 文字列、配列、オブジェクトのいずれかを { open, close } に統一する
 * @param raw ユーザー指定の enclosers
 * @returns 正規化された { open, close }
 */
function normalizeEnclosers(
  raw: string | [string, string] | { open: string; close: string } | undefined
): { open: string; close: string } {
  if (raw === undefined) {
    return { ...defaultOptions.syntax.enclosers };
  }

  if (typeof raw === 'string') {
    const chars = getSegments(raw);
    return {
      open: chars[0] ?? '',
      close: chars[1] ?? ''
    };
  }

  if (Array.isArray(raw)) {
    return {
      open: raw[0] ?? '',
      close: raw[1] ?? ''
    };
  }

  return {
    open: raw.open ?? '',
    close: raw.close ?? ''
  };
}

/**
 * Brackets オプションの正規化
 * @param userBrackets ユーザー指定の装飾オプション
 * @returns 正規化された装飾設定
 */
function normalizeBrackets(userBrackets: WarichuBracketOptions | undefined) {
  if (!userBrackets) {
    return { ...defaultOptions.brackets };
  }

  return {
    chars: normalizeChars(userBrackets.chars),
    copyable: userBrackets.copyable ?? defaultOptions.brackets.copyable,
    narrow: userBrackets.narrow ?? defaultOptions.brackets.narrow
  };
}

/**
 * Brackets.chars の正規化
 * 文字列または配列を string[] に統一する
 * @param raw ユーザー指定の chars
 * @returns 正規化された string[]
 */
function normalizeChars(raw: string | string[] | undefined): string[] {
  if (raw === undefined) {
    return [...defaultOptions.brackets.chars];
  }

  let chars: string[];
  if (typeof raw === 'string') {
    chars = getSegments(raw);
  } else {
    chars = raw;
  }

  return chars.length === 0 ? ['', ''] : chars;
}
