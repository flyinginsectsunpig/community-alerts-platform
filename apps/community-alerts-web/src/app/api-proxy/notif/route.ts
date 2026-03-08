import { NextRequest, NextResponse } from 'next/server';

const BASE = process.env.NOTIF_API_URL || 'http://localhost:5001';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
    const path = params.path.join('/');
    const search = req.nextUrl.search ?? '';
    const url = `${BASE}/${path}${search}`;

    const headers = new Headers();
    req.headers.forEach((v, k) => {
        if (!['host', 'connection'].includes(k)) headers.set(k, v);
    });

    try {
        const res = await fetch(url, {
            method: req.method,
            headers,
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : await req.arrayBuffer(),
        });

        const body = await res.arrayBuffer();
        const resHeaders = new Headers();
        res.headers.forEach((v, k) => resHeaders.set(k, v));

        return new NextResponse(body, { status: res.status, headers: resHeaders });
    } catch (err: any) {
        console.error(`[proxy/notif] Failed to proxy ${url}:`, err.message);
        return NextResponse.json({ error: 'Upstream error', detail: err.message }, { status: 502 });
    }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;