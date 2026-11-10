/**
 * Render the Linux icon assets from the Linux white-canvas artwork.
 *
 * The launcher set installs one bitmap per file in `resources/icons/` into the
 * matching `hicolor/<edge>x<edge>/apps/` directory, and desktop environments
 * only scan the standard edges — a single non-standard bitmap (the 1104×1104
 * PNG this set replaced) leaves Deepin and peers falling back to a generic
 * gear. The window, taskbar, and notification icons share the 1024-pixel
 * `resources/icon-tile.png`; only the tray swaps the black and white whales by
 * system theme. Each bitmap is rasterized from the vector source separately
 * instead of downscaling one large bitmap, which keeps edges crisp at every
 * scale. The committed files are the output; rerun `pnpm run
 * render:linux-icons` in `apps/desktop` after changing the source.
 *
 * `resources/icon-linux.svg` is a Linux-only variant of `resources/icon.svg`:
 * a rounded white canvas that fills its slot edge to edge, rather than a
 * near-white tile inset inside a transparent margin, and the whale at full
 * opacity in pure black rather than 90% opacity over that tile plus a white
 * inner shadow. The corner radius keeps the macOS artwork's proportion
 * (230/1024). The shared `icon.svg` is left alone because
 * `apps/web/scripts/render-app-icons.ts` renders the web install icons from it.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/** Bitmap edge lengths bundled in the launcher icon set: the hicolor edges desktop environments scan. */
export const LINUX_ICON_SIZES = [16, 32, 48, 64, 128, 256, 512] as const

/** Edge of the window, taskbar, and notification icon; hosts sample it down to their slot size. */
export const LINUX_TILE_EDGE = 1024

/** Committed outputs: the launcher set directory and the runtime tile bitmap. */
export const LINUX_ICON_PATHS = {
  output: fileURLToPath(new URL('../resources/icons', import.meta.url)),
  tile: fileURLToPath(new URL('../resources/icon-tile.png', import.meta.url)),
} as const

/** Vector source of every Linux icon bitmap: the Linux white-canvas artwork. */
const ARTWORK_SOURCE = fileURLToPath(new URL('../resources/icon-linux.svg', import.meta.url))

/** Coordinate space of the vector source; sharp's SVG density is scaled against it. */
const SOURCE_EDGE = 1104

/**
 * Rasterize the vector source at a square edge.
 * @param size - Bitmap edge length in pixels.
 * @returns the PNG stream.
 */
export async function renderLinuxIcon(size: number): Promise<Buffer> {
  // A density of 72 renders one source unit per pixel, so scale it up until the
  // intermediate raster covers the requested edge before the final resize.
  return sharp(ARTWORK_SOURCE, { density: Math.ceil(size * 72 / SOURCE_EDGE) })
    .resize(size, size).png({ compressionLevel: 9 }).toBuffer()
}

/** Rewrite every committed Linux icon bitmap from the vector source. */
export async function renderLinuxIcons(): Promise<void> {
  await mkdir(LINUX_ICON_PATHS.output, { recursive: true })
  for (const size of LINUX_ICON_SIZES) {
    await writeFile(resolve(LINUX_ICON_PATHS.output, `${String(size)}x${String(size)}.png`), await renderLinuxIcon(size))
  }
  await writeFile(LINUX_ICON_PATHS.tile, await renderLinuxIcon(LINUX_TILE_EDGE))
}

async function main(): Promise<void> {
  await renderLinuxIcons()
  console.info(`linux icons: wrote ${LINUX_ICON_PATHS.output} with ${LINUX_ICON_SIZES.join(', ')} px bitmaps and ${LINUX_ICON_PATHS.tile}`)
}

if (process.argv[1] !== undefined && import.meta.filename === resolve(process.argv[1])) await main()
