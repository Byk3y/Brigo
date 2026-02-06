<p align="center">
  <img src="assets/icon.png" width="120" alt="Brigo Logo" />
</p>

<h1 align="center">Brigo</h1>

<p align="center">
  <strong>AI-Powered Study Companion</strong><br/>
  Transform any study material into flashcards, quizzes, and audio summaries
</p>

<p align="center">
  <a href="https://brigo.app">Website</a> •
  <a href="https://apps.apple.com/app/brigo">App Store</a> •
  <a href="https://brigo.app/privacy">Privacy</a> •
  <a href="https://brigo.app/terms">Terms</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-iOS-blue?style=flat-square" alt="iOS" />
  <img src="https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo" alt="Expo" />
  <img src="https://img.shields.io/badge/React%20Native-0.81-61dafb?style=flat-square&logo=react" alt="React Native" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
</p>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📚 **Smart Flashcards** | AI-generated cards with spaced repetition |
| 🧠 **Adaptive Quizzes** | Difficulty adjusts to your performance |
| 🎙️ **Audio Summaries** | Listen to your materials like a podcast |
| 💬 **AI Tutor Chat** | Ask questions about your exact materials |
| 🐾 **Study Pet** | Virtual companion that grows with your streaks |
| 🔮 **Exam Predictions** | AI predicts likely exam questions |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Framework** | Expo 54 (React Native 0.81) |
| **Language** | TypeScript 5.9 |
| **Navigation** | Expo Router 6 |
| **State** | Zustand |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Auth** | Supabase Auth (Email, Google, Apple) |
| **Payments** | RevenueCat |
| **AI** | OpenAI GPT-4o, Google Gemini |
| **Analytics** | Mixpanel |
| **Animations** | Moti + Reanimated |

## 🚀 Quick Start

```bash
# Clone and install
git clone <repo>
cd brigo
npm install

# Setup environment
cp .env.example .env
# Fill in your Supabase and API keys

# Install iOS dependencies
cd ios && pod install && cd ..

# Run development build
npx expo run:ios
```

## 📁 Project Structure

```
app/                     # Expo Router screens
├── (tabs)/              # Main tab navigation
├── onboarding/          # Onboarding flow
├── quiz/                # Quiz player
├── flashcards/          # Flashcard viewer
└── audio-player/        # Podcast player

components/              # Reusable UI components
lib/
├── store/               # Zustand state management
├── services/            # API and business logic
└── supabase.ts          # Database client

supabase/functions/      # Edge Functions (Deno)
```

## 💰 Business Model

- **Free Tier:** 2 notebooks, basic features
- **Pro Tier:** Unlimited notebooks, priority AI, all features
- **Pricing:** Weekly intro offer → Semester (3-month) subscription

## 🔐 Security

- Row Level Security (RLS) on all Supabase tables
- No hardcoded secrets (environment variables only)
- GDPR compliant (Mixpanel EU data residency)

## 📦 Deployment

```bash
# Production build
eas build --platform ios --profile production

# Submit to App Store
eas submit --platform ios
```

---

<p align="center">
  <a href="https://brigo.app">brigo.app</a>
</p>

<p align="center">
  <sub>© 2026 Brigo. All rights reserved.</sub>
</p>
