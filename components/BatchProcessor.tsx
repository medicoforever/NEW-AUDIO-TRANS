
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { processAudio, createChat, blobToBase64, getCleanMimeType, base64ToBlob } from '../services/geminiService';
import Spinner from './ui/Spinner';
import MicIcon from './icons/MicIcon';
import StopIcon from './icons/StopIcon';
import PauseIcon from './icons/PauseIcon';
import ResumeIcon from './icons/ResumeIcon';
import ChevronDownIcon from './icons/ChevronDownIcon';
import UploadIcon from './icons/UploadIcon';
import { Chat } from '@google/genai';
import ChatInterface from './ChatInterface';
import { useAuth } from '../contexts/AuthContext';

type BatchStatus = 'idle' | 'recording' | 'paused' | 'complete' | 'processing' | 'error';

interface ChatMessage {
  author: 'You' | 'AI';
  text: string;
}

interface Batch {
    id: string;
    name:string;
    audioBlobs: Blob[];
    transcript: string | null;
    status: BatchStatus;
    model: string;
    selectedReprocessModel: string;
    error?: string;
    chat?: Chat | null;
    chatHistory?: ChatMessage[];
    isChatting?: boolean;
}

interface SerializableBatch {
    id: string;
    name: string;
    audioBlobs: { data: string; type: string; }[];
    transcript: string | null;
    status: BatchStatus;
    model: string;
    selectedReprocessModel: string;
    error?: string;
    chatHistory?: ChatMessage[];
}


interface BatchProcessorProps {
    onBack: () => void;
    model: string;
}

