import { Article } from './types';
import { kv } from '@vercel/kv';

// In-memory store fallback
let articlesCache: Article[] = [];
let lastUpdated: string | null = null;
let isInitialized = false;

// Initialize from KV if possible
async function initStore() {
    if (isInitialized) return;

    const kvUrl = process.env.KV_URL || process.env.KV_REST_API_URL;
    console.log('Initializing store. KV_URL present:', !!kvUrl);

    try {
        if (kvUrl) {
            console.log('Fetching articles from KV...');
            const cached = await kv.get<Article[]>('articles');
            if (cached) {
                articlesCache = cached;
                lastUpdated = await kv.get<string>('last_updated');
                console.log(`Successfully loaded ${articlesCache.length} articles from KV. Last updated: ${lastUpdated}`);
            } else {
                console.log('No articles found in KV cache.');
            }
        } else {
            console.log('KV environment variables not found. Using in-memory storage.');
        }
        isInitialized = true;
    } catch (err) {
        console.error('KV init error:', err);
    }
}

export async function getArticles(): Promise<Article[]> {
    await initStore();
    return articlesCache;
}

export async function setArticles(articles: Article[]): Promise<void> {
    articlesCache = articles;
    lastUpdated = new Date().toISOString();

    const kvUrl = process.env.KV_URL || process.env.KV_REST_API_URL;
    try {
        if (kvUrl) {
            console.log(`Saving ${articlesCache.length} articles to KV...`);
            await kv.set('articles', articlesCache);
            await kv.set('last_updated', lastUpdated);
            console.log('Successfully saved to KV.');
        }
    } catch (err) {
        console.error('KV set error:', err);
    }
}

export async function addArticles(newArticles: Article[]): Promise<void> {
    await initStore();
    const existingUrls = new Set(articlesCache.map((a) => a.url));
    const uniqueNew = newArticles.filter((a) => !existingUrls.has(a.url));

    console.log(`Adding ${uniqueNew.length} new articles to existing ${articlesCache.length}.`);

    articlesCache = [...uniqueNew, ...articlesCache]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 500); // Keep last 500 articles
    lastUpdated = new Date().toISOString();

    const kvUrl = process.env.KV_URL || process.env.KV_REST_API_URL;
    try {
        if (kvUrl) {
            console.log(`Persisting updated cache (${articlesCache.length} total) to KV...`);
            await kv.set('articles', articlesCache);
            await kv.set('last_updated', lastUpdated);
            console.log('Successfully persisted to KV.');
        }
    } catch (err) {
        console.error('KV add error:', err);
    }
}

export async function getLastUpdated(): Promise<string | null> {
    await initStore();
    return lastUpdated;
}

export async function searchArticles(query: string): Promise<Article[]> {
    await initStore();
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return articlesCache.filter(
        (a) =>
            a.title.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            a.source.toLowerCase().includes(q)
    );
}

export async function getTrendingKeywords(limit: number = 15): Promise<{ keyword: string; count: number }[]> {
    await initStore();
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'it', 'its', 'as', 'are', 'was',
        'be', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'can',
        'not', 'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he',
        'she', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'what',
        'command', // Added 'command' to stop words
        'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each',
        'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such',
        'no', 'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
        'just', 'because', 'about', 'into', 'through', 'up', 'new', 'also',
        'after', 'over', 'could', 'would', 'should', 'now', 'may', 'one',
        'two', 'first', 'been', 'being', 'get', 'got', 'make', 'like',
        'use', 'used', 'using', 'says', 'said', 'out', 'if', 'then',
        '-', '–', '—', '|', '', 'vs', 'via', 'per',
    ]);

    const wordCount = new Map<string, number>();
    // Only consider articles from the last 48 hours for trending
    const cutoff = Date.now() - 48 * 60 * 60 * 1000;
    const recentArticles = articlesCache.filter(
        (a) => new Date(a.publishedAt).getTime() > cutoff
    );

    for (const article of recentArticles) {
        const words = article.title.toLowerCase().split(/\s+/);
        for (const word of words) {
            const clean = word.replace(/[^a-z0-9-]/g, '');
            if (clean.length > 2 && !stopWords.has(clean)) {
                wordCount.set(clean, (wordCount.get(clean) || 0) + 1);
            }
        }
    }

    return Array.from(wordCount.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
}
