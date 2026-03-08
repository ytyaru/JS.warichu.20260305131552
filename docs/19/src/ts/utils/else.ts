/**
 * src/ts/util/else.ts
 */

/**
 * 処理の流れ（パス）を制御する汎用ロジッククラス
 */
export class Else {
  /**
   * pass() で全戦略が失格したことを示す一意のシンボル
   */
  static readonly PASS = Symbol('Else.PASS');

  /**
   * 戻り値が PASS シンボルであるか（全戦略が失格し、passルートを通ったか）を判定する
   * @param res 判定対象の値
   * @returns 合格通過した場合は true
   */
  static isPassed(res: any): boolean {
    return res === this.PASS;
  }

  /**
   * 複数の戦略を順次実行し、条件に合致した最初の結果を返す。
   * 最後の要素は条件に関わらず必ず実行・返却される。
   * 
   * @param strategies 実行する戦略関数の配列
   * @param isSuccess 成功とみなす条件式
   * @param processor 結果を最終的な型に変換する関数
   * @returns 処理結果
   */
  static gotoEnd<T, R>(
    strategies: (() => T)[],
    isSuccess: (res: T, index: number) => boolean,
    processor: (res: T, index: number, strategy: () => T) => R
  ): R;
  /**
   * @param strategies 実行する戦略関数の配列
   * @param keys 配列の結果をオブジェクトに変換するためのキー名リスト
   * @param isSuccess 成功とみなす条件式
   * @param processor 結果を最終的な型に変換する関数
   */
  static gotoEnd<T, R>(
    strategies: (() => T)[],
    keys: string[],
    isSuccess: (res: any, index: number) => boolean,
    processor: (res: any, index: number, strategy: () => T) => R
  ): R;
  static gotoEnd<T, R>(...args: any[]): R {
    return this._execute(args, true) as R;
  }

  /**
   * すべての条件から漏れた場合、そのまま通過する（pass）。
   * 戻り値として Else.PASS シンボルを返す。
   * 
   * @param strategies 実行する戦略関数の配列
   * @param isSuccess 成功とみなす条件式
   * @param processor 結果を最終的な型に変換する関数
   * @returns 処理結果または PASS シンボル
   */
  static pass<T, R>(
    strategies: (() => T)[],
    isSuccess: (res: T, index: number) => boolean,
    processor: (res: T, index: number, strategy: () => T) => R
  ): R | symbol;
  static pass<T, R>(
    strategies: (() => T)[],
    keys: string[],
    isSuccess: (res: any, index: number) => boolean,
    processor: (res: any, index: number, strategy: () => T) => R
  ): R | symbol;
  static pass<T, R>(...args: any[]): R | symbol {
    return this._execute(args, false);
  }

  /**
   * すべての条件から漏れた場合、例外を投げる。
   * 
   * @param strategies 実行する戦略関数の配列
   * @param isSuccess 成功とみなす条件式
   * @param processor 結果を最終的な型に変換する関数
   * @returns 処理結果
   * @throws {Error} すべての戦略が失敗した場合
   */
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
    if (this.isPassed(res)) {
      throw new Error("Else.throw: All strategies failed.");
    }
    return res as R;
  }

  /**
   * 共通実行ロジック
   * @private
   */
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

  /**
   * 結果の加工と返却
   * @private
   */
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

