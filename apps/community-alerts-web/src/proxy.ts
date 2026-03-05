import { NextResponse, NextRequest } from "next/server";

/**
 * Next.js proxy to protect the /admin route.
 *
 * Checks for the auth_token cookie.
 */
export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    if (!pathname.startsWith("/admin")) {
        return NextResponse.next();
    }

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
