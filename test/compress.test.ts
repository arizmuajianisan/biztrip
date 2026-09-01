import { describe, expect, it } from 'vitest'
import { DISPLAY_MAX_EDGE, DISPLAY_QUALITY, displayFilename } from '../app/utils/compressImage'

describe('displayFilename', () => {
  it('swaps the extension for the encoded type', () => {
    expect(displayFilename('IMG_0421.jpeg', 'image/webp')).toBe('IMG_0421.display.webp')
    expect(displayFilename('receipt.png', 'image/jpeg')).toBe('receipt.display.jpg')
  })

  it('handles a name with no extension', () => {
    expect(displayFilename('scan', 'image/webp')).toBe('scan.display.webp')
  })

  it('keeps dots inside the stem', () => {
    expect(displayFilename('2026.08.20 hotel.jpg', 'image/webp'))
      .toBe('2026.08.20 hotel.display.webp')
  })
})

describe('display copy settings', () => {
  it('targets a size a receipt stays readable at', () => {
    expect(DISPLAY_MAX_EDGE).toBe(1600)
    expect(DISPLAY_QUALITY).toBeGreaterThanOrEqual(0.7)
    expect(DISPLAY_QUALITY).toBeLessThan(0.9)
  })
})
