### 確定した API 設計（設計メモ用）

この内容を、将来の拡張用メモとして文書化します。

```typescript
/**
 * 処理フロー制御の一般化 (Trial API)
 * 複数の戦略（関数）の実行順序と、その結果に対するハンドリングを抽象化したフレームワーク。
 */
export class Trial {
  // ==========================================
  // 1. 早期リターン系 (First)
  // 上から順に試し、最初の合格を返す。全失格時の挙動でメソッドが分かれる。
  // ==========================================
  
  /** 最初の合格を返す。なければ例外を投げる。 */
  static firstOrThrow<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, processor: (res: T, i: number, strategy: () => T) => R): R;
  
  /** 最初の合格を返す。なければ Symbol(Trial.PASS) を返す。 */
  static firstOrPass<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, processor: (res: T, i: number, strategy: () => T) => R): R | symbol;
  
  /** 最初の合格を返す。なければ 最後の戦略を強制実行する。 */
  static firstOrEnd<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, processor: (res: T, i: number, strategy: () => T) => R): R;
  
  /** 最初の合格を返す。なければ 任意関数(onFailed)を実行する。 */
  static firstOrHandle<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, onFailed: () => R, processor: (res: T, i: number, strategy: () => T) => R): R;

  // ==========================================
  // 2. 上限付き抽出 (Limit)
  // ==========================================
  
  /** 合格したものが limitCount に達するまで実行し、配列で返す。 */
  static limit<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, limitCount: number, processor: (res: T, i: number, strategy: () => T) => R): R[];

  // ==========================================
  // 3. 検証系 (Assert)
  // 全件走査し、合格数を検証する。条件を満たさなければ例外を投げる。
  // ==========================================
  
  /** 合格が0件であることを検証する。1件以上なら例外。 */
  static assertZero<T>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean): void;
  
  /** 合格が1件のみであることを検証し、その結果を返す。0件/2件以上なら例外。 */
  static assertOne<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, processor: (res: T, i: number, strategy: () => T) => R): R;
  
  /** 合格が0件または1件であることを検証する。2件以上なら例外。 */
  static assertOptional<T, R>(strategies: (() => T)[], isSuccess: (res: T, i: number) => boolean, processor: (res: T, i: number, strategy: () => T) => R): R | symbol;
  
  /** 合格がちょうど count 件であることを検証し、配列で返す。 */
  static assertExactly<T, R>(
    strategies: Array<() => T>, 
    isSuccess: (res: T, i: number) => boolean, 
    count: number, 
    processor: (res: T, i: number, strategy: () => T) => R
  ): Array<R>;

  // ==========================================
  // 4. 反復系 (Loop)
  // 単一の戦略を時間的・回数的な条件で繰り返す。
  // ==========================================
  
  /** 単一の戦略を、合格するか上限回数に達するまで再試行する。 */
  static retry<T, R>(
    strategy: () => T, 
    isSuccess: (res: T, attempt: number) => boolean, 
    maxAttempts: number, 
    delayMs: number,
    processor: (res: T, attempt: number) => R
  ): Promise<R>;
}


```


