import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../types';

export const analyzeMeme = async (apiKey: string, base64Image: string, title: string, avoidTopics: string[] = []): Promise<AnalysisResult> => {
  const avoidInstruction = avoidTopics.length > 0 
    ? `CRITICAL: The user has specifically expressed dislike for memes with the following themes or elements: ${avoidTopics.join(', ')}. Do NOT approve memes that match these descriptions.` 
    : '';

  const SYSTEM_INSTRUCTION = `
You are a highly culturally aware and humorous content moderator for a Discord community. 
Your job is to curate memes.

We are looking for:
1. Actually funny content.
2. Wholesome or relatable humor.
3. Left-leaning political memes are ACCEPTABLE and welcome if they are funny.

We STRICTLY REJECT:
1. Right-wing political propaganda or memes.
2. Mean-spirited, bullying, or punch-down humor.
3. Racism, sexism, homophobia, or transphobia.
4. Unfunny, low-effort trash.

${avoidInstruction}

Analyze the image provided. Rate the humor from 1-10.
Return a JSON object with your verdict.
`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    // Using gemini-2.5-flash-preview for speed and multimodal capabilities
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview',
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                isAppropriate: { type: Type.BOOLEAN },
                humorScore: { type: Type.NUMBER, description: "Score from 1 to 10" },
                refusalReason: { type: Type.STRING, description: "Why it was rejected (optional)" },
                explanation: { type: Type.STRING, description: "Brief analysis of the meme" },
                politicalLeaning: { type: Type.STRING, enum: ['left', 'right', 'neutral', 'unknown'] }
            },
            required: ["isAppropriate", "humorScore", "explanation"]
        }
      },
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Image
            }
          },
          {
            text: `Title: ${title}. Analyze this meme.`
          }
        ]
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      isAppropriate: false,
      humorScore: 0,
      explanation: "AI Analysis failed.",
      refusalReason: "Technical Error"
    };
  }
};
