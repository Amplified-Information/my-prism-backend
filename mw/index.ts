import { type Request, type Response, type NextFunction } from 'express'

const PORT_SRC = 5174
const PORT_DST = 5173
const HOST_WEB = '10.0.1.11'
const HOST_PROXY = '10.0.1.10'

const marketMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const marketIdMatch = req.path.match(/^\/market\/([^/]+)\/?$/)

  if (marketIdMatch) {
    const marketId = marketIdMatch[1]

    // Fetch or generate metadata based on marketId
    const title = `Market ${marketId}`
    const description = `Details and analytics for market ${marketId}.`
    const image = `https://10.01.11/og-images/market-${marketId}.png`

    // Create a custom HTML response with OG and Twitter meta tags
    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="${title}" />
        <meta name="twitter:description" content="${description}" />
        <meta name="twitter:image" content="${image}" />
        <meta http-equiv="refresh" content="0; url='${req.originalUrl}'" />
      </head>
      <body></body>
      </html>
    `

    res.setHeader('Content-Type', 'text/html')
    return res.send(html)
  }

  next()
}

export default marketMiddleware

export const config = {
  matcher: ['/market/:marketId*']
}
