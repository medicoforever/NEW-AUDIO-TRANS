




import React, { useState, useCallback, useEffect } from 'react';
import AudioRecorder from './components/AudioRecorder';
import ResultsDisplay from './components/ResultsDisplay';
import { AppStatus } from './types';
import { processAudio, createChat, blobToBase64, getCleanMimeType, base64ToBlob } from './services/geminiService';
import Spinner from './components/ui/Spinner';
import { Chat } from '@google/genai';
import BatchProcessor from './components/BatchProcessor';
import { useAuth } from './contexts/AuthContext';
import AuthScreen from './components/AuthScreen';

interface ChatMessage {
  author: 'You' | 'AI';
  text: string;
}

const App: React.FC = () => {
  const { user, apiKey, logout, loadUserData, saveSingleModeHistory, clearAllHistory } = useAuth();

  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [model, setModel] = useState<string>('gemini-2.5-flash');
  const [status, setStatus] = useState<AppStatus>(AppStatus.Idle);
  const [transcript, setTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState<boolean>(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);


  // Auto-save logic
  useEffect(() => {
    const saveData = async () => {
      if (user && status === AppStatus.Success && audioBlob && isDataLoaded) {
        try {
          const base64Audio = await blobToBase64(audioBlob);
          const savedState = {
            transcript,
            audio: { data: base64Audio, type: audioBlob.type },
            chatHistory,
            model,
            status: AppStatus.Success,
          };
          await saveSingleModeHistory(savedState);
        } catch (error) {
            console.error("Failed to save single mode state:", error);
        }
      }
    };
    saveData();
  }, [status, transcript, audioBlob, chatHistory, model, user, saveSingleModeHistory, isDataLoaded]);

  // Load saved data on mount or user login
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      const userData = await loadUserData();
      const savedState = userData?.singleModeSave;

      if (savedState && savedState.status === AppStatus.Success && savedState.transcript) {
        try {
            setStatus(AppStatus.Processing); // Show a loading state briefly
            const blob = base64ToBlob(savedState.audio.data, savedState.audio.type);
            
            setTranscript(savedState.transcript);
            setAudioBlob(blob);
            setChatHistory(savedState.chatHistory || []);
            setModel(savedState.model);
            
            // Recreate chat session
            const chatSession = await createChat(blob, savedState.transcript, savedState.model);
            setChat(chatSession);

            setStatus(AppStatus.Success);
        } catch (error) {
          console.error("Failed to load saved state:", error);
          await clearAllHistory(); // Clear corrupted data
        }
      }
      setIsDataLoaded(true);
    };
    loadData();
  }, [user, loadUserData, clearAllHistory]); // Re-run when user logs in

  const handleAudioSubmit = useCallback(async (audioBlob: Blob) => {
    if (!audioBlob || audioBlob.size === 0) {
      setError('The provided audio file is empty.');
      setStatus(AppStatus.Error);
      return;
    }
    setStatus(AppStatus.Processing);
    setError(null);
    setTranscript('');

    try {
      const processedText = await processAudio(audioBlob, model);
      setTranscript(processedText);
      setAudioBlob(audioBlob);

      const chatSession = await createChat(audioBlob, processedText, model);
      setChat(chatSession);
      const aiGreeting = "I have reviewed the audio and the transcript. How can I help you further?";
      setChatHistory([{ author: 'AI', text: `${processedText}\n\n${aiGreeting}` }]);
      
      setStatus(AppStatus.Success);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred during processing.');
      setStatus(AppStatus.Error);
    }
  }, [model]);

  const handleReprocess = useCallback(async (newModel: string) => {
    if (!audioBlob) {
        setError('No audio available to reprocess.');
        setStatus(AppStatus.Error);
        return;
    }
    
    setStatus(AppStatus.Processing);
    setError(null);
    setTranscript('');
    setChat(null);
    setChatHistory([]);

    try {
        const processedText = await processAudio(audioBlob, newModel);
        setTranscript(processedText);

        const chatSession = await createChat(audioBlob, processedText, newModel);
        setChat(chatSession);
        const aiGreeting = "I have reviewed the audio and the transcript. How can I help you further?";
        setChatHistory([{ author: 'AI', text: `${processedText}\n\n${aiGreeting}` }]);
      
        setStatus(AppStatus.Success);
        setModel(newModel);
    } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred during reprocessing.');
        setStatus(AppStatus.Error);
    }
  }, [audioBlob]);
  
  const handleSendMessage = async (message: string, audio?: Blob) => {
    if (!chat || isChatting) return;

    setIsChatting(true);
    const userMessage = message || '[Audio Message]';
    setChatHistory(prev => [...prev, { author: 'You', text: userMessage }]);

    try {
      const messageParts = [];
      if (message) {
        messageParts.push({ text: message });
      }
      if (audio) {
        if (!message.trim()) {
            messageParts.push({ text: "This is a spoken follow-up question. Please listen to the audio and answer it based on our previous conversation about the original audio and transcript." });
        }
        const base64Audio = await blobToBase64(audio);
        messageParts.push({
          inlineData: {
            mimeType: getCleanMimeType(audio),
            data: base64Audio,
          },
        });
      }

      if (messageParts.length === 0) {
        setIsChatting(false);
        return;
      }
      
      // FIX: The `sendMessage` method expects an object with a `message` property containing the parts array.
      const response = await chat.sendMessage({ message: messageParts });
      const responseText = response.text;
      setChatHistory(prev => [...prev, { author: 'AI', text: responseText }]);
    } catch (err) {
      console.error("Chat error:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setChatHistory(prev => [...prev, { author: 'AI', text: `Sorry, I encountered an error: ${errorMessage}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  const resetSingleMode = async () => {
    setStatus(AppStatus.Idle);
    setTranscript('');
    setError(null);
    setAudioBlob(null);
    setChat(null);
    setChatHistory([]);
    setIsChatting(false);
    if (user) {
        await saveSingleModeHistory(null);
    }
  };

  const renderSingleModeContent = () => {
    switch (status) {
      case AppStatus.Idle:
      case AppStatus.Recording:
        return (
          <>
            <div className="text-right mb-4 -mt-4">
                 <button 
                    onClick={() => setMode('batch')} 
                    className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                >
                    Switch to Batch Processing &rarr;
                </button>
            </div>
            <AudioRecorder
              status={status}
              setStatus={setStatus}
              onAudioAvailable={handleAudioSubmit}
            />
          </>
        );
      case AppStatus.Processing:
        return (
          <div className="text-center p-8">
            <Spinner />
            <p className="text-slate-600 mt-4 text-lg">
              Analyzing audio and creating transcript...
            </p>
            <p className="text-slate-500 mt-2 text-sm">
              This may take a moment.
            </p>
          </div>
        );
      case AppStatus.Success:
        return (
          <ResultsDisplay 
            transcript={transcript} 
            onReset={resetSingleMode} 
            audioBlob={audioBlob}
            chatHistory={chatHistory}
            isChatting={isChatting}
            onSendMessage={handleSendMessage}
            onSwitchToBatch={() => setMode('batch')}
            model={model}
            onReprocess={handleReprocess}
          />
        );
      case AppStatus.Error:
        return (
          <div className="text-center p-8 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-xl font-semibold text-red-700">An Error Occurred</h3>
            <p className="text-red-600 mt-2">{error}</p>
            <button
              onClick={resetSingleMode}
              className="mt-6 bg-red-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (mode) {
      case 'single':
        return renderSingleModeContent();
      case 'batch':
        return <BatchProcessor model={model} onBack={() => {
          resetSingleMode();
          setMode('single');
        }} />;
      default:
        return renderSingleModeContent();
    }
  }

  const handleClearData = async () => {
    if (user && window.confirm("Are you sure you want to clear all your saved single and batch processing history from the cloud? This action cannot be undone.")) {
        await clearAllHistory();
        window.location.reload();
    }
  };

  if (!user || !apiKey) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800">AI Audio Transcription & Translation</h1>
          <p className="text-slate-600 mt-2">
            {mode === 'single' && 'Record or upload audio, and let AI provide a clean, corrected, and translated English transcript.'}
            {mode === 'batch' && 'Manage and transcribe multiple audio files efficiently.'}
          </p>
           <div className="mt-4 flex justify-center">
            <div className="flex items-center gap-2">
              <label htmlFor="model-select" className="font-semibold text-slate-700">Select Model:</label>
              <select 
                id="model-select" 
                value={model} 
                onChange={(e) => setModel(e.target.value)}
                className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                aria-label="Select AI Model"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              </select>
            </div>
          </div>
        </header>
        <main className="bg-white rounded-2xl shadow-xl p-4 sm:p-8 min-h-[300px]">
          {renderContent()}
        </main>
        <footer className="text-center mt-8 text-sm text-slate-500">
          <p>Powered by Gemini AI</p>
          <div className="flex justify-center gap-4 mt-2">
            <button onClick={handleClearData} className="text-xs text-slate-500 hover:underline focus:outline-none focus:ring-2 focus:ring-slate-400 rounded">
                Clear My Saved History
            </button>
            <button onClick={logout} className="text-xs text-red-500 hover:underline focus:outline-none focus:ring-2 focus:ring-red-400 rounded">
                Manage API Key & Sign Out
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
