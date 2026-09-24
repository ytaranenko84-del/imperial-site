const MAX_DIMENSION = 1600
const TARGET_BYTES = 700 * 1024
const MIN_QUALITY = 0.5

/**
 * Стискає фото в браузері перед відправкою. Телефонні знімки по 3-5 МБ,
 * шість штук разом, перевищують ліміт розміру запиту на Netlify (~4.5 МБ) —
 * сервер обриває заявку до того, як код роуту встигає відповісти.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    let width = Math.round(bitmap.width * scale)
    let height = Math.round(bitmap.height * scale)

    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    let quality = 0.82
    let blob: Blob | null = null
    for (let attempt = 0; attempt < 6; attempt++) {
      canvas.width = width
      canvas.height = height
      ctx.drawImage(bitmap, 0, 0, width, height)
      // eslint-disable-next-line no-await-in-loop
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
      if (!blob || blob.size <= TARGET_BYTES) break
      if (quality > MIN_QUALITY) {
        quality -= 0.1
      } else {
        width = Math.round(width * 0.85)
        height = Math.round(height * 0.85)
        quality = 0.75
      }
    }

    bitmap.close?.()
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.\w+$/, '') || 'photo'
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
  } catch {
    // HEIC чи інший формат, який браузер не вміє декодувати, — надсилаємо як є
    return file
  }
}
