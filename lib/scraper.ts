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
    console.log(`Attempting to fetch RSS from: ${feed.name} (${feed.url})`);
    try {
        const RSSParser = (await import('rss-parser')).default;
        const parser = new RSSParser({
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml',
            },
        });

        const parsed = await parser.parseURL(feed.url);
        const articles: Article[] = [];

        const items = parsed.items || [];
        console.log(`Source ${feed.name} returned ${items.length} items.`);

        for (const item of items.slice(0, 20)) {
            if (!item.title || !item.link) continue;

            const description = item.contentSnippet || item.content || item.summary || '';
            const cleanDesc = description
                .replace(/<[^>]*>/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 300);

            // Extract image from content or media
            let imageUrl: string | undefined;
            const content = item.content || '';
            const imgMatch = content.match(/<img[^>]+src="([^"]+)"/);
            if (imgMatch) imageUrl = imgMatch[1];

            // Fallback for media:content if available (some feeds use this)
            if (!imageUrl && (item as any).enclosure?.url) {
                imageUrl = (item as any).enclosure.url;
            }

            articles.push({
                id: generateId(item.link),
                title: item.title.trim(),
                description: cleanDesc || item.title.trim(),
                url: item.link,
                imageUrl,
                source: feed.name,
                category: categorizeArticle(item.title, cleanDesc),
                publishedAt: item.isoDate || item.pubDate || new Date().toISOString(),
                scrapedAt: new Date().toISOString(),
            });
        }

        return articles;
    } catch (error: any) {
        console.error(`Error fetching RSS from ${feed.name}:`, error.message || error);
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
            const sourceArticles = result.value;
            console.log(`Scraped ${sourceArticles.length} articles from source.`);
            allArticles.push(...sourceArticles);
        } else {
            console.error('Scraper source promise rejected:', result.reason);
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
