import { NextResponse } from 'next/server';
import { getTrendingKeywords } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
    const trending = getTrendingKeywords(20);
    return NextResponse.json({ trending });
}
