// Secure same-account bridge: use the existing configured Cloudflare Pages API
// for the new short Pages hostname without copying private API keys or secrets.
// Only exact short hostname /api routes are proxied; never accept an arbitrary target.
const SHORT = "infrarivet.pages.dev";
const API_ORIGIN = "https://infrarivet-academy-test.pages.dev";

export async function onRequest({ request, next }) {
  const incoming = new URL(request.url);
  if (incoming.hostname !== SHORT || !incoming.pathname.startsWith("/api/")) return next();

  const method=request.method.toUpperCase();
  if (!["GET","HEAD","POST","PUT","PATCH","DELETE"].includes(method))
    return Response.json({error:"Method not allowed"},{status:405});
  if (!["GET","HEAD"].includes(method) && request.headers.get("Origin") !== incoming.origin)
    return Response.json({error:"Invalid request origin"},{status:403,headers:{"Cache-Control":"no-store"}});

  const upstream = new URL(incoming.pathname+incoming.search,API_ORIGIN);
  const headers=new Headers(request.headers);
  // The backend's CSRF protection still checks Origin; rewrite only after
  // validating the real same-origin browser request on the public short host.
  headers.set("Origin",API_ORIGIN);
  for (const name of ["host","content-length","forwarded","x-forwarded-for","x-forwarded-host","x-real-ip"]) headers.delete(name);
  try {
    const response = await fetch(new Request(upstream.toString(), {
      method,
      headers,
      body: ["GET","HEAD"].includes(method) ? undefined : request.body,
      redirect: "manual",
      duplex: "half"
    }));
    const responseHeaders=new Headers(response.headers);
    responseHeaders.set("Cache-Control","no-store");
    responseHeaders.set("X-Content-Type-Options","nosniff");
    // Set-Cookie is host-only on the browser-visible origin, so login remains
    // on infrarivet.pages.dev and secure sessions can be read by the shared DB.
    return new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders});
  } catch (error) {
    console.error("Cloudflare API bridge unavailable",error?.message);
    return Response.json({error:"Login service is temporarily unavailable"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
