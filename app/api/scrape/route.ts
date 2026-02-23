import { NextResponse } from 'next/server';
import { scrapeAllSources } from '@/lib/scraper';
import { addArticles, getArticles } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
    try {
        const articles = await scrapeAllSources();
        addArticles(articles);

        return NextResponse.json({
            success: true,
            articlesScraped: articles.length,
            totalArticles: getArticles().length,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Scrape error:', error);
        return NextResponse.json(
            { success: false, error: 'Scrape failed' },
            { status: 500 }
        );
    }
}
