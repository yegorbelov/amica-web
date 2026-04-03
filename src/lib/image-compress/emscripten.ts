/** Minimal Emscripten module surface used by image compress glue. */
export interface EmscriptenModule {
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  cwrap: (
    ident: string,
    returnType: string | null,
    argTypes: string[],
  ) => (...args: number[]) => number | void;
}