const BatchProcessor: React.FC<BatchProcessorProps> = ({ onBack, model }) => {
    const { user, saveBatchModeHistory, loadUserData } = useAuth();
    const [batches, setBatches] = useState<Batch[]>([]);
    const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
    const { isRecording, startRecording, stopRecording, error: recorderError } = useAudioRecorder();
    const [isBusy, setIsBusy] = useState(false);
    const [openAccordion, setOpenAccordion] = useState<string | null>(null);
    const [copiedBatchId, setCopiedBatchId] = useState<string | null>(null);
    const [isCopyAllCopied, setIsCopyAllCopied] = useState(false);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [isDataLoaded, setIsDataLoaded] = useState(false);
    
    // Auto-save effect
    useEffect(() => {
        if (!isDataLoaded) return; // Do not save until initial data has been loaded

        const saveBatches = async () => {
            if (!user) return;

            try {
                const serializableBatches: SerializableBatch[] = await Promise.all(
                    batches.map(async (batch) => {
                        const serializedBlobs = await Promise.all(
                            batch.audioBlobs.map(async (blob) => ({
                                data: await blobToBase64(blob),
                                type: blob.type,
                            }))
                        );
                        return {
                            id: batch.id,
                            name: batch.name,
                            audioBlobs: serializedBlobs,
                            transcript: batch.transcript,
                            status: batch.status,
                            model: batch.model,
                            selectedReprocessModel: batch.selectedReprocessModel,
                            error: batch.error,
                            chatHistory: batch.chatHistory,
                        };
                    })
                );
                await saveBatchModeHistory(serializableBatches);
            } catch (error) {
                console.error("Failed to save batches:", error);
            }
        };

        const handler = setTimeout(() => {
            saveBatches();
        }, 1000); // Debounce saving

        return () => {
            clearTimeout(handler);
        };
    }, [batches, user, saveBatchModeHistory, isDataLoaded]);

    // Load effect
    useEffect(() => {
        const loadBatches = async () => {
            if (!user) {
                setIsDataLoaded(true);
                return;
            }
            const userData = await loadUserData();
            const serializableBatches = userData?.batchModeSave;
            
            if (serializableBatches && serializableBatches.length > 0) {
                try {
                    const loadedBatches: Batch[] = serializableBatches.map((sBatch: SerializableBatch) => {
                        const blobs = sBatch.audioBlobs.map(b => base64ToBlob(b.data, b.type));
                        return {
                            ...sBatch,
                            audioBlobs: blobs,
                            chat: null, // Chat sessions are not serializable and must be recreated
                            isChatting: false,
                        };
                    });
                    setBatches(loadedBatches);
                    const firstProcessed = loadedBatches.find(b => b.transcript);
                    if (firstProcessed) {
                        setOpenAccordion(firstProcessed.id);
                    }
                } catch (error) {
                    console.error("Failed to load saved batches:", error);
                }
            }
            setIsDataLoaded(true);
        };
        loadBatches();
    }, [user, loadUserData]);

    useEffect(() => {
        if (recorderError && activeBatchId) {
             setBatches(prevBatches =>
                prevBatches.map(b =>
                    b.id === activeBatchId ? { ...b, status: 'error', error: recorderError } : b
                )
            );
            setActiveBatchId(null);
            setIsBusy(false);
        }
    }, [recorderError, activeBatchId]);

    const addBatch = () => {
        const newBatch: Batch = {
            id: crypto.randomUUID(),
            name: `Audio #${batches.length + 1}`,
            audioBlobs: [],
            transcript: null,
            status: 'idle',
            isChatting: false,
            model: model,
            selectedReprocessModel: model,
        };
        setBatches(prev => [...prev, newBatch]);
    };

    const updateBatchName = (id: string, name: string) => {
        setBatches(prev => prev.map(b => b.id === id ? { ...b, name } : b));
    };

    const updateBatchSelectedReprocessModel = (id: string, newModel: string) => {
        setBatches(prev => prev.map(b => b.id === id ? { ...b, selectedReprocessModel: newModel } : b));
    };

    const handleFileUpload = (batchId: string, file: File) => {
        setBatches(prevBatches =>
            prevBatches.map(b =>
                b.id === batchId ? { ...b, audioBlobs: [file], status: 'complete' } : b
            )
        );
    };

    const triggerFileUpload = (batchId: string) => {
        fileInputRefs.current[batchId]?.click();
    };

    const handleRecordOrResume = async (batch: Batch) => {
        if (isBusy) return;
        setIsBusy(true);

        if (isRecording && activeBatchId && activeBatchId !== batch.id) {
            const blob = await stopRecording();
            setBatches(prev => prev.map(b => 
                b.id === activeBatchId 
                    ? { ...b, audioBlobs: [...b.audioBlobs, blob], status: 'paused' } 
                    : b
            ));
        }
        
        setActiveBatchId(batch.id);
        await startRecording();
        setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: 'recording' } : b));
        
        setIsBusy(false);
    };

    const handlePause = async (batch: Batch) => {
        if (isBusy || !isRecording || activeBatchId !== batch.id) return;
        setIsBusy(true);
        
        const blob = await stopRecording();
        setBatches(prev => prev.map(b => 
            b.id === batch.id 
                ? { ...b, audioBlobs: [...b.audioBlobs, blob], status: 'paused' }
                : b
        ));
        setActiveBatchId(null);

        setIsBusy(false);
    };

    const handleStop = async (batch: Batch) => {
        if (isBusy || !isRecording || activeBatchId !== batch.id) return;
        setIsBusy(true);

        const blob = await stopRecording();
        setBatches(prev => prev.map(b => 
            b.id === batch.id 
                ? { ...b, audioBlobs: [...b.audioBlobs, blob], status: 'complete' }
                : b
        ));
        setActiveBatchId(null);

        setIsBusy(false);
    };
    
    const handleProcessAll = async () => {
        const batchesToProcess = batches.filter(b => (b.status === 'complete' || b.status === 'paused') && b.audioBlobs.length > 0 && !b.transcript);
        if (batchesToProcess.length === 0) return;

        setBatches(prev => prev.map(b => batchesToProcess.find(p => p.id === b.id) ? {...b, status: 'processing'} : b));

        await Promise.all(batchesToProcess.map(async (batch) => {
            if (batch.audioBlobs.length === 0) return;
            try {
                const mimeType = batch.audioBlobs[0].type;
                const mergedBlob = new Blob(batch.audioBlobs, { type: mimeType });
                const transcript = await processAudio(mergedBlob, model);
                
                const chatSession = await createChat(mergedBlob, transcript, model);
                const aiGreeting = "I have reviewed the audio and transcript for this dictation. How can I help you further?";
                const initialChatHistory = [{ author: 'AI' as const, text: `${transcript}\n\n${aiGreeting}` }];

                setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: 'complete', transcript, chat: chatSession, chatHistory: initialChatHistory, isChatting: false, model: model } : b));
            } catch (err) {
                 const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
                setBatches(prev => prev.map(b => b.id === batch.id ? { ...b, status: 'error', error: errorMessage } : b));
            }
        }));
    };

     const handleReprocessBatch = async (batchId: string) => {
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) return;

        const batchToReprocess = batches[batchIndex];
        const newModel = batchToReprocess.selectedReprocessModel;

        if (!batchToReprocess.audioBlobs.length || newModel === batchToReprocess.model) return;

        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'processing', error: undefined } : b));

        try {
            const mimeType = batchToReprocess.audioBlobs[0].type;
            const mergedBlob = new Blob(batchToReprocess.audioBlobs, { type: mimeType });
            const transcript = await processAudio(mergedBlob, newModel);
            
            const chatSession = await createChat(mergedBlob, transcript, newModel);
            const aiGreeting = "I have reviewed the audio and the new transcript. How can I help you further?";
            const initialChatHistory = [{ author: 'AI' as const, text: `${transcript}\n\n${aiGreeting}` }];

            setBatches(prev => prev.map(b => 
                b.id === batchId 
                ? { 
                    ...b, 
                    status: 'complete', 
                    transcript, 
                    chat: chatSession, 
                    chatHistory: initialChatHistory, 
                    isChatting: false,
                    model: newModel
                  } 
                : b
            ));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setBatches(prev => prev.map(b => b.id === batchId ? { ...b, status: 'error', error: errorMessage } : b));
        }
    };

    const handleSendMessage = async (batchId: string, message: string, audio?: Blob) => {
        const batchIndex = batches.findIndex(b => b.id === batchId);
        if (batchIndex === -1) return;

        let batch = batches[batchIndex];
        if (batch.isChatting) return;

        const userMessage = message || '[Audio Message]';
        const updatedHistoryWithUser = [...(batch.chatHistory || []), { author: 'You' as const, text: userMessage }];
        
        setBatches(prev => prev.map(b => b.id === batchId ? { ...b, isChatting: true, chatHistory: updatedHistoryWithUser } : b));

        try {
            let chatToUse = batch.chat;
            // Recreate chat session if it doesn't exist, now with full history
            if (!chatToUse && batch.transcript && batch.audioBlobs.length > 0) {
                const mimeType = getCleanMimeType(batch.audioBlobs[0]);
                const mergedBlob = new Blob(batch.audioBlobs, { type: mimeType });
                chatToUse = await createChat(mergedBlob, batch.transcript, batch.model, updatedHistoryWithUser);
                
                const newChat = chatToUse;
                // Update batch in state with the new chat session for future use
                setBatches(prev => prev.map(b => b.id === batchId ? { ...b, chat: newChat } : b));
            }

            if (!chatToUse) {
                throw new Error("Could not initialize chat session.");
            }

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
                 setBatches(prev => prev.map(b => b.id === batchId ? {...b, isChatting: false} : b));
                 return;
            }

            const response = await chatToUse.sendMessage({ message: messageParts });
            const responseText = response.text;
            
            setBatches(prev => prev.map(b => b.id === batchId ? {
                ...b,
                isChatting: false,
                chatHistory: [...updatedHistoryWithUser, { author: 'AI' as const, text: responseText }]
            } : b));

        } catch (err) {
            console.error("Chat error:", err);
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setBatches(prev => prev.map(b => b.id === batchId ? {
                ...b,
                isChatting: false,
                chatHistory: [...updatedHistoryWithUser, { author: 'AI' as const, text: `Sorry, I encountered an error: ${errorMessage}` }]
            } : b));
        }
    };


    const handleCopyAll = async () => {
        const textToCopy = batches
            .filter(b => b.transcript)
            .map(b => `--- ${b.name} ---\n\n${b.transcript}`)
            .join('\n\n');

        if (!textToCopy) return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            setIsCopyAllCopied(true);
            setTimeout(() => setIsCopyAllCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy all transcripts:', err);
        }
    };

    const handleCopyTranscriptForBatch = async (batch: Batch) => {
        if (!batch.transcript) return;
        try {
            await navigator.clipboard.writeText(batch.transcript);
            setCopiedBatchId(batch.id);
            setTimeout(() => setCopiedBatchId(null), 2000);
        } catch (err) {
            console.error('Failed to copy transcript for batch: ', err);
        }
    };

    const handleDownload = (batch: Batch) => {
        if (!batch.audioBlobs.length) return;
        try {
            const mimeType = batch.audioBlobs[0].type;
            const mergedBlob = new Blob(batch.audioBlobs, { type: mimeType });
            const url = URL.createObjectURL(mergedBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const extension = mimeType === 'audio/mpeg' ? 'mp3' : (mimeType.split('/')[1] || 'webm').split(';')[0];
            a.download = `${batch.name.replace(/\s+/g, '_')}.${extension}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err) {
            console.error('Failed to download audio:', err)
        }
    };

    const allProcessed = batches.every(b => b.status !== 'processing');
    const hasProcessableRecordings = batches.some(b => (b.status === 'complete' || b.status === 'paused') && b.audioBlobs.length > 0 && !b.transcript);
    const hasAnyResults = batches.some(b => b.transcript);
    const allBatchesProcessed = hasAnyResults && !hasProcessableRecordings && allProcessed;

    return (
        <div>
            <button onClick={onBack} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back to Single Recording</button>
            
            <div className="space-y-4">
                {batches.map((batch) => (
                        <div key={batch.id} className="p-4 border rounded-lg bg-slate-50 flex flex-col sm:flex-row items-center gap-4">
                            <input
                                type="text"
                                value={batch.name}
                                onChange={(e) => updateBatchName(batch.id, e.target.value)}
                                className="font-semibold p-2 border rounded w-full sm:w-1/3"
                                aria-label={`Batch name for ${batch.name}`}
                            />
                            <div className="flex-grow flex items-center justify-center sm:justify-end gap-2">
                                {(batch.status === 'idle' || batch.status === 'paused' || batch.status === 'complete' || batch.status === 'error') && batch.transcript === null && (
                                   <>
                                    <button onClick={() => handleRecordOrResume(batch)} className="flex items-center gap-2 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors text-sm px-3 disabled:bg-blue-300 disabled:cursor-wait" disabled={isBusy || (isRecording && activeBatchId !== batch.id)}>
                                        {batch.status === 'paused' ? <><ResumeIcon className="w-4 h-4"/> Resume</> : <><MicIcon className="w-4 h-4"/> Record</>}
                                    </button>
                                     <input
                                        type="file"
                                        ref={el => { fileInputRefs.current[batch.id] = el; }}
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                handleFileUpload(batch.id, e.target.files[0]);
                                            }
                                        }}
                                        className="hidden"
                                        accept="audio/*"
                                        aria-hidden="true"
                                    />
                                    <button 
                                        onClick={() => triggerFileUpload(batch.id)} 
                                        className="flex items-center gap-2 bg-slate-600 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors text-sm px-3 disabled:bg-slate-400 disabled:cursor-wait" 
                                        disabled={isBusy || isRecording}
                                        aria-label={`Upload audio file for ${batch.name}`}
                                    >
                                        <UploadIcon className="w-4 h-4" /> Upload
                                    </button>
                                   </>
                                )}
                                {batch.status === 'recording' && (
                                    <>
                                        <button onClick={() => handlePause(batch)} className="flex items-center gap-2 bg-yellow-500 text-white p-2 rounded-lg hover:bg-yellow-600 transition-colors text-sm px-3 disabled:cursor-wait" disabled={isBusy}>
                                            <PauseIcon className="w-4 h-4" /> Pause
                                        </button>
                                        <button onClick={() => handleStop(batch)} className="flex items-center gap-2 bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors text-sm px-3 disabled:cursor-wait" disabled={isBusy}>
                                            <StopIcon className="w-4 h-4"/> Stop
                                        </button>
                                    </>
                                )}
                                {(batch.status === 'complete' || batch.status === 'paused') && batch.audioBlobs.length > 0 && batch.transcript === null && <span className="text-green-600 font-semibold text-sm">Ready</span>}
                                {batch.status === 'processing' && !batch.transcript && <Spinner className="w-6 h-6" />}
                                {batch.status === 'error' && !batch.transcript && <span className="text-red-600 font-semibold text-sm">Error</span>}
                                {batch.transcript && batch.status !== 'processing' && <span className="text-blue-600 font-semibold text-sm">Processed</span>}
                                {batch.transcript && batch.status === 'processing' && <><Spinner className="w-6 h-6" /><span className="text-slate-600 font-semibold text-sm ml-2">Re-processing...</span></>}
                            </div>
                        </div>
                    ))}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-4">
                <button onClick={addBatch} className="bg-slate-200 text-slate-800 font-bold py-2 px-4 rounded-lg hover:bg-slate-300 w-full sm:w-auto">Add Audio Recording</button>
                <button 
                    onClick={handleProcessAll}
                    disabled={!hasProcessableRecordings || !allProcessed || isBusy}
                    className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-green-300 disabled:cursor-not-allowed w-full sm:w-auto flex-grow"
                >
                    {allProcessed ? 'Create All Transcripts' : <><Spinner className="w-5 h-5 inline mr-2" /> Processing...</>}
                </button>
            </div>
            
            {hasAnyResults && (
                <div className="mt-8 border-t pt-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-2xl font-bold text-slate-800">Processed Transcripts</h3>
                        {allBatchesProcessed && (
                             <button
                                onClick={handleCopyAll}
                                className={`text-sm font-semibold py-1 px-3 rounded-lg transition-colors ${isCopyAllCopied ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                            >
                                {isCopyAllCopied ? 'Copied!' : 'Copy All Transcripts'}
                            </button>
                        )}
                    </div>
                     <div className="space-y-2">
                        {batches.filter(b => b.transcript || (b.status === 'error' && b.transcript === null)).map(batch => (
                             <div key={batch.id} className="border rounded-lg overflow-hidden">
                                <button onClick={() => setOpenAccordion(openAccordion === batch.id ? null : batch.id)} className="w-full text-left p-4 bg-slate-100 hover:bg-slate-200 flex justify-between items-center">
                                    <span className="font-semibold">{batch.name}</span>
                                    <span className={`transition-transform transform ${openAccordion === batch.id ? 'rotate-180' : ''}`}><ChevronDownIcon /></span>
                                </button>
                                {openAccordion === batch.id && (
                                     <div className="p-4 bg-white">
                                        {batch.status === 'processing' && batch.transcript ? (
                                            <div className="text-center p-8">
                                                <Spinner />
                                                <p className="text-slate-600 mt-4 text-lg">
                                                    Re-processing with new model...
                                                </p>
                                                <p className="text-slate-500 mt-2 text-sm">
                                                    This may take a moment.
                                                </p>
                                            </div>
                                        ) : (
                                            <>
                                                {batch.transcript && (
                                                    <>
                                                        <div className="flex justify-between items-center mb-4">
                                                          <h4 className="text-lg font-bold text-slate-800">Transcript</h4>
                                                          <button
                                                            onClick={() => handleCopyTranscriptForBatch(batch)}
                                                            className={`text-sm font-semibold py-1 px-3 rounded-lg transition-colors ${copiedBatchId === batch.id ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
                                                          >
                                                            {copiedBatchId === batch.id ? 'Copied!' : 'Copy Transcript'}
                                                          </button>
                                                        </div>
                                                        <p className="text-slate-600 mb-6 text-sm">Review the transcript below. You can copy it or use the chat for follow-up questions.</p>
                                                        <div className="p-4 bg-slate-50 border rounded-lg">
                                                            <p className="font-sans text-slate-800" style={{ whiteSpace: 'pre-wrap' }}>{batch.transcript}</p>
                                                        </div>

                                                        <ChatInterface 
                                                            history={batch.chatHistory || []} 
                                                            isChatting={!!batch.isChatting} 
                                                            onSendMessage={(message, audio) => handleSendMessage(batch.id, message, audio)}
                                                        />

                                                        <div className="mt-8 pt-6 border-t space-y-8">
                                                            <div>
                                                                <h4 className="text-lg font-semibold text-slate-700 mb-2">Re-process with a different model</h4>
                                                                <p className="text-slate-500 text-sm mb-4">Choose a different model to generate a new transcript from the same audio.</p>
                                                                <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-slate-100 rounded-lg">
                                                                    <select 
                                                                        value={batch.selectedReprocessModel} 
                                                                        onChange={(e) => updateBatchSelectedReprocessModel(batch.id, e.target.value)}
                                                                        className="p-2 border rounded-lg bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none w-full sm:w-auto flex-grow"
                                                                        aria-label={`Select AI Model for re-processing ${batch.name}`}
                                                                    >
                                                                        <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                                                        <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                                                                        <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                                                                    </select>
                                                                    <button
                                                                        onClick={() => handleReprocessBatch(batch.id)}
                                                                        disabled={batch.selectedReprocessModel === batch.model || batch.status === 'processing'}
                                                                        className="bg-purple-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition-colors disabled:bg-purple-300 disabled:cursor-not-allowed w-full sm:w-auto"
                                                                    >
                                                                        Re-process
                                                                    </button>
                                                                </div>
                                                                 {batch.status === 'error' && batch.error && batch.transcript && (
                                                                    <p className="text-red-500 mt-2 text-sm text-center sm:text-left">{`Reprocessing failed: ${batch.error}`}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                                                <button
                                                                    onClick={() => handleDownload(batch)}
                                                                    className="bg-slate-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-opacity-50 transition-colors w-full sm:w-auto"
                                                                    >
                                                                    Download Audio
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                                {batch.status === 'error' && batch.error && !batch.transcript && <p className="text-red-600 p-4">{batch.error}</p>}
                                            </>
                                        )}
                                     </div>
                                )}
                            </div>
                        ))}
                     </div>
                </div>
            )}
        </div>
    );
};

export default BatchProcessor;
