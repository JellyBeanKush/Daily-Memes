import React, { useState, useEffect } from 'react';
import { AppConfig } from '../types';
import { Settings, X, HelpCircle } from 'lucide-react';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AppConfig;
  onSave: (config: AppConfig) => void;
}

const DEFAULT_SUBREDDITS = ['memes', 'wholesomememes', 'me_irl', '196', 'ProgrammerHumor'];

const ConfigModal: React.FC<ConfigModalProps> = ({ isOpen, onClose, config, onSave }) => {
  const [formData, setFormData] = useState<AppConfig>(config);
  const [subredditInput, setSubredditInput] = useState('');

  useEffect(() => {
    setFormData(config);
  }, [config]);

  if (!isOpen) return null;

  const handleAddSubreddit = () => {
    if (subredditInput && !formData.subreddits.includes(subredditInput)) {
      setFormData(prev => ({
        ...prev,
        subreddits: [...prev.subreddits, subredditInput]
      }));
      setSubredditInput('');
    }
  };

  const handleRemoveSubreddit = (sub: string) => {
    setFormData(prev => ({
      ...prev,
      subreddits: prev.subreddits.filter(s => s !== sub)
    }));
  };

  const handleResetSubreddits = () => {
     setFormData(prev => ({
        ...prev,
        subreddits: DEFAULT_SUBREDDITS
      }));
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#313338] rounded-lg shadow-2xl w-full max-w-lg border border-[#1e1f22] text-[#dbdee1]">
        
        <div className="flex justify-between items-center p-6 border-b border-[#1e1f22]">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-400" />
            Configuration
          </h2>
          <button onClick={onClose} className="hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* Gemini API Key */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
              Gemini API Key
            </label>
            <input
              type="password"
              value={formData.geminiApiKey}
              onChange={(e) => setFormData({...formData, geminiApiKey: e.target.value})}
              placeholder="AIza..."
              className="w-full bg-[#1e1f22] border-none rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-600"
            />
          </div>

          {/* Discord Bot Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                Discord Bot Token
                </label>
                <input
                type="password"
                value={formData.discordBotToken}
                onChange={(e) => setFormData({...formData, discordBotToken: e.target.value})}
                placeholder="MTA..."
                className="w-full bg-[#1e1f22] border-none rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-600"
                />
            </div>
            <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
                Channel ID
                </label>
                <div className="flex gap-2">
                    <input
                    type="text"
                    value={formData.discordChannelId}
                    onChange={(e) => setFormData({...formData, discordChannelId: e.target.value})}
                    placeholder="1234567890..."
                    className="w-full bg-[#1e1f22] border-none rounded p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-white placeholder-gray-600"
                    />
                    <div className="group relative flex items-center">
                        <HelpCircle className="w-5 h-5 text-gray-500 cursor-help" />
                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-black text-xs p-2 rounded hidden group-hover:block z-10">
                            Right-click a channel in Discord and select "Copy Channel ID" (Developer Mode must be on).
                        </div>
                    </div>
                </div>
            </div>
          </div>

          {/* Subreddits */}
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase mb-2">
              Source Subreddits
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={subredditInput}
                onChange={(e) => setSubredditInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSubreddit()}
                placeholder="subreddit name"
                className="flex-1 bg-[#1e1f22] border-none rounded p-2 text-sm focus:ring-2 focus:ring-indigo-500 text-white"
              />
              <button 
                onClick={handleAddSubreddit}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 rounded font-medium text-sm transition-colors"
              >
                Add
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {formData.subreddits.map(sub => (
                <span key={sub} className="bg-[#2b2d31] text-xs px-2 py-1 rounded flex items-center gap-1 group border border-[#1e1f22]">
                  r/{sub}
                  <button onClick={() => handleRemoveSubreddit(sub)} className="text-gray-500 group-hover:text-red-400">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {formData.subreddits.length === 0 && (
                <button onClick={handleResetSubreddits} className="text-xs text-indigo-400 hover:underline">
                  Load Defaults
                </button>
              )}
            </div>
          </div>

        </div>

        <div className="p-6 bg-[#2b2d31] rounded-b-lg flex justify-end">
          <button
            onClick={() => {
              onSave(formData);
              onClose();
            }}
            disabled={!formData.geminiApiKey || !formData.discordBotToken}
            className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-6 py-2 rounded font-bold transition-all"
          >
            Save Settings
          </button>
        </div>

      </div>
    </div>
  );
};

export default ConfigModal;