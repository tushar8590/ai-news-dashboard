'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Article, Category, CATEGORY_LABELS, CATEGORY_ICONS } from '@/lib/types';

type Tab = 'home' | 'search' | 'trending' | 'bookmarks';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Article[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [trending, setTrending] = useState<{ keyword: string; count: number }[]>([]);
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-pulse-theme');
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
      document.documentElement.setAttribute('data-theme', saved);
    }
  }, []);

  // Load bookmarks from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ai-pulse-bookmarks');
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch { /* ignore */ }
    }
  }, []);

  // Scroll listener
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Initial load: trigger scrape then fetch articles
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        // Trigger a scrape first
        await fetch('/api/scrape');
        // Then fetch articles
        const res = await fetch('/api/articles?page=1&limit=20');
        const data = await res.json();
        setArticles(data.articles || []);
        setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1));
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch trending
  useEffect(() => {
    if (activeTab === 'trending') {
      fetch('/api/trending')
        .then((r) => r.json())
        .then((d) => setTrending(d.trending || []))
        .catch(console.error);
    }
  }, [activeTab]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetch('/api/scrape');
      const res = await fetch('/api/articles?page=1&limit=20');
      const data = await res.json();
      setArticles(data.articles || []);
      setPage(1);
      setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Load more
  const loadMore = useCallback(async () => {
    const nextPage = page + 1;
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: '20' });
      if (activeCategory !== 'all') params.set('category', activeCategory);
      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();
      setArticles((prev) => [...prev, ...(data.articles || [])]);
      setPage(nextPage);
      setHasMore(nextPage < (data.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Load more error:', err);
    }
  }, [page, activeCategory]);

  // Category filter
  const handleCategoryChange = useCallback(async (cat: string) => {
    setActiveCategory(cat);
    setLoading(true);
    setPage(1);
    try {
      const params = new URLSearchParams({ page: '1', limit: '20' });
      if (cat !== 'all') params.set('category', cat);
      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setHasMore((data.pagination?.page || 1) < (data.pagination?.totalPages || 1));
    } catch (err) {
      console.error('Filter error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Search with debounce
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSearchResults(data.articles || []);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  // Bookmark toggle
  const toggleBookmark = useCallback((article: Article) => {
    setBookmarks((prev) => {
      const exists = prev.some((a) => a.id === article.id);
      const next = exists ? prev.filter((a) => a.id !== article.id) : [article, ...prev];
      localStorage.setItem('ai-pulse-bookmarks', JSON.stringify(next));
      return next;
    });
  }, []);

  const isBookmarked = useCallback(
    (id: string) => bookmarks.some((a) => a.id === id),
    [bookmarks]
  );

  // Theme toggle
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('ai-pulse-theme', next);
      return next;
    });
  }, []);

  // Format date
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // Article card component
  function renderArticleCard(article: Article, index: number) {
    return (
      <div
        key={article.id}
        className="article-card fade-in"
        style={{ animationDelay: `${index * 50}ms` }}
        onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
      >
        <div className="article-meta">
          <span className={`category-badge ${article.category}`}>
            {CATEGORY_ICONS[article.category]} {CATEGORY_LABELS[article.category]}
          </span>
          <span className="article-source">{article.source}</span>
        </div>
        <h3 className="article-title">{article.title}</h3>
        {article.description && article.description !== article.title && (
          <p className="article-description">{article.description}</p>
        )}
        <div className="article-footer">
          <span className="article-date">{formatDate(article.publishedAt)}</span>
          <button
            className={`bookmark-btn ${isBookmarked(article.id) ? 'bookmarked' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(article);
            }}
            aria-label={isBookmarked(article.id) ? 'Remove bookmark' : 'Bookmark'}
          >
            {isBookmarked(article.id) ? '★' : '☆'}
          </button>
        </div>
      </div>
    );
  }

  // Skeleton loader
  function renderSkeleton(count: number = 5) {
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton skeleton-card" />
    ));
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="header-brand">
            <div className="header-logo">⚡</div>
            <div>
              <div className="header-title">AI Pulse</div>
              <div className="header-subtitle">Latest AI News & Trends</div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="desktop-nav">
            {(['home', 'search', 'trending', 'bookmarks'] as Tab[]).map((tab) => (
              <button
                key={tab}
                className={`desktop-nav-item ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'home' && '🏠 Feed'}
                {tab === 'search' && '🔍 Search'}
                {tab === 'trending' && '🔥 Trending'}
                {tab === 'bookmarks' && `★ Saved (${bookmarks.length})`}
              </button>
            ))}
          </nav>

          <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </header>

      {/* Page Content */}
      <main className="page-content">
        {/* ===== HOME TAB ===== */}
        {activeTab === 'home' && (
          <>
            {/* Category chips */}
            <div className="chips-container">
              <button
                className={`chip ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => handleCategoryChange('all')}
              >
                <span className="chip-emoji">🤖</span> All
              </button>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                <button
                  key={cat}
                  className={`chip ${activeCategory === cat ? 'active' : ''}`}
                  onClick={() => handleCategoryChange(cat)}
                >
                  <span className="chip-emoji">{CATEGORY_ICONS[cat]}</span>{' '}
                  {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>

            {/* Refresh bar */}
            <div className="refresh-bar">
              <span className="last-updated">
                {articles.length > 0 ? `${articles.length} articles` : ''}
              </span>
              <button
                className={`refresh-btn ${refreshing ? 'loading' : ''}`}
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <span className="refresh-icon">↻</span>
                {refreshing ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            {/* Articles */}
            {loading ? (
              renderSkeleton()
            ) : articles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📡</div>
                <div className="empty-title">No articles yet</div>
                <div className="empty-text">
                  Hit refresh to fetch the latest AI news
                </div>
              </div>
            ) : (
              <>
                {articles.map((article, i) => renderArticleCard(article, i))}
                {hasMore && (
                  <button
                    className="refresh-btn"
                    onClick={loadMore}
                    style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                  >
                    Load More
                  </button>
                )}
              </>
            )}
          </>
        )}

        {/* ===== SEARCH TAB ===== */}
        {activeTab === 'search' && (
          <div className="search-container">
            <h1 className="page-title">Search</h1>
            <p className="page-subtitle">Find articles across all sources</p>
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                className="search-input"
                placeholder="Search AI news..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
            </div>
            {searchLoading ? (
              renderSkeleton(3)
            ) : searchQuery.length >= 2 && searchResults.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No results found</div>
                <div className="empty-text">Try a different search term</div>
              </div>
            ) : (
              searchResults.map((article, i) => renderArticleCard(article, i))
            )}
          </div>
        )}

        {/* ===== TRENDING TAB ===== */}
        {activeTab === 'trending' && (
          <>
            <h1 className="page-title">Trending</h1>
            <p className="page-subtitle">Hot topics in AI right now</p>
            {trending.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔥</div>
                <div className="empty-title">No trending data yet</div>
                <div className="empty-text">
                  Trending keywords appear after articles are scraped
                </div>
              </div>
            ) : (
              <div className="trending-grid">
                {trending.map((t) => (
                  <button
                    key={t.keyword}
                    className="trending-chip"
                    onClick={() => {
                      setSearchQuery(t.keyword);
                      handleSearch(t.keyword);
                      setActiveTab('search');
                    }}
                  >
                    {t.keyword} <span className="count">{t.count}</span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ marginTop: '24px' }}>
              <h2 className="section-title">📰 Recent from All Categories</h2>
              {articles.slice(0, 10).map((article, i) => renderArticleCard(article, i))}
            </div>
          </>
        )}

        {/* ===== BOOKMARKS TAB ===== */}
        {activeTab === 'bookmarks' && (
          <>
            <h1 className="page-title">Saved</h1>
            <p className="page-subtitle">
              {bookmarks.length} bookmarked article{bookmarks.length !== 1 && 's'}
            </p>
            {bookmarks.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">★</div>
                <div className="empty-title">No saved articles</div>
                <div className="empty-text">
                  Tap the star icon on any article to save it here
                </div>
              </div>
            ) : (
              bookmarks.map((article, i) => (
                <div key={article.id} className="article-card fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="article-meta">
                    <span className={`category-badge ${article.category}`}>
                      {CATEGORY_ICONS[article.category]} {CATEGORY_LABELS[article.category]}
                    </span>
                    <span className="article-source">{article.source}</span>
                  </div>
                  <h3
                    className="article-title"
                    onClick={() => window.open(article.url, '_blank', 'noopener,noreferrer')}
                    style={{ cursor: 'pointer' }}
                  >
                    {article.title}
                  </h3>
                  <div className="article-footer">
                    <span className="article-date">{formatDate(article.publishedAt)}</span>
                    <button className="remove-btn" onClick={() => toggleBookmark(article)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="bottom-nav">
        <div className="bottom-nav-inner">
          <button
            className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <span className="nav-icon">🏠</span>
            <span className="nav-label">Feed</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <span className="nav-icon">🔍</span>
            <span className="nav-label">Search</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'trending' ? 'active' : ''}`}
            onClick={() => setActiveTab('trending')}
          >
            <span className="nav-icon">🔥</span>
            <span className="nav-label">Trending</span>
          </button>
          <button
            className={`nav-item ${activeTab === 'bookmarks' ? 'active' : ''}`}
            onClick={() => setActiveTab('bookmarks')}
          >
            <span className="nav-icon">★</span>
            <span className="nav-label">Saved</span>
          </button>
        </div>
      </nav>

      {/* Scroll to top button */}
      <button
        className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`}
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        aria-label="Scroll to top"
      >
        ↑
      </button>
    </div>
  );
}
