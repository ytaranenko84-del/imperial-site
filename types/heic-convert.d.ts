declare module 'heic-convert' {
  type Options = {
    buffer: Uint8Array | Buffer
    format: 'JPEG' | 'PNG'
    quality?: number
  }
  function convert(options: Options): Promise<ArrayBuffer>
  export default convert
}
