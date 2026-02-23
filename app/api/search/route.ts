import { NextRequest, NextResponse } from 'next/server';
import { searchArticles } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const q = request.nextUrl.searchParams.get('q') || '';

    if (q.trim().length < 2) {
        return NextResponse.json({ articles: [], query: q });
    }

    const results = await searchArticles(q);
    return NextResponse.json({
        articles: results.slice(0, 30),
        query: q,
        total: results.length,
    });
}
