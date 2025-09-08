
import React, { useState, useRef, useEffect } from 'react';
import SendIcon from './icons/SendIcon';
import Spinner from './ui/Spinner';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import MicIcon from './icons/MicIcon';
import StopIcon from './icons/StopIcon';

const XIcon: React.FC<{className?: string}> = ({className = "w-4 h-4"}) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    className={className} 
    fill="none" 
    viewBox="0 0 24 24" 
    stroke="currentColor"
    strokeWidth="2"
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface ChatMessage {
  author: 'You' | 'AI';
  text: string;
}

interface ChatInterfaceProps {
  history: ChatMessage[];
  isChatting: boolean;
  onSendMessage: (message: string, audio?: Blob) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ history, isChatting, onSendMessage }) => {
  const [input, setInput] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(scrollToBottom, [history]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      const blob = await stopRecording();
      if (blob && blob.size > 0) {
        setAudioBlob(blob);
      }
    } else {
      setAudioBlob(null); // Clear any previous recording
      await startRecording();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || audioBlob) && !isChatting) {
      onSendMessage(input.trim(), audioBlob);
      setInput('');
      setAudioBlob(null);
    }
  };

  const isAwaitingResponse = isChatting && history.length > 0 && history[history.length - 1]?.author === 'You';

  return (
    <div className="mt-8 border-t pt-6">
      <h3 className="text-xl font-bold text-slate-800 mb-4">Follow-up Chat</h3>
      <div className="bg-slate-50 rounded-lg p-4 h-72 overflow-y-auto flex flex-col gap-4">
        {history.map((msg, index) => (
          <div key={index} className={`flex w-full ${msg.author === 'You' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-lg shadow-sm ${msg.author === 'You' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800'}`}>
              <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</p>
            </div>
          </div>
        ))}
        {isAwaitingResponse && (
           <div className="flex justify-start">
             <div className="bg-slate-200 text-slate-800 p-3 rounded-lg shadow-sm">
                <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {audioBlob && !isRecording && (
        <div className="mt-2 flex items-center justify-between bg-slate-100 p-2 rounded-lg">
          <span className="text-sm text-slate-600 font-medium">Audio message ready</span>
          <button 
            onClick={() => setAudioBlob(null)} 
            className="p-1 rounded-full hover:bg-slate-200"
            aria-label="Remove audio message"
          >
            <XIcon className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      )}

      {recorderError && <p className="text-red-500 text-sm mt-2">{recorderError}</p>}

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isRecording ? "Recording audio..." : "Ask a follow-up question..."}
          aria-label="Chat input"
          className="flex-grow p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
          disabled={isChatting || isRecording}
        />
        
        <button
          type="button"
          onClick={handleToggleRecording}
          disabled={isChatting}
          className={`p-2 rounded-lg flex items-center justify-center w-12 h-12 flex-shrink-0 transition-colors ${
            isRecording 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
          } disabled:bg-slate-100 disabled:cursor-not-allowed`}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
        >
          {isRecording ? <StopIcon className="w-6 h-6" /> : <MicIcon className="w-6 h-6 text-slate-700" />}
        </button>

        <button 
          type="submit" 
          disabled={isChatting || (!input.trim() && !audioBlob) || isRecording} 
          className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed flex items-center justify-center w-12 h-12 flex-shrink-0 transition-colors"
          aria-label="Send chat message"
        >
            {isChatting ? <Spinner className="h-6 w-6 text-white" /> : <SendIcon />}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
