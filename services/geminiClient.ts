import { GoogleGenAI } from "@google/genai";

let ai: GoogleGenAI | null = null;

export const initializeGeminiClient = (apiKey: string) => {
    if (!apiKey) {
        throw new Error("API key is required to initialize Gemini Client");
    }
    // Re-initialize if key changes
    ai = new GoogleGenAI({ apiKey });
};

export const getGeminiClient = (): GoogleGenAI => {
    if (!ai) {
        throw new Error("Gemini Client not initialized. Please ensure you are logged in and have provided an API key.");
    }
    return ai;
};

export const clearGeminiClient = () => {
    ai = null;
};
