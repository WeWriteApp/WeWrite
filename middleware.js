import { NextResponse } from "next/server";

export function middleware(request) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname;

  // Define paths that are always public
  const isPublicPath = path === "/auth/login" || 
                      path === "/auth/register" || 
                      path === "/auth/forgot-password" ||
                      path.startsWith("/api/") ||
                      path.startsWith("/pages/"); // Allow access to all pages

  // Define paths that always require authentication
  const requiresAuth = path === "/new" || 
                      path === "/groups/new" ||
                      path === "/" ||
                      path.startsWith("/dashboard");

  // Get the token from the cookies
  const token = request.cookies.get("session")?.value;

  // Redirect authenticated users away from auth pages
  if (path.startsWith("/auth/") && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Only redirect to login for paths that explicitly require auth
  if (requiresAuth && !token) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Configure which routes to run middleware on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}; 