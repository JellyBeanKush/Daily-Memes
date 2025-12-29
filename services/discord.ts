import { ScoredMeme } from '../types';

const BASE_URL = 'https://discord.com/api/v10';

export const postToDiscord = async (botToken: string, channelId: string, meme: ScoredMeme): Promise<boolean> => {
  if (!botToken || !channelId) return false;

  const payload = {
    content: `**${meme.title}**\n*Curated from r/${meme.subreddit} (Score: ${meme.analysis?.humorScore}/10)*`,
    embeds: [
      {
        image: {
          url: meme.url,
        },
        footer: {
          text: `AI Analysis: ${meme.analysis?.explanation.substring(0, 100)}...`
        },
        color: 5814783 // Discord Blurple-ish
      },
    ],
  };

  try {
    const response = await fetch(`${BASE_URL}/channels/${channelId}/messages`, {
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
        const response = await fetch(`${BASE_URL}/channels/${channelId}/messages?limit=20`, {
            headers: {
                "Authorization": `Bot ${botToken}`,
            },
        });

        if (!response.ok) return [];

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
        console.error("Failed to check reactions", e);
        return [];
    }
};