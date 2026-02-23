import { Article } from './types';
import { categorizeArticle } from './categorizer';

interface RSSFeed {
    name: string;
    url: string;
}

const RSS_FEEDS: RSSFeed[] = [
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
    { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
    { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
    { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
    { name: 'Ars Technica AI', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
    { name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
];

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const AI_KEYWORDS = ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'openai', 'anthropic', 'deepmind', 'neural', 'transformer', 'diffusion', 'chatbot'];

function generateId(url: string): string {
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
        const char = url.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

async function fetchRSSFeed(feed: RSSFeed): Promise<Article[]> {
    try {
        const RSSParser = (await import('rss-parser')).default;
        const parser = new RSSParser({
            timeout: 8000,
            headers: {
                'User-Agent': 'AI-News-Aggregator/1.0 (+https://github.com/ai-news)',
            },
        });
        const parsed = await parser.parseURL(feed.url);
        const articles: Article[] = [];

        for (const item of parsed.items?.slice(0, 20) || []) {
            if (!item.title || !item.link) continue;

            const description = item.contentSnippet || item.content || item.summary || '';
            const cleanDesc = description
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 300);

            // Extract image from content or media
            let imageUrl: string | undefined;
            const imgMatch = (item.content || '').match(/<img[^>]+src="([^"]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];

            articles.push({
                id: generateId(item.link),
                title: item.title.trim(),
                description: cleanDesc,
                url: item.link,
                imageUrl,
                source: feed.name,
                category: categorizeArticle(item.title, cleanDesc),
                publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
                scrapedAt: new Date().toISOString(),
            });
        }

        return articles;
    } catch (error) {
        console.error(`Error fetching RSS from ${feed.name}:`, error);
        return [];
    }
}

async function fetchHackerNews(): Promise<Article[]> {
    try {
        const res = await fetch(`${HN_API_BASE}/topstories.json`, { signal: AbortSignal.timeout(8000) });
        const ids: number[] = await res.json();
        const articles: Article[] = [];

        // Fetch top 30 stories and filter for AI-related
        const storyPromises = ids.slice(0, 30).map(async (id) => {
            const storyRes = await fetch(`${HN_API_BASE}/item/${id}.json`, { signal: AbortSignal.timeout(5000) });
            return storyRes.json();
        });

        const stories = await Promise.allSettled(storyPromises);

        for (const result of stories) {
            if (result.status !== 'fulfilled' || !result.value) continue;
            const story = result.value;
            if (!story.title || !story.url) continue;

            const titleLower = story.title.toLowerCase();
            const isAI = AI_KEYWORDS.some((kw) => titleLower.includes(kw));
            if (!isAI) continue;

            articles.push({
                id: generateId(story.url),
                title: story.title,
                description: story.title, // HN stories often have no description
                url: story.url,
                source: 'Hacker News',
                category: categorizeArticle(story.title, ''),
                publishedAt: new Date(story.time * 1000).toISOString(),
                scrapedAt: new Date().toISOString(),
            });
        }

        return articles;
    } catch (error) {
        console.error('Error fetching Hacker News:', error);
        return [];
    }
}

export async function scrapeAllSources(): Promise<Article[]> {
    const allPromises = [
        ...RSS_FEEDS.map((feed) => fetchRSSFeed(feed)),
        fetchHackerNews(),
    ];

    const results = await Promise.allSettled(allPromises);
    const allArticles: Article[] = [];

    for (const result of results) {
        if (result.status === 'fulfilled') {
            allArticles.push(...result.value);
        }
    }

    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = allArticles.filter((a) => {
        if (seen.has(a.url)) return false;
        seen.add(a.url);
        return true;
    });

    // Sort by date, newest first
    unique.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

    return unique;
}
