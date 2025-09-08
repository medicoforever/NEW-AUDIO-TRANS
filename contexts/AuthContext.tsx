import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeGeminiClient, clearGeminiClient } from '../services/geminiClient';
import { firebaseConfig } from '../services/firebaseConfig';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export interface GoogleUser {
    id: string;
    name: string | null;
    email: string | null;
    imageUrl: string | null;
}

interface UserData {
    apiKey: string;
    singleModeSave?: any;
    batchModeSave?: any;
}

interface AuthContextType {
    user: GoogleUser | null;
    apiKey: string | null;
    isLoading: boolean;
    signInWithGoogleAndSetApiKey: (key: string) => Promise<void>;
    logout: () => void;
    loadUserData: () => Promise<UserData | null>;
    saveSingleModeHistory: (data: any) => Promise<void>;
    saveBatchModeHistory: (data: any) => Promise<void>;
    clearAllHistory: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<GoogleUser | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const handleUser = async (firebaseUser: User | null) => {
        if (firebaseUser) {
            const { uid, displayName, email, photoURL } = firebaseUser;
            // FIX: The `GoogleUser` interface expects `imageUrl`, not `photoURL`.
            const appUser: GoogleUser = { id: uid, name: displayName, email, imageUrl: photoURL };
            setUser(appUser);

            const userData = await loadUserData(uid);
            if (userData?.apiKey) {
                setApiKey(userData.apiKey);
                initializeGeminiClient(userData.apiKey);
            } else {
                // User is authenticated but hasn't provided an API key yet
                setApiKey(null);
                clearGeminiClient();
            }
        } else {
            setUser(null);
            setApiKey(null);
            clearGeminiClient();
        }
        setIsLoading(false);
    }

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, handleUser);
        return () => unsubscribe();
    }, []);

    const loadUserData = useCallback(async (userId?: string): Promise<UserData | null> => {
        const currentUserId = userId || user?.id;
        if (!currentUserId) return null;

        try {
            const userDocRef = doc(db, 'users', currentUserId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
                return userDoc.data() as UserData;
            }
        } catch (error) {
            console.error("Error loading user data from Firestore:", error);
        }
        return null;
    }, [user]);

    const signInWithGoogleAndSetApiKey = async (key: string) => {
        if (!key.trim()) {
            throw new Error("API key cannot be empty.");
        }
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const firebaseUser = result.user;

            const userData: UserData = { apiKey: key.trim() };
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            
            // Set document with API key, merge to not overwrite history if it exists
            await setDoc(userDocRef, userData, { merge: true });

            await handleUser(firebaseUser); // Refresh user state
        } catch (error: any) {
            console.error("Google Sign-In Error:", error);
            // Don't sign the user out, just let them try again.
            throw new Error(error.message || "Failed to sign in with Google.");
        }
    };
    
    const logout = useCallback(async () => {
        await firebaseSignOut(auth);
        setUser(null);
        setApiKey(null);
        clearGeminiClient();
        window.location.reload();
    }, []);

    const saveSingleModeHistory = useCallback(async (data: any) => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.id);
        await setDoc(userDocRef, { singleModeSave: data }, { merge: true });
    }, [user]);

    const saveBatchModeHistory = useCallback(async (data: any) => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.id);
        await setDoc(userDocRef, { batchModeSave: data }, { merge: true });
    }, [user]);

    const clearAllHistory = useCallback(async () => {
        if (!user) return;
        const userDocRef = doc(db, 'users', user.id);
        // Using updateDoc to remove fields
        await updateDoc(userDocRef, {
            singleModeSave: null,
            batchModeSave: null
        });
    }, [user]);

    if (isLoading) {
        return (
             <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4 font-sans">
                <p className="text-slate-600">Initializing session...</p>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={{ user, apiKey, isLoading, signInWithGoogleAndSetApiKey, logout, loadUserData, saveSingleModeHistory, saveBatchModeHistory, clearAllHistory }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};