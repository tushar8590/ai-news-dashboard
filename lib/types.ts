export interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl?: string;
  source: string;
  category: Category;
  publishedAt: string;
  scrapedAt: string;
}

export type Category =
  | 'software_engineering'
  | 'content_generation'
  | 'video_media'
  | 'education'
  | 'research'
  | 'business'
  | 'general';

export const CATEGORY_LABELS: Record<Category, string> = {
  software_engineering: 'Software Engineering',
  content_generation: 'Content Generation',
  video_media: 'Video & Media',
  education: 'Education',
  research: 'Research',
  business: 'Business & Industry',
  general: 'General AI',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  software_engineering: '💻',
  content_generation: '✍️',
  video_media: '🎬',
  education: '🎓',
  research: '🔬',
  business: '💼',
  general: '🤖',
};
