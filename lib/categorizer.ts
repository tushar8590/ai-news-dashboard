import { Category } from './types';

const CATEGORY_KEYWORDS: Record<Category, string[]> = {
    software_engineering: [
        'code', 'coding', 'programming', 'developer', 'software', 'ide', 'copilot',
        'github', 'devops', 'api', 'debug', 'compiler', 'agent', 'agentic',
        'vscode', 'cursor', 'engineering', 'deploy', 'infrastructure', 'backend',
        'frontend', 'fullstack', 'refactor', 'testing', 'ci/cd', 'devin',
        'windsurf', 'codegen', 'autocomplete', 'lint', 'sdk', 'framework',
    ],
    content_generation: [
        'image', 'text', 'writing', 'art', 'creative', 'generative', 'dall-e',
        'midjourney', 'stable diffusion', 'content', 'generate', 'prompt',
        'chatgpt', 'claude', 'gemini', 'gpt', 'llm', 'language model',
        'copywriting', 'blog', 'article', 'design', 'illustration', 'music',
        'audio', 'voice', 'synthetic', 'flux', 'imagen',
    ],
    video_media: [
        'video', 'sora', 'animation', 'deepfake', 'synthesis', 'film',
        'cinema', 'veo', 'kling', 'runway', 'pika', 'luma', 'streaming',
        'visual effects', 'vfx', 'motion', 'clip', 'youtube', 'tiktok',
    ],
    education: [
        'learning', 'tutor', 'student', 'course', 'classroom', 'teach',
        'education', 'school', 'university', 'curriculum', 'training',
        'skill', 'certification', 'academy', 'lecture', 'mooc', 'khan',
        'duolingo', 'personalized learning', 'adaptive',
    ],
    research: [
        'paper', 'model', 'benchmark', 'transformer', 'arxiv', 'neural',
        'deep learning', 'machine learning', 'dataset', 'training',
        'fine-tune', 'parameters', 'weights', 'inference', 'architecture',
        'attention', 'diffusion', 'reinforcement', 'rl', 'rlhf', 'dpo',
        'alignment', 'safety', 'interpretability', 'scaling', 'token',
        'multimodal', 'foundation model', 'open source', 'hugging face',
        'openai', 'anthropic', 'google deepmind', 'meta ai',
    ],
    business: [
        'startup', 'funding', 'enterprise', 'market', 'revenue', 'valuation',
        'acquisition', 'ipo', 'investor', 'venture', 'billion', 'million',
        'company', 'ceo', 'launch', 'product', 'saas', 'b2b', 'regulation',
        'policy', 'governance', 'ethics', 'layoff', 'hiring', 'partnership',
    ],
    general: [],
};

export function categorizeArticle(title: string, description: string): Category {
    const text = `${title} ${description}`.toLowerCase();
    let bestCategory: Category = 'general';
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (category === 'general') continue;
        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestCategory = category as Category;
        }
    }

    return bestCategory;
}
