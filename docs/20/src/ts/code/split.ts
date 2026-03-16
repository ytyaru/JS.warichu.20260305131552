/**
 * src/ts/code/split.ts
 * 割注テキストの分割ロジックを担当するモジュール
 */
import { WarichuInternalOptions, WarichuError } from './types';
import { getSegments } from './utils/get-segments';
import { ErrorClass } from './utils/error-class';

// 汎用的な実装エラークラスを登録
export const { ImplementationError } = ErrorClass.make('ImplementationError');
//const _errs = ErrorClass.make('ImplementationError');
///** プログラムの実装ミスを示すエラー */
//export const ImplementationError = _errs.ImplementationError;

/** 分割位置情報の型定義 */
export type SplitPos = { index: number; skip: number };

/**
 * 戦略の実行結果を保持するクラス
 */
class WarichuSplitResult {
  private static readonly NONE = Symbol('WarichuSplitResult.NONE');
  private _value: SplitPos | symbol;

  constructor(index?: number, skip: number = 0) {
    this._value = (index !== undefined && Number.isInteger(index) && index >= 0)
      ? { index, skip }
      : WarichuSplitResult.NONE;
  }

  exist(): boolean {
    return this._value !== WarichuSplitResult.NONE;
  }

  get value(): SplitPos {
    return this._value as SplitPos;
  }
}

/**
 * 分割戦略の抽象基底クラス
 */
abstract class WarichuSplitStrategy {
  protected options: WarichuInternalOptions;
  constructor(options: WarichuInternalOptions) {
    this.options = options;
  }
  abstract calc(...args: any[]): WarichuSplitResult;
}

/**
 * 指定された分割記号（メタ文字）に基づく分割戦略
 */
class ExplicitSplitStrategy extends WarichuSplitStrategy {
  calc(graphemes: string[]): WarichuSplitResult {
    const separator = this.options.syntax.separator;
    const index = graphemes.indexOf(separator);

    if (index === -1) return new WarichuSplitResult();

    if (graphemes.indexOf(separator, index + 1) !== -1) {
      throw new WarichuError(`割注に分割記号「${separator}」が複数あります。一個まで有効です。`);
    }

    if (index === 0 || index === graphemes.length - 1) {
      throw new WarichuError(`割注の片方の行が空です。指定分割位置は先頭・末尾以外の箇所であるべきです。: index:${index} (${index === 0 ? '先頭' : '末尾'})`);
    }

    const skip = getSegments(separator).length;
    return new WarichuSplitResult(index, skip);
  }
}

/**
 * 単語境界に基づく分割戦略
 */
class SegmentSplitStrategy extends WarichuSplitStrategy {
  calc(content: string, totalLen: number): WarichuSplitResult {
    const { diff, priority } = this.options.split;
    const wordSegments = getSegments(content, 'word');
    if (wordSegments.length <= 1) return new WarichuSplitResult();

    const candidates: number[] = [];
    let currentLen = 0;

    for (let i = 0; i < wordSegments.length - 1; i++) {
      currentLen += getSegments(wordSegments[i], 'grapheme').length;
      const absDiff = Math.abs(2 * currentLen - totalLen);
      if (absDiff <= diff) candidates.push(currentLen);
    }

    if (candidates.length === 0) return new WarichuSplitResult();

    const minAbsDiff = Math.min(...candidates.map(c => Math.abs(2 * c - totalLen)));
    const bestCandidates = candidates.filter(c => Math.abs(2 * c - totalLen) === minAbsDiff);

    const index = bestCandidates.length === 1
      ? bestCandidates[0]
      : (priority === 1
        ? bestCandidates.find(c => 2 * c >= totalLen)!
        : bestCandidates.find(c => 2 * c < totalLen)!);

    return new WarichuSplitResult(index); // skipはデフォルト0
  }
}

/**
 * 二等分割する分割戦略。もし奇数なら一行目が1字だけ長くなる。必ず有効値を返す。
 * これは他の分割戦略で解決できなかった時に実行されることを期待する。
 */
class HalfSplitStrategy extends WarichuSplitStrategy {
  calc(totalLen: number): WarichuSplitResult {
    return new WarichuSplitResult(Math.ceil(totalLen / 2)); // skipはデフォルト0
  }
}

/**
 * 割注テキストの分割を統括するクラス
 */
export class WarichuSplitter {
  private _: {
    options: WarichuInternalOptions;
    strategies: WarichuSplitStrategy[];
  };

  constructor(options: WarichuInternalOptions) {
    this._ = {
      options,
      // 戦略クラスの配列をmapでインスタンス化 (DRY)
      strategies: [ExplicitSplitStrategy, SegmentSplitStrategy, HalfSplitStrategy]
        .map(StrategyClass => new StrategyClass(options))
    };
  }

  split(content: string): [string, string] {
    const graphemes = getSegments(content, 'grapheme');
    const totalLen = graphemes.length;

    // fallbackの結果をそのままtoTwinに渡す
    return this.toTwin(graphemes, this.fallback(content, graphemes, totalLen));
  }

  private makeArgs(content: string, graphemes: string[], totalLen: number): any[][] {
    return [
      [graphemes],
      [content, totalLen],
      [totalLen]
    ];
  }

  private fallback(content: string, graphemes: string[], totalLen: number, splitChar: string): SplitPos {
    const argsList = this.makeArgs(content, graphemes, totalLen, splitChar);
    
    for (let i = 0; i < this._.strategies.length; i++) {
      const res = this._.strategies[i].calc(...argsList[i]);
      if (res.exist()) return res.value as SplitPos;
    }

    throw new ImplementationError('実装エラー。実行されてはならないパスに到達しました。ソースコードの内容が間違っています。最後の分割戦略は必ず有効値を返すべきです。実行順序や実装内容を修正してください。');
  }

  private toTwin(graphemes: string[], pos: SplitPos): [string, string] {
    return [
      graphemes.slice(0, pos.index).join(''),
      graphemes.slice(pos.index + pos.skip).join('')
    ];
  }
}

