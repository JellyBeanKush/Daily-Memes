import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Bot, Activity, PauseCircle, PlayCircle, Terminal } from 'lucide-react';
import { AppConfig, ScoredMeme, AnalysisStatus, UserHistory } from './types';
import ConfigModal from './components/ConfigModal';
import MemeCard from './components/MemeCard';
import { fetchTopMemes, fetchImageAsBase64 } from './services/reddit';
import { analyzeMeme } from './services/gemini';
import { postToDiscord, getRecentDislikes } from './services/discord';

const CONFIG_KEY = 'meme_curator_config';
const HISTORY_KEY = 'meme_curator_history';

const DEFAULT_HISTORY: UserHistory = {
  postedIds: [],
  dislikedTopics: [],
  lastRunDate: null
};

const App: React.FC = () => {
  const [config, setConfig] = useState<AppConfig>({
    geminiApiKey: '',
    discordBotToken: '',
    discordChannelId: '',
    subreddits: ['memes', 'wholesomememes', 'me_irl', '196', 'ProgrammerHumor', 'BlackPeopleTwitter']
  });
  
  const [history, setHistory] = useState<UserHistory>(DEFAULT_HISTORY);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // App State
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [logs, setLogs] = useState<string[]>([]);
  const [postedMemes, setPostedMemes] = useState<ScoredMeme[]>([]);
  const [isAutoPilot, setIsAutoPilot] = useState(false);
  
  // Refs
  const intervalRef = useRef<number | undefined>(undefined);

  // Load persistence
  useEffect(() => {
    const savedConfig = localStorage.getItem(CONFIG_KEY);
    const savedHistory = localStorage.getItem(HISTORY_KEY);
    
    if (savedConfig) setConfig(JSON.parse(savedConfig));
    else setIsConfigOpen(true);

    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 50)]);
  };

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig);
    localStorage.setItem(CONFIG_KEY, JSON.stringify(newConfig));
    addLog("Configuration updated.");
  };

  const syncDislikesFromDiscord = async () => {
     if (!config.discordBotToken || !config.discordChannelId) return;
     const newDislikes = await getRecentDislikes(config.discordBotToken, config.discordChannelId);
     if (newDislikes.length > 0) {
         setHistory(prev => {
             const combined = [...new Set([...prev.dislikedTopics, ...newDislikes])];
             if (combined.length > prev.dislikedTopics.length) {
                 addLog(`Synced ${combined.length - prev.dislikedTopics.length} new dislikes from Discord reactions.`);
             }
             return { ...prev, dislikedTopics: combined.slice(-20) };
         });
     }
  };

  const runAutoPilotCycle = async () => {
    if (!config.geminiApiKey || !config.discordBotToken) {
      addLog("Missing Config. Stopping.");
      setIsAutoPilot(false);
      return;
    }

    if (status !== AnalysisStatus.IDLE && status !== AnalysisStatus.COMPLETE && status !== AnalysisStatus.ERROR) return;

    setStatus(AnalysisStatus.FETCHING_REDDIT);
    addLog("Starting curation cycle...");

    // Sync dislikes first
    await syncDislikesFromDiscord();

    try {
        const rawMemes = await fetchTopMemes(config.subreddits);
        const freshMemes = rawMemes.filter(m => !history.postedIds.includes(m.id));
        
        if (freshMemes.length === 0) {
            addLog("No fresh memes found.");
            setStatus(AnalysisStatus.IDLE);
            return;
        }

        setStatus(AnalysisStatus.ANALYZING_IMAGES);
        
        let bestMeme: ScoredMeme | null = null;
        const candidates = freshMemes.slice(0, 5); 

        for (const candidate of candidates) {
            // Rate limit guard
            addLog(`Waiting 10s to respect API rate limits...`);
            await new Promise(resolve => setTimeout(resolve, 10000));

            addLog(`Analyzing: ${candidate.title}...`);
            const base64 = await fetchImageAsBase64(candidate.url);
            
            if (!base64) {
                addLog(`Failed to load image for ${candidate.title}`);
                continue;
            }

            const analysis = await analyzeMeme(config.geminiApiKey, base64, candidate.title, history.dislikedTopics);
            
            if (analysis.isAppropriate && analysis.humorScore >= 7) {
                bestMeme = { ...candidate, analysis, status: 'analyzed' };
                break; // Found one!
            } else {
                addLog(`Rejected: ${analysis.refusalReason || 'Low score'}`);
            }
        }

        if (bestMeme) {
            setStatus(AnalysisStatus.POSTING);
            addLog(`Posting "${bestMeme.title}"...`);
            const success = await postToDiscord(config.discordBotToken, config.discordChannelId, bestMeme);
            
            if (success) {
                const posted = { ...bestMeme, status: 'posted' as const, postedAt: Date.now() };
                setPostedMemes(prev => [posted, ...prev]);
                setHistory(prev => ({
                    ...prev,
                    postedIds: [...prev.postedIds, bestMeme!.id],
                    lastRunDate: new Date().toISOString()
                }));
                addLog("Success! Meme posted.");
            } else {
                addLog("Failed to post to Discord.");
            }
        } else {
            addLog("No suitable memes found in this batch.");
        }

    } catch (e) {
        console.error(e);
        addLog("Error during cycle.");
        setStatus(AnalysisStatus.ERROR);
    } finally {
        setStatus(AnalysisStatus.IDLE);
    }
  };

  // Toggle AutoPilot
  useEffect(() => {
    if (isAutoPilot) {
        addLog("Auto-Pilot Enabled. Running cycle...");
        runAutoPilotCycle(); // Run immediately
        intervalRef.current = window.setInterval(runAutoPilotCycle, 1000 * 60 * 60); // Then every hour
    } else {
        clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isAutoPilot]);

  return (
    <div className="min-h-screen bg-[#1e1f22] text-gray-200 font-sans flex flex-col">
      <ConfigModal 
        isOpen={isConfigOpen} 
        onClose={() => setIsConfigOpen(false)} 
        config={config} 
        onSave={handleSaveConfig} 
      />

      {/* Header */}
      <header className="bg-[#2b2d31] border-b border-[#1e1f22] p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${isAutoPilot ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}>
               <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white tracking-tight">Meme Curator AI</h1>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                 {isAutoPilot ? 'Running in Auto-Pilot' : 'Standby Mode'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsAutoPilot(!isAutoPilot)}
                className={`px-4 py-2 rounded-md font-bold text-sm flex items-center gap-2 transition-all ${isAutoPilot ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-green-600 text-white hover:bg-green-700'}`}
             >
                {isAutoPilot ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                {isAutoPilot ? 'Stop Bot' : 'Start Bot'}
             </button>

            <button 
              onClick={() => setIsConfigOpen(true)}
              className="p-2 hover:bg-[#3f4147] rounded-full transition-colors"
              title="Settings"
            >
              <SettingsIcon className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto p-6 w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Logs Console */}
        <div className="lg:col-span-1 bg-[#111214] rounded-lg border border-[#1e1f22] flex flex-col h-[500px] lg:h-auto">
            <div className="p-3 border-b border-[#1e1f22] flex items-center gap-2 text-xs font-mono text-gray-400 uppercase tracking-wider">
                <Terminal className="w-4 h-4" /> System Logs
            </div>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-1">
                {logs.length === 0 && <span className="text-gray-600 italic">System ready...</span>}
                {logs.map((log, i) => (
                    <div key={i} className="text-gray-300 border-b border-gray-800/50 pb-1 mb-1">{log}</div>
                ))}
            </div>
        </div>

        {/* Feed */}
        <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-400" />
                Live Feed
            </h2>
            {postedMemes.length === 0 ? (
                <div className="bg-[#2b2d31] rounded p-8 text-center text-gray-500">
                    No memes posted in this session yet. Start the bot!
                </div>
            ) : (
                <div className="space-y-4">
                    {postedMemes.map(meme => (
                        <div key={meme.id} className="h-48">
                            <MemeCard 
                                meme={meme} 
                                onDislike={(m) => {
                                    setHistory(prev => ({
                                        ...prev,
                                        dislikedTopics: [...prev.dislikedTopics, `Manual dislike: ${m.title}`]
                                    }));
                                    addLog(`Manually disliked ${m.title}`);
                                    setPostedMemes(curr => curr.filter(x => x.id !== m.id));
                                }} 
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>

      </main>
    </div>
  );
};

export default App;
