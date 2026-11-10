import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { LINUX_ICON_PATHS, LINUX_ICON_SIZES, LINUX_TILE_EDGE, renderLinuxIcon } from '../scripts/render-linux-icons.ts'

/** Edges whose whale is large enough to stay pure black through the downscale. */
const BLACK_WHALE_EDGES: readonly number[] = [512, LINUX_TILE_EDGE]

/** Read one pixel back as `[red, green, blue, alpha]`. */
async function pixel(source: string | Buffer, size: number, x: number, y: number): Promise<number[]> {
  const { data } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const offset = (y * size + x) * 4
  return [...data.subarray(offset, offset + 4)]
}

/** Assert one bitmap is the rounded white canvas carrying a black whale. */
async function expectRoundedWhiteCanvas(source: string | Buffer, size: number, blackWhale: boolean): Promise<void> {
  const { channels } = await sharp(source).stats()
  const means = channels.map(channel => channel.mean)
  const mins = channels.map(channel => channel.min)
  // The white canvas carries the whale, keeping every icon surface legible on
  // dark panels; a transparent whale would vanish there.
  for (const mean of means.slice(0, 3)) expect(mean).toBeGreaterThan(150)
  // The corners are rounded away the way every platform icon is; a straight
  // square reads as an unfinished rectangle in the taskbar.
  expect((await pixel(source, size, 0, 0))[3]).toBe(0)
  // The canvas still fills its slot edge to edge, so the icon never floats
  // inside a transparent margin the way the inset tile used to.
  const topEdge = await pixel(source, size, size >> 1, 0)
  for (const mean of topEdge.slice(0, 3)) expect(mean).toBeGreaterThan(200)
  expect(topEdge[3]).toBe(255)
  // The whale is pure black. The shared white-tile artwork paints it as a
  // 90%-opacity navy gradient over a near-white tile, which reads as gray.
  if (blackWhale) {
    for (const min of mins.slice(0, 3)) expect(min).toBeLessThan(32)
  }
}

describe('linux icon packaging', () => {
  it('rasterizes every committed edge as the rounded white-canvas artwork', async () => {
    for (const size of [...LINUX_ICON_SIZES, LINUX_TILE_EDGE]) {
      const png = await renderLinuxIcon(size)
      const meta = await sharp(png).metadata()
      expect([meta.width, meta.height, meta.channels]).toEqual([size, size, 4])
      await expectRoundedWhiteCanvas(png, size, BLACK_WHALE_EDGES.includes(size))
    }
  })

  it('ships every committed bitmap as the rounded white-canvas artwork', async () => {
    for (const size of LINUX_ICON_SIZES) {
      const file = resolve(LINUX_ICON_PATHS.output, `${String(size)}x${String(size)}.png`)
      const meta = await sharp(file).metadata()
      expect([meta.width, meta.height]).toEqual([size, size])
      // A launcher icon that drifts off the original artwork, or loses the
      // canvas, shows the wrong logo or a hollow whale in the application menu.
      await expectRoundedWhiteCanvas(file, size, BLACK_WHALE_EDGES.includes(size))
    }
    const tile = await sharp(LINUX_ICON_PATHS.tile).metadata()
    expect([tile.width, tile.height]).toEqual([LINUX_TILE_EDGE, LINUX_TILE_EDGE])
    await expectRoundedWhiteCanvas(LINUX_ICON_PATHS.tile, LINUX_TILE_EDGE, true)
  })
})
