const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { chromium } = require('playwright')
const path = require('path')
const fs = require('fs')

const BREAKPOINTS = {
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
    baselineDir: z.string().optional().describe('Path to baseline directory for comparison')
  },
  async ({ url, route, baselineDir }) => {
    const browser = await chromium.launch()
    try {
      const results = {}

      for (const [breakpoint, size] of Object.entries(BREAKPOINTS)) {
        const page = await browser.newPage()
        await page.setViewportSize(size)
        await page.goto(url)
        await page.waitForLoadState('networkidle')

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

    for (const breakpoint of Object.keys(BREAKPOINTS)) {
      const src = path.join(routeDir, `${breakpoint}.png`)
      const dest = path.join(baselineRouteDir, `${breakpoint}.png`)
      if (fs.existsSync(src)) fs.copyFileSync(src, dest)
    }

    const output = {
      baselined: route,
      breakpoints: Object.keys(BREAKPOINTS)
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
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
