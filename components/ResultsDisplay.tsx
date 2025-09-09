
import React, { useState } from 'react';
import ChatInterface from './ChatInterface';

interface ChatMessage {
  author: 'You' | 'AI';
  text: string;
}

interface ResultsDisplayProps {
  transcript: string;
  onReset: () => void;
  audioBlob: Blob | null;
  chatHistory: ChatMessage[];
  isChatting: boolean;
  onSendMessage: (message: string, audio?: Blob) => void;
  onSwitchToBatch: () => void;
  model: string;
  onReprocess: (newModel: string) => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ transcript, onReset, audioBlob, chatHistory, isChatting, onSendMessage, onSwitchToBatch, model, onReprocess }) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>(model);

  const handleCopy = async () => {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDownload = () => {
    if (!audioBlob) return;
    try {
      const url = URL.createObjectURL(audioBlob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      
      const extension = audioBlob.type === 'audio/mpeg' ? 'mp3' : (audioBlob.type.split('/')[1] || 'webm').split(';')[0];
      a.download = `audio-transcript.${extension}`;
      
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
        console.error('Failed to download audio:', err)
    }
  };
  
  const handleReprocessClick = () => {
    if (selectedModel !== model) {
        onReprocess(selectedModel);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-slate-800">Transcript</h2>
        {transcript && (
            <button
              onClick={handleCopy}
              className={`text-sm font-semibold py-1 px-3 rounded-lg transition-colors ${isCopied ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
            >
              {isCopied ? 'Copied!' : 'Copy Transcript'}
            </button>
        )}
      </div>
      <p className="text-slate-600 mb-6">Review the transcript below. You can copy it to your clipboard or use the chat for follow-up questions.</p>
      <div className="p-4 bg-slate-50 border rounded-lg">
        <p className="font-sans text-slate-800" style={{ whiteSpace: 'pre-wrap' }}>{transcript}</p>
      </div>
      
      <ChatInterface 
        history={chatHistory} 
        isChatting={isChatting} 
        onSendMessage={onSendMessage} 
      />

      <div className="mt-8 pt-6 border-t space-y-8">
        <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-2">Re-process with a different model</h3>
            <p className="text-slate-500 text-sm mb-4">Choose a different model to generate a new transcript from the same audio.</p>
            <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-100 rounded-lg">
                <select 
                id="reprocess-model-select" 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-auto flex-grow"
                aria-label="Select AI Model for re-processing"
                >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                </select>
                <button
                onClick={handleReprocessClick}
                disabled={selectedModel === model}
                className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition-colors disabled:bg-purple-300 disabled:cursor-not-allowed w-full sm:w-auto"
                >
                Re-process
                </button>
            </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button
            onClick={handleDownload}
            disabled={!audioBlob}
            className="bg-slate-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed w-full sm:w-auto"
            >
            Download Audio
            </button>
            <button
            onClick={onReset}
            className="bg-blue-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors w-full sm:w-auto"
            >
            Record New Audio
            </button>
            <button
            onClick={onSwitchToBatch}
            className="bg-slate-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-50 transition-colors w-full sm:w-auto"
            >
            Batch Processing
            </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsDisplay;
