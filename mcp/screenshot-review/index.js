const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')
const { diffImages } = require('./diff.js')

const DEFAULT_BREAKPOINTS = {
  mobile:     { width: 375,  height: 812  },
  tablet:     { width: 768,  height: 1024 },
  desktop:    { width: 1280, height: 900  },
  lgDesktop:  { width: 1440, height: 900  }
}

const server = new McpServer({
  name: 'screenshot-review',
  version: '1.0.0'
})

server.tool(
  'capture',
  'Screenshot a route at all breakpoints, optionally diff against baseline',
  {
    url: z.string().describe('URL to screenshot'),
    route: z.string().describe('Route name for organizing screenshots'),
    baselineDir: z.string().optional().describe('Path to baseline directory for comparison'),
    breakpoints: z.record(z.object({
      width: z.number(),
      height: z.number()
    })).optional().describe('Custom breakpoints (overrides defaults)')
  },
  async ({ url, route, baselineDir, breakpoints }) => {
    const browser = await chromium.launch()
    try {
      const results = {}

      for (const [breakpoint, size] of Object.entries(breakpoints ?? DEFAULT_BREAKPOINTS)) {
        const page = await browser.newPage()
        await page.setViewportSize(size)
        const response = await page.goto(url, { timeout: 30000 })
        if (!response) {
          results[breakpoint] = { path: null, size, error: `Failed to navigate to ${url}` }
          await page.close()
          continue
        }

        try {
          await page.waitForLoadState('networkidle', { timeout: 10000 })
        } catch {
          // Page didn't reach networkidle in 10s — proceed with current state
        }

        const screenshotPath = path.join(
          process.cwd(),
          'screenshots',
          route,
          `${breakpoint}.png`
        )
        fs.mkdirSync(path.dirname(screenshotPath), { recursive: true })
        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        })

        results[breakpoint] = { path: screenshotPath, size }

        if (baselineDir) {
          const baselinePath = path.join(
            baselineDir, route, `${breakpoint}.png`
          )
          results[breakpoint].hasBaseline = fs.existsSync(baselinePath)
          results[breakpoint].baselinePath = baselinePath
        }

        await page.close()
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
      }
    } finally {
      await browser.close()
    }
  }
)

server.tool(
  'setBaseline',
  'Promote current screenshots to visual regression baseline',
  {
    route: z.string().describe('Route name to baseline')
  },
  async ({ route }) => {
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    const baselineDir = path.join(process.cwd(), 'screenshots/baseline')
    const routeDir = path.join(screenshotsDir, route)
    const baselineRouteDir = path.join(baselineDir, route)

    fs.mkdirSync(baselineRouteDir, { recursive: true })

    for (const breakpoint of Object.keys(DEFAULT_BREAKPOINTS)) {
      const src = path.join(routeDir, `${breakpoint}.png`)
      const dest = path.join(baselineRouteDir, `${breakpoint}.png`)
      if (fs.existsSync(src)) fs.copyFileSync(src, dest)
    }

    const output = {
      baselined: route,
      breakpoints: Object.keys(DEFAULT_BREAKPOINTS)
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
    }
  }
)

server.tool(
  'compare',
  'Compare current screenshots against baseline — returns pixel diff percentage per breakpoint',
  {
    route: z.string().describe('Route name to compare'),
    threshold: z.number().default(0.5).describe('Max allowed diff percentage before flagging regression'),
    saveDiffs: z.boolean().default(true).describe('Save diff images to screenshots/diffs/')
  },
  async ({ route, threshold, saveDiffs }) => {
    const screenshotsDir = path.join(process.cwd(), 'screenshots')
    const routeDir = path.join(screenshotsDir, route)
    const baselineDir = path.join(screenshotsDir, 'baseline', route)
    const diffDir = path.join(screenshotsDir, 'diffs', route)

    const results = {}
    let hasRegression = false

    for (const breakpoint of Object.keys(DEFAULT_BREAKPOINTS)) {
      const currentPath = path.join(routeDir, `${breakpoint}.png`)
      const baselinePath = path.join(baselineDir, `${breakpoint}.png`)

      if (!fs.existsSync(currentPath)) {
        results[breakpoint] = { status: 'missing', error: 'Current screenshot not found' }
        continue
      }

      if (!fs.existsSync(baselinePath)) {
        results[breakpoint] = { status: 'no_baseline', error: 'No baseline to compare against' }
        continue
      }

      try {
        const diffPath = saveDiffs ? path.join(diffDir, `${breakpoint}-diff.png`) : null
        const diff = diffImages(baselinePath, currentPath, diffPath)

        const regressed = diff.diffPercentage > threshold
        if (regressed) hasRegression = true

        results[breakpoint] = {
          status: regressed ? 'regression' : 'pass',
          diffPercentage: diff.diffPercentage,
          mismatchedPixels: diff.mismatchedPixels,
          totalPixels: diff.totalPixels,
          dimensionMismatch: diff.dimensionMismatch,
          diffImage: diffPath,
        }
      } catch (err) {
        results[breakpoint] = { status: 'error', error: err.message }
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          route,
          threshold,
          hasRegression,
          breakpoints: results
        }, null, 2)
      }]
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(`screenshot-review fatal: ${err.message}\n`)
  process.exit(1)
})
