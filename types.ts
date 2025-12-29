export interface AppConfig {
  discordBotToken: string;
  discordChannelId: string;
  subreddits: string[];
}

export interface UserHistory {
  postedIds: string[];
  dislikedTopics: string[];
  lastRunDate: string | null;
}

export interface RedditPost {
  id: string;
  title: string;
  url: string;
  subreddit: string;
  ups: number;
  permalink: string;
  author: string;
}

export interface AnalysisResult {
  isAppropriate: boolean;
  humorScore: number; // 1-10
  refusalReason?: string;
  explanation: string;
  politicalLeaning?: 'left' | 'right' | 'neutral' | 'unknown';
}

export interface ScoredMeme extends RedditPost {
  analysis?: AnalysisResult;
  status: 'pending' | 'analyzing' | 'analyzed' | 'posted' | 'failed' | 'rejected' | 'skipped';
  base64Image?: string;
  error?: string;
  postedAt?: number;
}

export enum AnalysisStatus {
  IDLE = 'IDLE',
  FETCHING_REDDIT = 'FETCHING_REDDIT',
  ANALYZING_IMAGES = 'ANALYZING_IMAGES',
  POSTING = 'POSTING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}