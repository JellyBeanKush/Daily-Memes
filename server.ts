import * as http from 'http';
import { fetchTopMemes } from './services/reddit';
import { postToDiscord, getRecentDislikes } from './services/discord';
import { AppConfig, UserHistory, ScoredMeme } from './types';
import * as fs from 'fs';
import * as path from 'path';

// --- Configuration ---
const CONFIG: AppConfig = {
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
    console.log(`[${new Date().toISOString()}] Starting Bot Cycle (Top Meme Mode)...`);
    
    if (!CONFIG.discordBotToken || !CONFIG.discordChannelId) {
        console.error("Missing Environment Variables (DISCORD_TOKEN, DISCORD_CHANNEL_ID)");
        return;
    }

    let history = loadHistory();

    // 1. Sync Dislikes from Discord Reactions (Optional now since we aren't analyzing, but good for tracking)
    // We keep this to maintain data integrity but it won't affect selection in this simplified mode
    try {
        await getRecentDislikes(CONFIG.discordBotToken, CONFIG.discordChannelId);
    } catch (e) { 
        // ignore errors here 
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

    // 3. Select ONLY the #1 Top Meme
    const candidate = freshMemes[0];
    console.log(`Selected Top Candidate: ${candidate.title} (Ups: ${candidate.ups})`);
    
    // Direct Post
    const meme: ScoredMeme = { ...candidate, status: 'posted' };
    const success = await postToDiscord(CONFIG.discordBotToken, CONFIG.discordChannelId, meme);
    
    if (success) {
        console.log("Posted successfully.");
    } else {
        console.error("Failed to post to Discord.");
    }
    
    // Always mark as processed so we don't duplicate
    history.postedIds.push(candidate.id);
    history.lastRunDate = new Date().toISOString();
    saveHistory(history);
    
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
    
    // Run every hour
    setInterval(runCycle, 1000 * 60 * 60); 
});