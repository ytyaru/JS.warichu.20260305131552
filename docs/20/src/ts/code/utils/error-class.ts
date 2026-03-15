/**
 * src/ts/utils/error-class.ts
 */

/**
 * カスタムエラークラスを動的に生成・登録するためのファクトリクラス
 */
export class ErrorClass {
  /**
   * 複数のエラークラスを生成して配列で返す
   * @param definitions エラークラス名と親クラス名をスペース区切りで指定 (例: 'ChildError ParentError')
   * @returns 生成されたエラークラスの配列
   */
  static make(...definitions: string[]): any[] {
    const created = new Map<string, any>();
    created.set('Error', Error);

    return definitions.map(def => {
      const [name, parentName = 'Error'] = def.split(' ');
      
      const Parent = created.get(parentName) || (typeof globalThis !== 'undefined' ? (globalThis as any)[parentName] : Error) || Error;

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
      Object.defineProperty(CustomError, 'name', { value: name });
      
      created.set(name, CustomError);
      return CustomError;
    });
  }

  /**
   * 複数のエラークラスを生成し、グローバルスコープに登録する
   * @param definitions エラークラス名と親クラス名をスペース区切りで指定
   */
  static regist(...definitions: string[]): void {
    const classes = this.make(...definitions);
    if (typeof globalThis !== 'undefined') {
      definitions.forEach((def, i) => {
        const name = def.split(' ')[0];
        (globalThis as any)[name] = classes[i];
      });
    }
  }
}
