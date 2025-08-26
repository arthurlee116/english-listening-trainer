export function GET(req: Request) {
  const target = new URL('/placeholder-logo.png', new URL(req.url).origin)
  // Temporary redirect to PNG favicon; browsers accept PNG for favicon
  return Response.redirect(target, 302)
}

export function HEAD(req: Request) {
  const target = new URL('/placeholder-logo.png', new URL(req.url).origin)
  return Response.redirect(target, 302)
}
