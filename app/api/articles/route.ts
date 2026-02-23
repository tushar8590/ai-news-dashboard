import { NextRequest, NextResponse } from 'next/server';
import { getArticles } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

    let articles = await getArticles();

    // Filter by category
    if (category && category !== 'all') {
        articles = articles.filter((a) => a.category === category);
    }

    // Paginate
    const total = articles.length;
    const start = (page - 1) * limit;
    const paged = articles.slice(start, start + limit);

    return NextResponse.json({
        articles: paged,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
