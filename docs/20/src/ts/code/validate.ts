/**
 * src/ts/code/validate.ts
 * オプションの妥当性を検証するモジュール
 */
import { WarichuInternalOptions, ALLOWED_PAIRS, WarichuError } from './types';
import { getSegments } from './utils/get-segments';

// --- ヘルパー関数 ---

const checkType = (key: string, value: unknown, expected: string) => {
  if (typeof value !== expected) {
    throw new WarichuError(`型が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${typeof value}`);
  }
};

const checkValue = (key: string, value: unknown, isValid: boolean, expected: string) => {
  if (!isValid) {
    throw new WarichuError(`値が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${String(value)}`);
  }
};

// --- メインバリデーション関数 ---

/**
 * 正規化されたオプションの妥当性を検証する。
 * 不正な値が検出された場合は WarichuError を投げる。
 * 
 * @param options 正規化済みの内部オプション
 */
export function validate(options: WarichuInternalOptions): void {
  validateSyntax(options.syntax);
  validateBrackets(options.brackets);
  validateSplit(options.split);
  validateAlign(options.align);
}

// --- 各カテゴリのバリデーション ---

/**
 * 構文設定（メタ文字）の妥当性を検証する
 */
function validateSyntax(syntax: WarichuInternalOptions['syntax']): void {
  const { open, close } = syntax.enclosers;
  const { separator } = syntax;

  // 1. ホワイトリストチェック
  if (!ALLOWED_PAIRS[open] || ALLOWED_PAIRS[open] !== close) {
    const allowed = Object.keys(ALLOWED_PAIRS).map(k => `${k}${ALLOWED_PAIRS[k]}`).join(', ');
    throw new WarichuError(`options.syntax.enclosers が不正です。許可されているペア: ${allowed} 実際値: ${open}${close}`);
  }

  // 2. 分割記号の文字数チェック
  const sepLen = getSegments(separator).length;
  checkValue('syntax.separator', separator, sepLen === 1, '1文字（書記素）');

  // 3. 重複チェック
  if (separator === open || separator === close) {
    throw new WarichuError(`options.syntax.separator は enclosers と異なる文字である必要があります: ${separator}`);
  }

  // 4. 制御文字チェック
  const hasControl = (s: string) => /[\p{C}]/u.test(s);
  if (hasControl(open) || hasControl(close) || hasControl(separator)) {
    throw new WarichuError('options.syntax に制御文字を含めることはできません。');
  }
}

/**
 * 装飾設定（括弧）の妥当性を検証する
 */
function validateBrackets(brackets: WarichuInternalOptions['brackets']): void {
  // 文字数チェック (DRY化)
  const[c0, c1] = brackets.chars.map(c => getSegments(c).length);
  const totalLen = c0 + c1;
  
  checkValue(
    'brackets.chars', 
    brackets.chars, 
    c0 === c1 && (totalLen === 0 || totalLen === 2), 
    '両方とも空文字、または両方とも1文字'
  );

  checkType('brackets.copyable', brackets.copyable, 'boolean');
  checkType('brackets.narrow', brackets.narrow, 'boolean');
}

/**
 * 分割設定の妥当性を検証する
 */
function validateSplit(split: WarichuInternalOptions['split']): void {
  checkType('split.diff', split.diff, 'number');
  checkValue('split.diff', split.diff, Number.isInteger(split.diff) && split.diff >= 0, '0以上の整数');

  checkType('split.priority', split.priority, 'number');
  checkValue('split.priority', split.priority, [1, 2].includes(split.priority), '1 または 2');
}

/**
 * 配置設定の妥当性を検証する
 */
function validateAlign(align: WarichuInternalOptions['align']): void {
  const validAligns = ['start', 'end', 'center', 'justify'];
  
  // start と end のチェックを DRY 化
  (['start', 'end'] as const).forEach(pos => {
    checkType(`align.${pos}`, align[pos], 'string');
    checkValue(`align.${pos}`, align[pos], validAligns.includes(align[pos]), validAligns.join(', '));
  });
}
