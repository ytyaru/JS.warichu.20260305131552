/**
 * src/ts/utils/error-class.ts
 */

/**
 * カスタムエラークラスを動的に生成・登録するためのファクトリクラス
 */
export class ErrorClass {
  /**
   * 複数のエラークラスを生成してオブジェクトで返す
   * @param definitions エラークラス名と親クラス名をスペース区切りで指定 (例: 'ChildError ParentError')
   * @returns 生成されたエラークラスを格納したオブジェクト { クラス名: クラス本体 }
   */
  static make(...definitions: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    const createdInThisCall = new Map<string, any>();
    createdInThisCall.set('Error', Error);

    // 引数内でのクラス名重複チェック
    const names = definitions.map(d => d.split(' ')[0]);
    if (new Set(names).size !== names.length) {
      throw new Error('ErrorClass.make: 引数の中でクラス名が重複しています。');
    }

    for (const def of definitions) {
      const [name, parentName = 'Error'] = def.split(' ');
      
      // 親クラスの解決（今回の呼び出しで生成済み -> グローバル -> Error）
      const Parent = result[parentName] || (typeof globalThis !== 'undefined' ? (globalThis as any)[parentName] : Error) || Error;

      const CustomError = class extends Parent {
        /**
         * @param message エラーメッセージ
         * @param cause エラーの原因
         */
        constructor(message: string, cause?: unknown) {
          super(message, cause ? { cause } : undefined);
          this.name = name;
        }
      };
      
      // クラス名を定義
      Object.defineProperty(CustomError, 'name', { value: name });
      
      result[name] = CustomError;
    }
    return result;
  }

  /**
   * 複数のエラークラスを生成し、グローバルスコープに登録する
   * @param definitions エラークラス名と親クラス名をスペース区切りで指定
   */
  static regist(...definitions: string[]): void {
    const classes = this.make(...definitions);
    if (typeof globalThis !== 'undefined') {
      for (const name in classes) {
        (globalThis as any)[name] = classes[name];
      }
    }
  }
}
