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
                      path.startsWith("/dashboard");

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

  // Redirect /user/[id] to /u/[id]
  if (path.startsWith('/user/')) {
    const id = path.replace('/user/', '');
    url.pathname = `/u/${id}`;
    return NextResponse.redirect(url);
  }

  // Redirect /users/[userId] to /u/[id]
  if (path.startsWith('/users/')) {
    const id = path.replace('/users/', '');
    url.pathname = `/u/${id}`;
    return NextResponse.redirect(url);
  }

  // Redirect /[username] to /u/[username]
  if (path.match(/^\/[a-zA-Z0-9_-]+$/) && !path.startsWith('/u/') && !path.startsWith('/g/')) {
    // Check if this is a username and not a page ID
    // This is a simplified check - in production, you'd want to check against your database
    const potentialUsername = path.substring(1);
    if (potentialUsername.match(/^[a-zA-Z0-9_-]{3,30}$/)) {
      url.pathname = `/u${path}`;
      return NextResponse.redirect(url);
    }
  }

  // Redirect /groups/[id] to /g/[id]
  if (path.startsWith('/groups/')) {
    const id = path.replace('/groups/', '');
    // Don't redirect /groups/new
    if (id !== 'new') {
      url.pathname = `/g/${id}`;
      return NextResponse.redirect(url);
    }
  }

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