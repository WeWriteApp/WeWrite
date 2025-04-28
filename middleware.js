import { NextResponse } from "next/server";

export function middleware(request) {
  // Clone the URL so we can modify it
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Define paths that are always public
  const isPublicPath = path === "/auth/login" ||
                      path === "/auth/register" ||
                      path === "/auth/forgot-password" ||
                      path.startsWith("/api/") ||
                      path.startsWith("/pages/") ||
                      path === "/"; // Allow access to home page

  // Define paths that always require authentication
  const requiresAuth = path === "/new" ||
                      path === "/groups/new" ||
                      path.startsWith("/dashboard") ||
                      path === "/subscription" ||
                      path === "/subscription/";

  // Get the token from the cookies
  const token = request.cookies.get("session")?.value;

  // URL structure redirects

  // Redirect /pages/[id] to /[id]
  if (path.startsWith('/pages/')) {
    const id = path.replace('/pages/', '');
    // Don't redirect /pages/new
    if (id !== 'new') {
      url.pathname = `/${id}`;
      return NextResponse.redirect(url);
    }
  }

  // Redirect /u/[slug] to /user/[id]
  if (path.startsWith('/u/')) {
    const id = path.replace('/u/', '');
    url.pathname = `/user/${id}`;
    return NextResponse.redirect(url);
  }

  // We're not going to redirect /[id] paths in the middleware
  // Instead, we'll let the /[id] route handle the logic of determining
  // whether it's a page, user, or group

  // Redirect /groups/[id] to /g/[id]
  if (path.startsWith('/groups/')) {
    const id = path.replace('/groups/', '');
    // Don't redirect /groups/new
    if (id !== 'new') {
      url.pathname = `/g/${id}`;
      return NextResponse.redirect(url);
    }
  }

  // We're not going to handle URLs with slashes in them in the middleware
  // Instead, we'll let the app/[id]/page.js handle it

  // Authentication redirects

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