/**
 * src/ts/code/validate.ts
 * オプションの妥当性を検証するモジュール
 */
import { WarichuInternalOptions, ALLOWED_PAIRS, WarichuError } from './types';
import { getSegments } from './utils/get-segments';

// --- 内部ヘルパー関数 ---

/**
 * エラーメッセージを生成する
 * @param type エラーの種類（'型' | '値'）
 * @param key オプションのキー名
 * @param expected 期待値の説明
 * @param actual 実際値
 * @returns WarichuError インスタンス
 */
const createError = (type: '型' | '値', key: string, expected: string, actual: string) => {
  return new WarichuError(`${type}が不正です。対象キー: options.${key} 期待値: ${expected} 実際値: ${actual}`);
};

/**
 * 型と値を一括で検証する
 * @param key オプションのキー名
 * @param value 検証する値
 * @param expectedType 期待される型（typeof の戻り値）
 * @param condition 値の妥当性条件（任意）
 * @param expectedValueMsg 値が不正な場合の期待値説明（condition指定時は必須）
 */
const assertValid = (
  key: string,
  value: unknown,
  expectedType: string,
  condition?: boolean,
  expectedValueMsg?: string
) => {
  // 1. 型チェック
  if (typeof value !== expectedType) {
    throw createError('型', key, expectedType, typeof value);
  }

  // 2. 値チェック（条件が指定されている場合のみ）
  if (condition !== undefined && !condition) {
    throw createError('値', key, expectedValueMsg!, String(value));
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

  // 1. ホワイトリストチェック（複合ルールのた​​め if 文で記述）
  if (!ALLOWED_PAIRS[open] || ALLOWED_PAIRS[open] !== close) {
    const allowed = Object.keys(ALLOWED_PAIRS).map(k => `${k}${ALLOWED_PAIRS[k]}`).join(', ');
    throw createError('値', 'syntax.enclosers', `許可されているペア(${allowed})`, `${open}${close}`);
  }

  // 2. 分割記号の検証
  const sepLen = getSegments(separator).length;
  assertValid('syntax.separator', separator, 'string', sepLen === 1, '1文字（書記素）');

  // 3. 重複チェック
  if (separator === open || separator === close) {
    throw new WarichuError(`options.syntax.separator は enclosers と異なる文字である必要があります: ${separator}`);
  }

  // 4. 制御文字チェック (\p{C})
  const hasControl = (s: string) => /[\p{C}]/u.test(s);
  if (hasControl(open) || hasControl(close) || hasControl(separator)) {
    throw new WarichuError('options.syntax に制御文字を含めることはできません。');
  }
}

/**
 * 装飾設定（括弧）の妥当性を検証する
 */
function validateBrackets(brackets: WarichuInternalOptions['brackets']): void {
  const [c0, c1] = brackets.chars.map(c => getSegments(c).length);
  const totalLen = c0 + c1;

  // 文字数と対称性の検証
  assertValid(
    'brackets.chars',
    brackets.chars,
    'object', // Array は typeof で 'object'
    c0 === c1 && (totalLen === 0 || totalLen === 2),
    '両方とも空文字、または両方とも1文字'
  );

  assertValid('brackets.copyable', brackets.copyable, 'boolean');
  assertValid('brackets.narrow', brackets.narrow, 'boolean');
}

/**
 * 分割設定の妥当性を検証する
 */
function validateSplit(split: WarichuInternalOptions['split']): void {
  assertValid('split.diff', split.diff, 'number', Number.isInteger(split.diff) && split.diff >= 0, '0以上の整数');
  assertValid('split.priority', split.priority, 'number', [1, 2].includes(split.priority), '1 または 2');
}

/**
 * 配置設定の妥当性を検証する
 */
function validateAlign(align: WarichuInternalOptions['align']): void {
  const validAligns = ['start', 'end', 'center', 'justify'];

  (['start', 'end'] as const).forEach(pos => {
    assertValid(`align.${pos}`, align[pos], 'string', validAligns.includes(align[pos]), validAligns.join(', '));
  });
}

