import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Spinner from './ui/Spinner';

const AuthScreen: React.FC = () => {
    const { signInWithGoogleAndSetApiKey } = useAuth();
    const [apiKey, setApiKey] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSigningIn, setIsSigningIn] = useState(false);

    const handleSignIn = async () => {
        if (!apiKey.trim()) {
            setError("Please enter your Gemini API key before signing in.");
            return;
        }
        setError(null);
        setIsSigningIn(true);
        try {
            await signInWithGoogleAndSetApiKey(apiKey.trim());
            // On success, the AuthProvider will handle navigation
        } catch (err) {
            const message = err instanceof Error ? err.message : "An unknown error occurred.";
            setError(`Sign-in failed: ${message}`);
        } finally {
            setIsSigningIn(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
            <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl p-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-800">Welcome</h1>
                    <p className="text-slate-600 mt-2">Sign in and provide your Gemini API key to continue.</p>
                </div>

                <div className="mt-8 space-y-6">
                    <div>
                        <label htmlFor="api-key" className="block text-sm font-medium text-slate-700">
                            Gemini API Key
                        </label>
                        <input
                            id="api-key"
                            name="api-key"
                            type="password"
                            required
                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Enter your API key"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            disabled={isSigningIn}
                        />
                         <p className="mt-2 text-xs text-slate-500">
                            Your API key is stored securely in your user profile in the cloud.
                        </p>
                    </div>

                    <div className="flex flex-col items-center justify-center">
                       {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}
                       <button
                            onClick={handleSignIn}
                            disabled={isSigningIn}
                            className="flex justify-center items-center gap-3 w-full max-w-xs bg-white border border-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-slate-50 disabled:bg-slate-200 disabled:cursor-not-allowed"
                       >
                           {isSigningIn ? (
                                <>
                                    <Spinner className="w-5 h-5 text-slate-600" />
                                    <span>Signing In...</span>
                                </>
                           ) : (
                                <>
                                    <svg className="w-5 h-5" viewBox="0 0 48 48">
                                        <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                        <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"></path>
                                        <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.222,0-9.519-3.486-11.088-8.234l-6.571,4.819C9.656,39.663,16.318,44,24,44z"></path>
                                        <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.088,5.571l6.19,5.238C42.022,35.39,44,30.134,44,24C44,22.659,43.862,21.35,43.611,20.083z"></path>
                                    </svg>
                                    <span>Sign in with Google</span>
                                </>
                           )}
                       </button>
                    </div>
                </div>

                 <div className="mt-8 text-center text-sm text-slate-500">
                    <p>Don't have an API key? Get one from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:text-blue-500">Google AI Studio</a>.</p>
                </div>
            </div>
        </div>
    );
};

export default AuthScreen;
