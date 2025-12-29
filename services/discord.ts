import { ScoredMeme } from '../types';

const BASE_URL = 'https://discord.com/api/v10';
const PROXY_URL = 'https://corsproxy.io/?';

const getFetchUrl = (endpoint: string): string => {
    const isBrowser = typeof window !== 'undefined' && typeof (globalThis as any).process === 'undefined';
    const target = `${BASE_URL}${endpoint}`;
    // In browser, we must use a proxy. 
    // passing the raw URL often works better for corsproxy.io than encoded components in some contexts
    return isBrowser ? `${PROXY_URL}${target}` : target;
};

export const postToDiscord = async (botToken: string, channelId: string, meme: ScoredMeme): Promise<boolean> => {
  if (!botToken || !channelId) return false;

  const payload = {
    content: `**${meme.title}**\n*Top trend from r/${meme.subreddit}*`,
    embeds: [
      {
        image: {
          url: meme.url,
        },
        footer: {
          text: `Upvotes: ${meme.ups} • Posted via Meme Curator`
        },
        color: 5814783 // Discord Blurple-ish
      },
    ],
  };

  try {
    const url = getFetchUrl(`/channels/${channelId}/messages`);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Discord API Error:", err);
    }

    return response.ok;
  } catch (error) {
    console.error("Failed to post to Discord", error);
    return false;
  }
};

export const getRecentDislikes = async (botToken: string, channelId: string): Promise<string[]> => {
    if (!botToken || !channelId) return [];

    try {
        // Fetch last 20 messages
        const url = getFetchUrl(`/channels/${channelId}/messages?limit=20`);
        const response = await fetch(url, {
            headers: {
                "Authorization": `Bot ${botToken}`,
            },
        });

        if (!response.ok) {
            // Silently fail in browser if proxy isn't working for GET, to avoid spamming logs
            return [];
        }

        const messages = await response.json();
        const dislikes: string[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages.forEach((msg: any) => {
            // Check for negative reactions (X, thumbs down, vomit, etc)
            const hasNegativeReaction = msg.reactions?.some((r: any) => 
                ['❌', '👎', '💩', '🤮', 'x_'].includes(r.emoji.name)
            );

            if (hasNegativeReaction && msg.author.bot) {
                // Extract the description to avoid
                if (msg.embeds?.[0]?.footer?.text) {
                    dislikes.push(msg.embeds[0].footer.text);
                } else {
                    dislikes.push(msg.content);
                }
            }
        });

        return dislikes;
    } catch (e) {
        // Suppress full error stack in console for cleaner logs during polling
        console.warn("Could not check Discord reactions (likely network/CORS issue)");
        return [];
    }
};