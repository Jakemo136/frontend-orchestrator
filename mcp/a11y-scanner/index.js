const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { z } = require('zod')
const { chromium } = require('playwright')
const { AxePuppeteer } = require('@axe-core/playwright')

const server = new McpServer({
  name: 'a11y-scanner',
  version: '1.0.0'
})

server.tool(
  'scan',
  'Run axe-core accessibility scan on a live route',
  {
    url: z.string().describe('URL to scan'),
    standard: z.string().default('WCAG22AA').describe('WCAG standard tag')
  },
  async ({ url, standard = 'WCAG22AA' }) => {
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()

      const response = await page.goto(url, { timeout: 30000 })
      if (!response) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: `Failed to navigate to ${url}`,
            violations: [], passes: 0, incomplete: 0, inapplicable: 0
          }, null, 2) }]
        }
      }

      const results = await new AxePuppeteer(page)
        .withTags([standard.toLowerCase()])
        .analyze()

      if (!results.violations && !results.passes) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'axe-core did not return valid results — page may not have loaded correctly',
            violations: [], passes: 0, incomplete: 0, inapplicable: 0
          }, null, 2) }]
        }
      }

      const output = {
        violations: results.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          description: v.description,
          helpUrl: v.helpUrl,
          nodes: v.nodes.map(n => ({
            html: n.html,
            failureSummary: n.failureSummary,
            target: n.target
          }))
        })),
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }]
      }
    } finally {
      await browser.close()
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch(err => {
  process.stderr.write(`a11y-scanner fatal: ${err.message}\n`)
  process.exit(1)
})
