/**
 * src/ts/utils/error-class.ts
 * カスタム例外クラスの動的生成、一括生成、およびグローバル登録を担当するモジュール
 */

/**
 * 例外クラス生成ファクトリ
 */
export class ErrorClass {

  /**
   * 指定された定義に基づいて例外クラスを生成し、常にオブジェクト形式で返す。
   * TypeScript 5.0+ の const 型パラメータにより、引数の文字列からキーを自動推論する。
   * 
   * @param definitions "クラス名" または "クラス名 親クラス名"
   * @returns クラス名をキーとしたオブジェクト
   */
  static make<const T extends string[]>(...definitions: T): { 
    [K in T[number] extends `${infer Name} ${string}` ? Name : T[number]]: any 
  } {
    // 内部実装は makeObj と同じ（常にオブジェクトを返す）
    return this.makeObj(...definitions) as any;
    /*
    if (definitions.length === 0) {
      throw new Error("ErrorClass.make: 引数が指定されていません。");
    }

    if (definitions.length === 1) {
      return this.makeCls(definitions[0]);
    }

    return this.makeObj(...definitions);
    */
  }

  /**
   * 指定された定義に基づいて例外クラスを生成し、名前をキーとしたオブジェクト形式で返す。
   * 
   * @param definitions クラス定義文字列の配列
   * @returns クラス名をキーとしたオブジェクト
   */
  static makeObj(...definitions: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    
    // 重複チェック
    const names = definitions.map(d => d.split(" ")[0]);
    if (new Set(names).size !== names.length) {
      throw new Error("ErrorClass.makeObj: クラス名が重複しています。");
    }

    for (const def of definitions) {
      const cls = this.makeCls(def);
      result[cls.name] = cls;
    }
    return result;
  }

  /**
   * 指定された定義に基づいて例外クラスを生成し、配列形式で返す。
   * 
   * @param definitions クラス定義文字列の配列
   * @returns 生成されたクラスの配列
   */
  static makeAry(...definitions: string[]): any[] {
    return definitions.map(def => this.makeCls(def));
  }

  /**
   * 単一の例外クラスを生成して返す。
   * 
   * @param definition "クラス名" または "クラス名 親クラス名"
   * @returns 生成された例外クラス
   */
  static makeCls(definition: string): any {
    if (typeof definition !== "string") {
      throw new TypeError("ErrorClass.makeCls: 定義は文字列である必要があります。");
    }

    const [name, parentName = "Error"] = definition.trim().split(/\s+/);

    // バリデーション: JS識別子として妥当か（数字開始の禁止など）
    if (!name || /^[0-9]/.test(name) || /[^a-zA-Z0-9_$]/.test(name)) {
      throw new Error(`ErrorClass.makeCls: 不正なクラス名です: "${name}"`);
    }

    // 親クラスの解決
    const Parent = (typeof globalThis !== "undefined" ? (globalThis as any)[parentName] : null) || Error;

    const CustomError = class extends Parent {
      /**
       * @param message エラーメッセージ
       * @param cause エラーの原因（任意）
       */
      constructor(message: string, cause?: unknown) {
        super(message, cause ? { cause } : undefined);
        this.name = name;
      }
    };

    // クラスの .name プロパティを定義
    Object.defineProperty(CustomError, "name", { value: name, configurable: true });

    return CustomError;
  }

  /**
   * 指定された定義に基づいて例外クラスを生成し、グローバルスコープに登録する。
   * 
   * @param definitions クラス定義文字列の配列
   */
  static regist(...definitions: string[]): void {
    const obj = this.makeObj(...definitions);
    if (typeof globalThis !== "undefined") {
      for (const name in obj) {
        (globalThis as any)[name] = obj[name];
      }
    }
    if (typeof window !== "undefined") {
      for (const name in obj) {
        (window as any)[name] = obj[name];
      }
    }
  }
}

