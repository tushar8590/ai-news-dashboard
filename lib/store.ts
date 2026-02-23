import { Article } from './types';

// In-memory store with persistence to /tmp on Vercel
let articlesCache: Article[] = [];
let lastUpdated: string | null = null;

export function getArticles(): Article[] {
    return articlesCache;
}

export function setArticles(articles: Article[]): void {
    articlesCache = articles;
    lastUpdated = new Date().toISOString();
}

export function addArticles(newArticles: Article[]): void {
    const existingUrls = new Set(articlesCache.map((a) => a.url));
    const uniqueNew = newArticles.filter((a) => !existingUrls.has(a.url));
    articlesCache = [...uniqueNew, ...articlesCache]
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 500); // Keep last 500 articles
    lastUpdated = new Date().toISOString();
}

export function getLastUpdated(): string | null {
    return lastUpdated;
}

export function searchArticles(query: string): Article[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return articlesCache.filter(
        (a) =>
            a.title.toLowerCase().includes(q) ||
            a.description.toLowerCase().includes(q) ||
            a.source.toLowerCase().includes(q)
    );
}

export function getTrendingKeywords(limit: number = 15): { keyword: string; count: number }[] {
    const stopWords = new Set([
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'is', 'it', 'its', 'as', 'are', 'was',
        'be', 'has', 'have', 'had', 'do', 'does', 'did', 'will', 'can',
        'not', 'this', 'that', 'these', 'those', 'i', 'we', 'you', 'he',
        'she', 'they', 'my', 'your', 'his', 'her', 'our', 'their', 'what',
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
