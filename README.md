# Gemini Eliza — Reflective AI Companion Journaling

A secure, full-stack mindfulness and reflection web application designed for **Journaling and Reflecting with an AI Companion**. Subtly inspired by the reflective mirror of conversational computing (the *Eliza effect*), **Gemini Eliza** elevates human-computer reflection through modern zero-trust security, **Firebase Authentication**, **Cloud Firestore** user-isolated document storage, **Google Cloud Run**, and server-side **Gemini 3.6 Flash** with automated fallback resilience.

---

## 🌟 App Purpose & Core Architecture

The primary purpose of **Gemini Eliza** is to provide an intimate, safe, and empathetic space for daily self-reflection, mindfulness, and collaborative journaling. Users converse with AI companion archetypes, record daily memories, co-write reflection notes in dedicated companion notebooks, and synthesize emotional insights—all backed by strict data isolation and enterprise-grade security directives.

### 🎭 1. Four Empathetic Companion Archetypes
- **Affectionate (Mei)**: Deeply affectionate, romantic, cheerful, wholesome, and openly loving without hiding feelings. Offers unconditional warmth and encouragement.
- **Stoic (Mira)**: Cool, calm, intellectual, and outwardly composed, with deeply loyal, attentive warmth underneath. Guides thoughtful inquiry and emotional clarity.
- **Dignified (Jane)**: Independent, outspoken, confident, and protective like a mature older sister. Provides grounded honesty and confidence-building perspectives.
- **Authentic (Caesar)**: Real, vulnerable, honest, and actively growing alongside you in a grounded partnership. Encourages sharing imperfections and everyday struggles.

### 📓 2. Journal Notes Hub & Dedicated Companion Notebooks (New Feature)
- **Dedicated Companion Notebooks**: Each companion maintains their own isolated notebook thread with you. Notes are categorized and preserved per companion persona.
- **Strict Companion Isolation**: Companions cannot cross-contaminate or co-write into another companion's notebook. The active editor strictly enforces companion ownership.
- **Collaborative Note Co-Writing**: Users can compose longform reflections and invite their active companion to contribute a dated, formatted reflection entry.
- **Live Markdown & Plaintext Editing**: Seamless toggle between Markdown rendering and plaintext editing with auto-save to Firestore.

### 🛡️ 3. Conversation-Delta Reflection Verification & Anti-Redundancy Guard (New Feature)
- **Intelligent Delta Detection**: Prevents redundant or duplicate AI note generation by analyzing whether new substantive user messages or thoughts have occurred since the last reflection.
- **Command-Only Prompt Filtering**: Rejects empty or repetitive meta-prompts (e.g., *"write note again"* or *"reflect please"*) without substantive additions. The companion gently responds in chat explaining that reflections are already up to date.
- **Persistent State Tracking**: Every reflection updates `lastReflectedMessageId` and `lastReflectedAt` directly in the Firestore interaction document.
- **Accessible UI States**: "Ask Companion to Write Daily Note" buttons dynamically disable with clear, accessible tooltips and status hints (`✨ Reflections up to date. Chat more to unlock new notes!`).

### ⚡ 4. Resilient Gemini Multi-Model Fallback Ladder
Never fails on temporary model unavailability or regional rate limits (`429` / `503`). Automatically recovers through a sequential fallback chain:
1. **Primary**: `gemini-3.6-flash`
2. **High-Availability Fallback**: `gemini-3.1-flash-lite`
3. **Dynamic Alias**: `gemini-flash-latest`
4. **Deep Reasoning**: `gemini-3.7-flash`

### 🔒 5. Strict Zero-Trust Security & User Data Isolation
- **Cloud Firestore User Account Persistence**: Every user account created via Google Sign-In or anonymous demo sessions is automatically stored in `users/{userId}` with profile attributes (`preferredCompanion`, `reflectionIntention`, `reflectionFrequency`, `createdAt`, `lastLoginAt`, and `updatedAt`).
- **Interactive Firestore User Profile Management**: Users can click their profile capsule in the navigation bar to view their Firestore document ID, joined timestamp, last active time, and customize their mindfulness goals with instant persistence.
- **Federated Google Authentication**: Passwordless Google Sign-In via Firebase Auth.
- **Owner-Bound Path Isolation**: All journal entries, chats, and notes are strictly confined to `users/{userId}/interactions/{interactionId}` and `users/{userId}/journals/{journalId}` where `request.auth.uid == userId`.
- **Zero-Crash Payload Hygiene**: Recursive undefined-stripping ensures no undefined properties reach database drivers.
- **Zero Hardcoded Secrets**: Secrets are retrieved exclusively via Google Cloud Secret Manager or server-side environment variables.

