const fs = require('fs')
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch')

function diffImages(baselinePath, currentPath, diffOutputPath) {
  const baseline = PNG.sync.read(fs.readFileSync(baselinePath))
  const current = PNG.sync.read(fs.readFileSync(currentPath))

  const width = Math.max(baseline.width, current.width)
  const height = Math.max(baseline.height, current.height)

  const baselineResized = resizeToFit(baseline, width, height)
  const currentResized = resizeToFit(current, width, height)

  const diff = new PNG({ width, height })

  const mismatchedPixels = pixelmatch(
    baselineResized.data,
    currentResized.data,
    diff.data,
    width,
    height,
    { threshold: 0.1 }
  )

  const totalPixels = width * height
  const diffPercentage = (mismatchedPixels / totalPixels) * 100

  if (diffOutputPath) {
    fs.mkdirSync(require('path').dirname(diffOutputPath), { recursive: true })
    fs.writeFileSync(diffOutputPath, PNG.sync.write(diff))
  }

  return {
    mismatchedPixels,
    totalPixels,
    diffPercentage: Math.round(diffPercentage * 100) / 100,
    dimensionMismatch: baseline.width !== current.width || baseline.height !== current.height,
    baseline: { width: baseline.width, height: baseline.height },
    current: { width: current.width, height: current.height },
  }
}

function resizeToFit(img, targetWidth, targetHeight) {
  if (img.width === targetWidth && img.height === targetHeight) return img
  const resized = new PNG({ width: targetWidth, height: targetHeight, fill: true })
  PNG.bitblt(img, resized, 0, 0, img.width, img.height, 0, 0)
  return resized
}

module.exports = { diffImages }
