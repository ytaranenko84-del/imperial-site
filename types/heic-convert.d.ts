declare module 'heic-convert' {
  type Options = {
    buffer: Uint8Array | Buffer
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function convert(options: Options): Promise<ArrayBuffer>
  export default convert
}

declare module 'libheif-js/wasm-bundle' {
  type HeifImageHandle = {
    get_width(): number
    get_height(): number
    free(): void
  }
  type HeifDecoder = {
    decode(buffer: Uint8Array | Buffer): HeifImageHandle[]
    decoder: { delete(): void }
  }
  const libheif: {
    ready: Promise<void>
    HeifDecoder: new () => HeifDecoder
  }
  export default libheif
}