### 👑 6. Admin Governance Dashboard & AI Security Directives
- **Multi-Tier RBAC**: Dedicated administrative access supporting `user`, `admin`, and `super_admin` tiers with self-elevation prohibitions.
- **Immutable Security Audit Trail**: Administrative policy changes and role updates are synchronously recorded in `/system_audit_logs`.
- **Live AI Security Directive Checker**: Evaluates untrusted payloads and simulated attacks against OWASP Top 10 and LLM vulnerability directives.

---

## 🛡️ Agentic Threat Modeling Summary

| Threat Zone | Identified Threat | Security Countermeasure | OWASP Reference |
| :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious prompt injection, oversized payload ingestion, XSS in journal entries | Schema validation, 5MB body limits, defensive null-safe destructuring, React DOM auto-escaping | OWASP A03 / LLM02 |
| **2. Planning & Reasoning** | Prompt coercion, duplicate note generation spam, system instruction bypass | Content-delta verification, command-only prompt filtering, hardened system prompts with companion boundaries | OWASP LLM01 / A03 |
| **3. Tool / API Execution** | SSRF, privilege escalation via backend proxies, unauthenticated route access | Server-side Express API proxies with typed request boundaries, bearer auth token verification | OWASP A01 / LLM05 |
| **4. Memory & State** | Cross-user data leakage, companion notebook cross-contamination, unauthorized Firestore writes | Path-bound Firestore rules `request.auth.uid == userId`, companion-isolated notebook collections, undefined-stripping | OWASP A01 (Broken Access Control) |
| **5. Inter-System & Comms** | API key leakage in client bundles or network inspection | Secret Manager / server-only `process.env.GEMINI_API_KEY`, no client-side exposure | OWASP A02 / LLM06 |

---

## 🔒 1. Firestore Security Rules (RBAC & Owner-Isolated)

