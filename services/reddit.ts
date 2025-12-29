import { RedditPost } from '../types';

export const fetchTopMemes = async (subreddits: string[]): Promise<RedditPost[]> => {
  const allPosts: RedditPost[] = [];
  
  const promises = subreddits.map(async (sub) => {
    try {
      // For Reddit API, we usually don't need a proxy if using .json, but sometimes we do in strict browsers.
      const response = await fetch(`https://www.reddit.com/r/${sub}/top.json?t=day&limit=10`, {
        headers: {
            'User-Agent': 'MemeCuratorBot/1.0'
        }
      });
      if (!response.ok) return [];
      
      const data = await response.json();
      const posts = data.data.children
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((child: any) => child.data)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((post: any) => {
          return (
            !post.is_self &&
            !post.is_video &&
            (post.url.endsWith('.jpg') || post.url.endsWith('.png') || post.url.endsWith('.jpeg'))
          );
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((post: any): RedditPost => ({
          id: post.id,
          title: post.title,
          url: post.url,
          subreddit: post.subreddit,
          ups: post.ups,
          permalink: `https://reddit.com${post.permalink}`,
          author: post.author
        }));
        
      return posts;
    } catch (e) {
      console.error(`Error fetching r/${sub}`, e);
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(posts => allPosts.push(...posts));
  
  return allPosts.sort((a, b) => b.ups - a.ups).slice(0, 20); 
};

export const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
  try {
    // Detect if running in a browser environment
    const isBrowser = typeof window !== 'undefined' && typeof (globalThis as any).process === 'undefined';
    
    let fetchUrl = url;

    // In the browser, we MUST use a proxy to bypass CORS restrictions.
    if (isBrowser) {
        // Try corsproxy.io without encoding first (common pattern)
        fetchUrl = `https://corsproxy.io/?${url}`;
    }

    let response = await fetch(fetchUrl, {
        headers: { 'User-Agent': 'MemeCuratorBot/1.0' }
    });

    // Fallback if first proxy fails
    if (isBrowser && !response.ok) {
        console.warn(`Primary proxy failed for ${url}, trying fallback...`);
        fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        response = await fetch(fetchUrl);
    }

    if (!response.ok) {
        console.warn(`Failed to fetch image: ${response.status} (URL: ${url})`);
        return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Universal Base64 check
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (globalThis as any).Buffer !== 'undefined') {
        // Node.js environment
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (globalThis as any).Buffer.from(arrayBuffer).toString('base64');
    } else {
        // Browser environment
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
  } catch (e) {
    console.error("Failed to convert image to base64", e);
    return null;
  }
};