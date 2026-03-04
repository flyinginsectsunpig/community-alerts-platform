import { NextResponse, NextRequest } from "next/server";

/**
 * Next.js middleware to protect the /admin route.
 * 
 * Checks for the auth_user cookie/localStorage JWT.
 * Since middleware runs on the edge (no localStorage access),
 * we use a lightweight approach: check for the auth_token cookie.
 * The client-side AuthProvider will also redirect if not authenticated.
 */
export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Only protect /admin routes
    if (!pathname.startsWith("/admin")) {
        return NextResponse.next();
    }

    // Check for auth token in cookies (set by client-side JS)
    const token = request.cookies.get("auth_token")?.value;

    if (!token) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/admin/:path*"],
};
