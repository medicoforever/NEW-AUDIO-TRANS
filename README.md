# AI Audio Transcription & Translation

An AI-powered tool to record or upload audio, which then provides a complete and accurate English transcript. The app identifies the audio's language, translates if necessary, and corrects grammatical mistakes for a polished output.

**[➡️ View Live Demo](https://new-audio-trans.vercel.app/)**  
*(Replace the link above with your actual Vercel deployment URL)*

---
  
![Application Screenshot](app-audio-to-trans.png)

## ✨ Key Features

-   **🎙️ Flexible Audio Input**: Record audio directly in the browser or upload existing audio files.
-   **⚡ AI-Powered Transcription**: Utilizes Google's Gemini AI to generate fast and accurate transcripts.
-   **🌐 Auto-Translation & Correction**: Automatically detects the source language, translates it to English, and corrects grammatical errors.
-   **💬 AI Follow-up Chat**: Engage in a conversation with the AI to ask questions or get summaries based on the audio's content.
-   **📦 Batch Processing**: Efficiently manage and transcribe multiple audio files at once.
-   **☁️ Cloud Sync & History**: Securely sign in with your Google account to save your transcription history and sync it across all your devices (PC, tablet, mobile).
-   **🔑 Secure API Key Management**: Your Gemini API key is linked to your account and stored securely in the cloud, so you only need to enter it once.

## 🛠️ Technologies Used

-   **Frontend**: [React](https://reactjs.org/) with [TypeScript](https://www.typescriptlang.org/)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **AI Model**: [Google Gemini API](https://ai.google.dev/) (`@google/genai`)
-   **Backend & Database**: [Firebase](https://firebase.google.com/) (Authentication & Firestore)
-   **Deployment**: [Vercel](https://vercel.com/)

## 🚀 Getting Started

Follow these instructions to set up and run the project locally.

### 1. Prerequisites

-   [Node.js](https://nodejs.org/en/) (v18 or later recommended)
-   A package manager like `npm` or `yarn`

### 2. Clone the Repository

```bash
git clone https://github.com/medicoforever/NEW-AUDIO-TRANS.git
cd NEW-AUDIO-TRANS
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up Firebase

This project uses Firebase for user authentication (Google Sign-In) and Firestore for storing user data (API key and history).

1.  **Create a Firebase Project**: Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2.  **Create a Web App**: In your project dashboard, click the web icon (`</>`) to register a new web app.
3.  **Get Config**: After registering, Firebase will provide you with a `firebaseConfig` object. Copy this entire object.
4.  **Update Code**: Open the file `src/services/firebaseConfig.ts` and replace the existing placeholder object with the one you just copied.
5.  **Enable Google Auth**: In the Firebase console, go to **Build > Authentication > Sign-in method** and enable the **Google** provider.
6.  **Set Up Firestore**: Go to **Build > Firestore Database**, click **Create database**, and start it in **test mode**.

### 5. Get a Gemini API Key

1.  Go to [Google AI Studio](https://aistudio.google.com/app/apikey).
2.  Click **"Create API key"** to get your key.
3.  You will use this key when you first sign in to the application.

### 6. Run the Project Locally

```bash
npm run dev
```

The application should now be running on `http://localhost:5173`.

## 🌐 Deployment

This project is configured for easy deployment with [Vercel](https://vercel.com/).

1.  **Push to GitHub**: Make sure your local repository is up-to-date and pushed to your GitHub account.
2.  **Import to Vercel**: On your Vercel dashboard, click **"Add New... -> Project"** and import your GitHub repository.
3.  **Deploy**: Vercel will automatically detect the project settings. Simply click **"Deploy"**.

After a minute, your site will be live on a public URL!
