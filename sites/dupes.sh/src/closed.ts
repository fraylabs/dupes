const closurePage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dupes has closed.</title>
  <style>
    body { margin: 0; padding: 2rem clamp(1rem, 5vw, 4rem); font: 1rem system-ui, sans-serif; }
    h1 { font-size: clamp(1.5rem, 5vw, 2.5rem); }
  </style>
</head>
<body><main><h1>Dupes has closed.</h1></main></body>
</html>`;

export default {
  fetch(request: Request): Response {
    const pageRequest = request.method === "GET" || request.method === "HEAD";
    return new Response(request.method === "HEAD" ? null : closurePage, {
      status: pageRequest ? 200 : 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; form-action 'none'",
      },
    });
  },

  // Suspend demo resets and webhook deliveries while the site is closed.
  scheduled(): void {},
};
