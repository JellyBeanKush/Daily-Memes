import * as http from 'http';
import { fetchTopMemes, fetchImageAsBase64 } from './services/reddit';
import { analyzeMeme } from './services/gemini';
import { postToDiscord, getRecentDislikes } from './services/discord';
import { AppConfig, UserHistory, ScoredMeme } from './types';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const CONFIG: AppConfig = {
    geminiApiKey: process.env.API_KEY || '',
    discordBotToken: process.env.DISCORD_TOKEN || '',
    discordChannelId: process.env.DISCORD_CHANNEL_ID || '',
    subreddits: (process.env.SUBREDDITS || 'memes,wholesomememes,me_irl,196').split(',')
};

const DATA_FILE = path.join((process as any).cwd(), 'data', 'history.json');

// Ensure data dir exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// --- Persistence ---
const loadHistory = (): UserHistory => {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
        }
    } catch (e) {
        console.error("Failed to load history", e);
    }
    return { postedIds: [], dislikedTopics: [], lastRunDate: null };
};

const saveHistory = (history: UserHistory) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(history, null, 2));
    } catch (e) {
        console.error("Failed to save history", e);
    }
};

// --- Bot Logic ---
const runCycle = async () => {
    console.log(`[${new Date().toISOString()}] Starting Bot Cycle...`);
    
    if (!CONFIG.geminiApiKey || !CONFIG.discordBotToken || !CONFIG.discordChannelId) {
        console.error("Missing Environment Variables (API_KEY, DISCORD_TOKEN, DISCORD_CHANNEL_ID)");
        return;
    }

    let history = loadHistory();

    // 1. Sync Dislikes from Discord Reactions
    console.log("Syncing dislikes from Discord...");
    const newDislikes = await getRecentDislikes(CONFIG.discordBotToken, CONFIG.discordChannelId);
    if (newDislikes.length > 0) {
        const unique = [...new Set([...history.dislikedTopics, ...newDislikes])].slice(-20);
        history.dislikedTopics = unique;
        console.log(`Updated dislikes list. Count: ${unique.length}`);
    }

    // 2. Fetch Candidates
    console.log("Fetching Reddit candidates...");
    const rawMemes = await fetchTopMemes(CONFIG.subreddits);
    const freshMemes = rawMemes.filter(m => !history.postedIds.includes(m.id));

    if (freshMemes.length === 0) {
        console.log("No new memes found.");
        saveHistory(history);
        return;
    }

    // 3. Analyze and Post ONE meme
    for (const candidate of freshMemes.slice(0, 5)) {
        console.log(`Analyzing: ${candidate.title}`);
        
        // Rate Limit Guard: Wait 10 seconds before hitting Gemini API to avoid 429 errors
        await new Promise(resolve => setTimeout(resolve, 10000));

        const base64 = await fetchImageAsBase64(candidate.url);

        if (!base64) continue;

        const analysis = await analyzeMeme(CONFIG.geminiApiKey, base64, candidate.title, history.dislikedTopics);

        if (analysis.isAppropriate && analysis.humorScore >= 7) {
            console.log(`Approved! Score: ${analysis.humorScore}. Posting...`);
            const meme: ScoredMeme = { ...candidate, analysis, status: 'posted' };
            
            const success = await postToDiscord(CONFIG.discordBotToken, CONFIG.discordChannelId, meme);
            
            if (success) {
                history.postedIds.push(candidate.id);
                history.lastRunDate = new Date().toISOString();
                saveHistory(history);
                console.log("Posted successfully.");
                break; // Stop after posting one
            } else {
                console.error("Failed to post to Discord.");
            }
        } else {
            console.log(`Rejected. Reason: ${analysis.refusalReason || 'Low Score'}`);
        }
    }
    
    console.log("Cycle Complete.");
};

// --- Server & Schedule ---
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Meme Curator Bot is Running');
});

server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Run immediately on start
    runCycle();
    
    // Then run every hour
    setInterval(runCycle, 1000 * 60 * 60); 
});
