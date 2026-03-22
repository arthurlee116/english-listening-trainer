type PublicCachePolicy = {
  browserMaxAge: number
  cdnMaxAge: number
  staleWhileRevalidate: number
}

export function getPublicCacheHeaders(policy: PublicCachePolicy): Record<string, string> {
  const { browserMaxAge, cdnMaxAge, staleWhileRevalidate } = policy
  const browserValue =
    browserMaxAge > 0
      ? `public, max-age=${browserMaxAge}, must-revalidate`
      : 'public, max-age=0, must-revalidate'
  const cdnValue = `public, s-maxage=${cdnMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`

  return {
    'Cache-Control': browserValue,
    'CDN-Cache-Control': cdnValue,
    'Vercel-CDN-Cache-Control': cdnValue,
  }
}

export const NEWS_TOPICS_CACHE_HEADERS = getPublicCacheHeaders({
  browserMaxAge: 30,
  cdnMaxAge: 300,
  staleWhileRevalidate: 3600,
})

export const NEWS_TRANSCRIPT_CACHE_HEADERS = getPublicCacheHeaders({
  browserMaxAge: 300,
  cdnMaxAge: 86400,
  staleWhileRevalidate: 604800,
})
