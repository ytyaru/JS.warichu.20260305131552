/**
 * src/ts/util/else.ts
 */

// 型定義の共通化
type Strategies<T> = (() => T)[];
type IsSuccess<T> = (res: T, index: number) => boolean;
type Processor<T, R> = (res: T, index: number, strategy: () => T) => R;

// オーバーロードシグネチャを定義
interface ElseMethod<ExtraReturn = never> {
  // keysなし
  <T, R>(
    strategies: Strategies<T>,
    isSuccess: IsSuccess<T>,
    processor: Processor<T, R>
  ): R | ExtraReturn;
  // keysあり
  <T, R>(
    strategies: Strategies<T>,
    keys: string[],
    isSuccess: IsSuccess<any>,
    processor: Processor<any, R>
  ): R | ExtraReturn;
}

export class Else {
  private static readonly PASS = Symbol('Else.PASS');

  static isPassed(res: any): boolean {
    return res === this.PASS;
  }

  // --- 共通型を適用して定義 ---

  /** 最後の戦略を強制実行する */
  static gotoEnd: ElseMethod = (...args: any[]) => {
    return this._execute(args, true);
  };

  /** そのまま通過する (PASSシンボルを返す) */
  static pass: ElseMethod<symbol> = (...args: any[]) => {
    return this._execute(args, false);
  };

  /** 例外を投げる */
  static throw: ElseMethod = (...args: any[]) => {
    const res = this._execute(args, false);
    if (this.isPassed(res)) {
      throw new Error("Else.throw: All strategies failed.");
    }
    return res;
  };

  // --- 内部ロジック ---

  private static _execute(args: any[], forceEnd: boolean): any {
    const strategies = args[0] as (() => any)[];
    if (strategies.length === 0) throw new Error("Else: strategies must not be empty.");

    const hasKeys = Array.isArray(args[1]);
    const keys = hasKeys ? (args[1] as string[]) : null;
    const isSuccess = (hasKeys ? args[2] : args[1]) as Function;
    const processor = (hasKeys ? args[3] : args[2]) as Function;

    const limit = forceEnd ? strategies.length - 1 : strategies.length;

    for (let i = 0; i < limit; i++) {
      const res = strategies[i]();
      if (isSuccess(res, i)) {
        return this._processResult(res, i, keys, processor, strategies[i]);
      }
    }

    if (forceEnd) {
      const lastIdx = strategies.length - 1;
      return this._processResult(strategies[lastIdx](), lastIdx, keys, processor, strategies[lastIdx]);
    }

    return this.PASS;
  }

  private static _processResult(res: any, i: number, keys: string[] | null, processor: Function, strategy: () => any): any {
    if (keys && Array.isArray(res)) {
      if (keys.length !== res.length) {
        throw new Error(`Else: ${i}番目の戦略の戻り値(配列)と、keysの要素数が違います。同じ数に揃えてください。res:${res.length} keys:${keys.length}`);
      }
      res = Object.fromEntries(keys.map((k, idx) => [k, res[idx]]));
    }
    return processor(res, i, strategy);
  }
}