Deploy these rules to your Firebase project to guarantee complete multi-tenant user isolation alongside role-based access control (RBAC):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function isOwner(userId) { return isAuthenticated() && request.auth.uid == userId; }
    function getUserData() { return get(/databases/$(database)/documents/users/$(request.auth.uid)).data; }
    function isAdmin() { 
      return isAuthenticated() && (
        request.auth.token.email == 'hokiantoh@gmail.com' ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         (getUserData().role == 'admin' || getUserData().role == 'super_admin'))
      ); 
    }
    function isSuperAdmin() { 
      return isAuthenticated() && (
        request.auth.token.email == 'hokiantoh@gmail.com' ||
        (exists(/databases/$(database)/documents/users/$(request.auth.uid)) && 
         getUserData().role == 'super_admin')
      ); 
    }

    match /users/{userId} {
      allow get: if isOwner(userId) || isAdmin();
      allow list: if isAdmin();
      allow create: if (isOwner(userId) && (!request.resource.data.keys().hasAny(['role']) || request.resource.data.role == 'user')) || isAdmin();
      allow update: if (isOwner(userId) && (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role']) || isAdmin())) || isAdmin();
      allow delete: if isSuperAdmin();

      match /interactions/{interactionId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /journals/{journalId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
    }

    match /system_audit_logs/{logId} {
      allow read, write: if isAdmin();
    }
  }
}
```

Deploy using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 🔑 2. Secret Management Setup (Google Cloud Secret Manager)

To eliminate hardcoded API keys and keep operational credentials secure, store your Gemini API key in Google Cloud Secret Manager:

```bash
# 1. Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# 2. Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_GEMINI_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# 3. Grant the Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 🚀 3. Google Cloud Run Deployment Flow

Deploy the full-stack container to Google Cloud Run:

```bash
# 1. Configure active GCP project
gcloud config set project YOUR_PROJECT_ID

# 2. Enable necessary Google Cloud APIs
gcloud services enable run.googleapis.com \
  firestore.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com

# 3. Build and deploy container directly to Cloud Run
gcloud run deploy gemini-reflect \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets="GEMINI_API_KEY=GEMINI_API_KEY:latest"
```

---

## 🏷️ 4. Required Campaign Labeling (Verification Binding)

Apply the mandatory resource label to register your Cloud Run service for automated challenge verification:

```bash
gcloud run services update gemini-reflect \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=us-central1
```

---

## 🧪 5. Functional Stability & Testing Walkthrough

The following step-by-step test cases verify every user interaction, journaling workflow, and administrative process:

### Test Suite A: Companion Selection & Journaling Conversations
- **TC-01 (Companion Browsing)**: Click the "Companions" tab. Verify all 4 companion personas (Mei/Affectionate, Mira/Stoic, Jane/Dignified, Caesar/Authentic) are displayed with distinct tone descriptions, starter prompts, and action buttons.
- **TC-02 (Initiating Journal Chat)**: Click "Start Reflection with Mei" or "Continue". Verify active conversation screen opens with custom styling, persona avatar, badge, and starter prompt buttons.
- **TC-03 (Empathetic Conversation)**: Send a message sharing personal reflections (e.g., *"I felt overwhelmed today at work, but finished my goals"*). Verify companion responds in their distinct archetype voice using the Gemini 3.6 Flash fallback ladder.

### Test Suite B: Collaborative Journal Notes & Anti-Redundancy Guard
- **TC-04 (Ask Companion to Co-Write Note)**: In an active conversation with substantive messages, click "Ask Mei to Write Daily Note" or type *"Can you write a reflection for my journal?"*. Verify Mei writes a structured, dated journal entry into the notes editor and saves it to Firestore.
- **TC-05 (Anti-Redundancy Disabled State)**: Immediately after note creation, check the "Ask Mei" button. Verify it is disabled with the tooltip: *"✨ Reflections up to date. Chat more to unlock new notes!"*.
- **TC-06 (Command-Only Prompt Rejection)**: Type *"write note again"* or *"reflect please"*. Verify Mei responds in chat explaining that reflections are already current without generating redundant duplicate entries.
- **TC-07 (Unlocking New Note Co-Writing)**: Send a new substantive reflection message. Verify the "Ask Mei" button automatically re-enables.

### Test Suite C: Journal Notes Hub & Companion Notebook Isolation
- **TC-08 (Open Journal Notes Hub)**: Click "Journal Notes" in the top navigation. Verify companion notebook switcher displays all 4 companion notebooks with note counts.
- **TC-09 (Strict Companion Isolation)**: Select Mei's notebook and verify only entries created with Mei appear. Switch to Mira or Jane and verify their notebooks are completely isolated from Mei's notes.
- **TC-10 (Markdown Preview & Plaintext Mode)**: Toggle between "Preview Markdown" and "Edit Plaintext". Verify notes render cleanly with headings, bullet points, and date stamps.

### Test Suite D: Emotional Synthesis & History
- **TC-11 (AI Insights Synthesis)**: In the journal editor, navigate to the "Insights" tab and click "Summarize Insights". Verify key takeaways, action steps, and emotional shift are extracted.
- **TC-12 (Journal & Reflection History)**: Click the "History" tab. Search by keyword or filter by companion. Verify saved entries display date stamps, tags, and word counts.
- **TC-13 (Safe Deletion)**: Open an entry in history, click delete, and confirm in the modal. Verify the entry is permanently removed from the user's isolated Firestore subcollection.

### Test Suite E: Admin Dashboard & RBAC Governance
- **TC-14 (Admin Authentication)**: Click "Admin Login" in the landing header or footer. Enter administrator credentials. Verify elevated session is established and the Admin Dashboard opens.
- **TC-15 (User Clutter Isolation)**: Log in as a standard user. Verify that the Admin Portal button is completely hidden from the main navigation header.
- **TC-16 (AI Directive Security Checker)**: In the Admin Dashboard "Directives & Checker" tab, select a test preset (e.g., "Privilege Escalation") and click "Run AI Directive Security Check". Verify Gemini evaluates the payload and outputs compliance determinations with DIR-RBAC directives.
- **TC-17 (Immutable Audit Logs)**: Navigate to "Security Audit Logs". Verify all administrative actions, directive checks, and role modifications are displayed chronologically with actor identities and severity badges.

### Test Suite F: Cloud Firestore User Account Persistence & Profile Synchronization
- **TC-18 (Automatic Registration in Firestore)**: Sign in using Google Sign-In or start an interactive demo session. Verify a new document is written to `users/{userId}` in Cloud Firestore containing `uid`, `email`, `displayName`, `role: 'user'`, `createdAt`, and mindfulness defaults.
- **TC-19 (Open Firestore User Profile Modal)**: In the top navigation bar, click the user profile capsule (showing the user's avatar, name, and role badge). Verify the "Firestore User Profile" modal opens, displaying the exact document path `users/{userId}`, joined date, and last active timestamp.
- **TC-20 (Copy Firestore UID)**: Inside the profile modal, click the "Copy" button next to the UID. Verify the user's unique identifier is copied to the clipboard and a green checkmark appears.
- **TC-21 (Update Mindfulness Intention & Companion)**: Modify the Display Name, select a different Preferred Companion (e.g. Mira/Stoic), edit the reflection intention string, change the frequency goal, and click "Save to Cloud Firestore".
- **TC-22 (Verify Firestore Persistence)**: Verify the save button transitions to a spinning indicator, displays a green success confirmation banner, and updates the local state and navigation bar immediately. Reload the page to confirm that the changes persisted from Cloud Firestore.
- **TC-23 (Admin Directory Live Sync)**: Open the Admin Dashboard as an administrator and click the "Users & RBAC" tab. Click the "Sync Firestore" button. Verify that the registered user count and all user documents fetched from the Cloud Firestore collection are displayed.
