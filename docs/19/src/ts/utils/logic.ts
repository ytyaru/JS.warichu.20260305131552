/**
 * src/ts/util/logic.ts
 */
export class Logic {
  static readonly ALL_THROUGH = Symbol('ALL_THROUGH');

  // --- fallback の型定義 ---
  static fallback<T, R>(
    strategies: (() => T)[],
    isSuccess: (res: T, index: number) => boolean,
    processor: (res: T, index: number, strategy: () => T) => R
  ): R;
  static fallback<T, R>(
    strategies: (() => T)[],
    keys: string[],
    isSuccess: (res: any, index: number) => boolean,
    processor: (res: any, index: number, strategy: () => T) => R
  ): R;
  static fallback<T, R>(...args: any[]): R {
    return this._execute(args, true) as R;
  }

  // --- through の型定義 ---
  static through<T, R>(
    strategies: (() => T)[],
    isSuccess: (res: T, index: number) => boolean,
    processor: (res: T, index: number, strategy: () => T) => R
  ): R | symbol;
  static through<T, R>(
    strategies: (() => T)[],
    keys: string[],
    isSuccess: (res: any, index: number) => boolean,
    processor: (res: any, index: number, strategy: () => T) => R
  ): R | symbol;
  static through<T, R>(...args: any[]): R | symbol {
    return this._execute(args, false);
  }

  // --- throw の型定義 ---
  static throw<T, R>(
    strategies: (() => T)[],
    isSuccess: (res: T, index: number) => boolean,
    processor: (res: T, index: number, strategy: () => T) => R
  ): R;
  static throw<T, R>(
    strategies: (() => T)[],
    keys: string[],
    isSuccess: (res: any, index: number) => boolean,
    processor: (res: any, index: number, strategy: () => T) => R
  ): R;
  static throw<T, R>(...args: any[]): R {
    const res = this._execute(args, false);
    if (res === this.ALL_THROUGH) {
      throw new Error("Logic.throw: All strategies failed.");
    }
    return res as R;
  }

  /**
   * 共通実行ロジック
   */
  private static _execute(args: any[], forceLast: boolean): any {
    const strategies = args[0] as (() => any)[];
    if (strategies.length === 0) throw new Error("Logic: strategies must not be empty.");

    const hasKeys = Array.isArray(args[1]);
    const keys = hasKeys ? (args[1] as string[]) : null;
    const isSuccess = (hasKeys ? args[2] : args[1]) as Function;
    const processor = (hasKeys ? args[3] : args[2]) as Function;

    const limit = forceLast ? strategies.length - 1 : strategies.length;

    for (let i = 0; i < limit; i++) {
      const res = strategies[i]();
      if (isSuccess(res, i)) {
        return this._processResult(res, i, keys, processor, strategies[i]);
      }
    }

    if (forceLast) {
      const lastIdx = strategies.length - 1;
      return this._processResult(strategies[lastIdx](), lastIdx, keys, processor, strategies[lastIdx]);
    }

    return this.ALL_THROUGH;
  }

  /**
   * 結果の加工と返却
   */
  private static _processResult(res: any, i: number, keys: string[] | null, processor: Function, strategy: () => any): any {
    if (keys && Array.isArray(res)) {
      if (keys.length !== res.length) {
        throw new Error(`Logic: ${i}番目の戦略の戻り値(配列)と、keysの要素数が違います。同じ数に揃えてください。res:${res.length} keys:${keys.length}`);
      }
      res = Object.fromEntries(keys.map((k, idx) => [k, res[idx]]));
    }
    return processor(res, i, strategy);
  }
}

