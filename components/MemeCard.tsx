import React from 'react';
import { ScoredMeme } from '../types';
import { Check, ExternalLink, ThumbsDown } from 'lucide-react';

interface MemeCardProps {
  meme: ScoredMeme;
  onDislike: (meme: ScoredMeme) => void;
}

const MemeCard: React.FC<MemeCardProps> = ({ meme, onDislike }) => {
  if (meme.status !== 'posted') return null;

  return (
    <div className="bg-[#2b2d31] rounded-lg overflow-hidden border border-[#1e1f22] shadow-sm flex flex-col md:flex-row h-full">
      {/* Image Preview */}
      <div className="w-full md:w-48 h-48 bg-[#1e1f22] shrink-0 relative group">
        <img 
            src={meme.url} 
            alt={meme.title} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
            loading="lazy"
        />
         <a 
            href={meme.permalink} 
            target="_blank" 
            rel="noreferrer"
            className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 p-1 rounded text-white"
            title="Open Original"
        >
            <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <span className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-1 block">
                        Posted to Discord
                    </span>
                    <h3 className="font-semibold text-gray-200 line-clamp-1">{meme.title}</h3>
                    <p className="text-xs text-gray-500">r/{meme.subreddit}</p>
                </div>
                <div className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold border border-green-500/20 flex items-center gap-1">
                    <Check className="w-3 h-3" /> Ups: {meme.ups}
                </div>
            </div>
            
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
            <span className="text-xs text-gray-600">
                {meme.postedAt ? new Date(meme.postedAt).toLocaleString() : 'Just now'}
            </span>
            
            <button 
                onClick={() => onDislike(meme)}
                className="flex items-center gap-2 text-xs font-medium text-gray-500 hover:text-red-400 transition-colors group"
                title="Remove from local view"
            >
                <ThumbsDown className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Dismiss</span>
            </button>
        </div>
      </div>
    </div>
  );
};

export default MemeCard;