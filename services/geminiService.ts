
import { GoogleGenAI, Type, GenerateContentResponse, Chat } from "@google/genai";
import { GEMINI_PROMPT } from '../constants';
import { getGeminiClient } from './geminiClient';

// A local interface to match the structure used in the components
interface ChatMessage {
  author: 'You' | 'AI';
  text: string;
}

export const getCleanMimeType = (blob: Blob): string => {
  let mimeType = blob.type;
  if (mimeType) {
    // Strip codec information, e.g., "audio/webm;codecs=opus" -> "audio/webm"
    mimeType = mimeType.split(';')[0];
    // Treat video/webm as audio/webm for our audio processing purposes
    if (mimeType === 'video/webm') {
      return 'audio/webm';
    }
    return mimeType;
  }
  // Default to audio/webm as per user's report that data is in WebM format
  return 'audio/webm';
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      // remove the data URL prefix part
      resolve(base64data.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const base64ToBlob = (base64: string, mimeType: string): Blob => {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (error) {
    console.error("Failed to convert base64 to Blob:", error);
    return new Blob([], { type: mimeType });
  }
};


export const processAudio = async (audioBlob: Blob, model: string): Promise<string> => {
  const ai = getGeminiClient();
  const base64Audio = await blobToBase64(audioBlob);

  const textPart = {
    text: GEMINI_PROMPT,
  };

  const audioPart = {
    inlineData: {
      mimeType: getCleanMimeType(audioBlob),
      data: base64Audio,
    },
  };
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: [textPart, audioPart] },
    });

    const transcript = response.text;
    if (!transcript) {
      throw new Error("API returned an empty response.");
    }

    return transcript.trim();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        throw new Error(`Failed to process audio: ${error.message}`);
    }
    throw new Error("An unknown error occurred while communicating with the API.");
  }
};

export const createChat = async (
  audioBlob: Blob, 
  initialTranscript: string, 
  model: string,
  existingHistory?: ChatMessage[] // Optional parameter for existing history
): Promise<Chat> => {
  const ai = getGeminiClient();
  const base64Audio = await blobToBase64(audioBlob);
  
  const userMessageParts = [
    {
      inlineData: {
        mimeType: getCleanMimeType(audioBlob),
        data: base64Audio,
      },
    },
    {
      text: `This is the audio I provided.`,
    }
  ];

  const modelResponsePart = { text: `This is the transcript you requested:\n\n${initialTranscript}` };

  const historyForGemini = [
    { role: 'user' as const, parts: userMessageParts },
    { role: 'model' as const, parts: [modelResponsePart] },
  ];

  // If there's an existing chat history, convert and append it
  if (existingHistory && existingHistory.length > 1) {
    // The first message in our app's history is the initial AI greeting with the transcript,
    // which is already covered by the context above. We only need to add the subsequent messages.
    const subsequentHistory = existingHistory.slice(1);
    const convertedHistory = subsequentHistory.map(msg => ({
      role: msg.author === 'You' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.text }],
    }));
    historyForGemini.push(...convertedHistory);
  }

  const chat = ai.chats.create({
    model: model,
    config: {
      systemInstruction: 'You are a helpful AI assistant. The user has provided an audio and you have transcribed it. Now, answer the user\'s follow-up questions based on the content of the audio and the transcript.',
    },
    history: historyForGemini,
  });
  return chat;
};
