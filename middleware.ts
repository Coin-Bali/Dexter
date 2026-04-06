import { paymentProxyFromHTTPServer } from "@x402/next";
import type { NextRequest } from "next/server";

import { PREFERRED_NETWORK_COOKIE_NAME, getNetworkConfig } from "@/lib/networks";
import { getX402HttpServer, getX402HttpServerWithDynamicRoutes } from "@/lib/x402-server";

export async function middleware(request: NextRequest) {
  const preferredNetwork = request.cookies.get(PREFERRED_NETWORK_COOKIE_NAME)?.value;
  const x402Network = getNetworkConfig(
    preferredNetwork === "base" || preferredNetwork === "base_sepolia"
      ? preferredNetwork
      : undefined,
  ).x402Network;
  const isCustomRoute = request.nextUrl.pathname.startsWith("/api/x402/custom/");

  if (isCustomRoute) {
    const dynamicServer = await getX402HttpServerWithDynamicRoutes(x402Network);
    const proxy = paymentProxyFromHTTPServer(dynamicServer);
    return proxy(request);
  }

  const staticProxy = paymentProxyFromHTTPServer(getX402HttpServer(x402Network));
  return staticProxy(request);
}

export const config = {
  matcher: ["/api/x402/:path*"],
};
