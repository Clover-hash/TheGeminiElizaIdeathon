# Implementation Steps: Gemini Eliza Platform

This document details the end-to-end implementation steps, architectural decisions, unique features, and the utilization of **Google AI Studio** throughout the engineering lifecycle of **Gemini Eliza** (subtly named in tribute to the reflective nature of the conversational *Eliza effect*).

---

## 🛡️ Agentic Threat Modeling (5 Security Zones)

Before implementing features, an OWASP-aligned threat model was established across all 5 threat zones:

| Threat Zone | Identified Vector | OWASP Ref | Architectural Countermeasure |
| :--- | :--- | :--- | :--- |
| **1. Input Surfaces** | Malicious prompt injection, excessive payload ingestion, XSS in journal entries | OWASP A03 / LLM02 | Express JSON body limit (5MB), strict parameter sanitization, React DOM auto-escaping, defensive null-safe destructuring |
| **2. Planning & Reasoning** | System instruction bypass, model manipulation, redundant note generation spam | OWASP LLM01 / A03 | Hardened archetype system instructions, conversation-delta verification, command-only prompt filtering |
| **3. Tool / API Execution** | API key leakage, unauthorized elevation, SSRF | OWASP A01 / LLM05 | Server-side Express API proxies (`/api/*`), token verification, secret storage in Cloud Secret Manager / `.env` |
| **4. Memory & State** | Cross-tenant data leakage, notebook cross-contamination, unauthorized Firestore writes | OWASP A01 (Broken Access Control) | Owner-bound Firestore security rules (`request.auth.uid == userId`), persona notebook isolation, recursive undefined-stripping |
| **5. Inter-System Comms** | Exposure of Gemini API credentials in frontend bundles | OWASP A02 / LLM06 | Strict server-side proxying; zero client-side `VITE_` API key exposure |

---

## 🚀 Step-by-Step Implementation Roadmap

### Step 1: System Architecture & Workspace Bootstrapping
1. **Full-Stack Scaffold**: Configured a unified Vite + React 18 frontend and Node.js/Express backend (`server.ts`).
2. **Build Configuration**: Configured `package.json` with `tsx` development booting and `esbuild` CommonJS server bundling into `dist/server.cjs` for containerized Google Cloud Run deployments.
3. **Design System**: Established a Tailwind CSS palette with custom typography pairings, responsive layouts, and zero visual overlapping.

---

### Step 2: Prototyping & Prompt Engineering in Google AI Studio
Google AI Studio served as the foundational workbench for crafting, tuning, and testing our multi-persona conversational and journaling engines:

1. **System Instruction Prototyping in AI Studio**:
   - Designed 4 archetypes with distinct emotional registers:
     - **Mei (Affectionate)**: High warmth, supportive optimism, wholesome celebration, gentle expressive tone.
     - **Mira (Stoic)**: Measured, concise, intellectual clarity, observant subtle loyalty.
     - **Jane (Dignified)**: Assertive, mature older-sister guidance, protective accountability.
     - **Caesar (Authentic)**: Vulnerable, relatable, grounded self-awareness, shared humanity.
   - Tested anti-prose constraints in Google AI Studio prompt builder to eliminate unwanted third-person narrative action tags (e.g., `*smiles warmly*` or `*looks at notebook*`), ensuring natural first-person conversational dialogue.

2. **Model Parameter Tuning**:
   - Experimented with temperature (0.75 for conversation, 0.4 for note synthesis) to balance emotional warmth with factual coherence.
   - Evaluated response latency across `gemini-3.6-flash`, `gemini-3.1-flash-lite`, and `gemini-3.7-flash` in AI Studio to construct our fallback ladder.

3. **Structured Co-Writing Prompt Testing**:
   - In Google AI Studio, developed few-shot prompts instructing the model to synthesize raw dialogue into structured markdown notes with titles, mood badges, reflections, and growth takeaways.

---

### Step 3: Resilient Gemini Service Layer (`server.ts` & `geminiService.ts`)
1. **Server-Side Proxy**: Implemented `/api/chat` and `/api/reflect` in Express using `@google/genai`.
2. **4-Tier Resilient Fallback Ladder**:
   - Created `generateContentWithFallback()` which catches transient HTTP `429` (Rate Limit) and `503` (Overloaded) errors and fails over sequentially:
     ```
     Primary: gemini-3.6-flash
     ↳ High-Availability: gemini-3.1-flash-lite
       ↳ Dynamic Alias: gemini-flash-latest
         ↳ Deep Reasoning: gemini-3.7-flash
     ```
3. **Defensive Ingestion**: Guarded all route handlers with fallback defaults to eliminate uncaught destructuring exceptions.

---

### Step 4: Building Unique & High-Value Features

#### A. Dedicated Companion Notebooks & Notes Hub
- **Architecture**: Segregated notes by `characterId` so each companion has an isolated reflection log.
- **Strict Isolation**: Companions cannot cross-read or co-write into another companion's journal.
- **Dual-Mode Editor**: Built-in Markdown preview and plaintext editing with auto-save indicators and live word/character counters.

#### B. Conversation-Delta Verification & Anti-Redundancy Guard
- **The Problem**: Users repeatedly tapping "Ask Companion to Write Daily Note" would generate redundant or duplicate notes without new conversational context.
- **The Solution**:
  - Tracked `lastReflectedMessageId` and `lastReflectedAt` per interaction in Cloud Firestore.
  - Implemented client- and server-side delta checking that detects whether substantive new user thoughts have been submitted.
  - Filtered out meta/command-only triggers (e.g., *"write note"*, *"reflect please"*).
  - Provided clear, accessible button tooltips (`✨ Reflections up to date. Chat more to unlock new notes!`).

#### C. Interactive Cloud Firestore User Profile & Settings
- **Direct Document Binding**: Users can inspect their real Cloud Firestore path (`users/{userId}`) directly in a profile modal.
- **Configurable Intentions**: Real-time editing of mindfulness intentions, reflection frequencies, and preferred companions with optimistic updates and guaranteed persistence.

#### D. Admin Governance Dashboard & AI Directives Evaluator
- **Role-Based Access Control (RBAC)**: Supports `user`, `moderator`, `admin`, and `super_admin` tiers.
- **Live AI Directives Checker**: Administrators can simulate untrusted inputs and test enforcement against OWASP LLM vulnerabilities in real-time.
- **Audit Logging**: Logs administrative modifications to `/system_audit_logs`.

---

### Step 5: Cloud Firestore Integration & Zero-Crash Data Hygiene
1. **Schema Design**: Modeled user collections (`users/{userId}`), interaction threads (`users/{userId}/interactions/{interactionId}`), and journal notes (`users/{userId}/journals/{journalId}`).
2. **Undefined-Stripping Protocol**: Created recursive sanitization utilities (`stripUndefinedFields`) to guarantee no `undefined` keys crash Firestore writes.
3. **Owner-Bound Security Rules**: Deployed `firestore.rules` checking `request.auth.uid == userId` and enforcing administrative protections.

---

### Step 6: Layout Polishing & Anti-Overlap Engineering
1. **Responsive Navbar**: Used `whitespace-nowrap`, `shrink-0`, and responsive visibility breakpoints (`hidden sm:inline`, `hidden lg:inline`, `hidden xl:inline`) to prevent nav pill collisions.
2. **Indicator Protection**: Fixed status indicators and avatar capsules with explicit dimensions and shrink prevention.
3. **Responsive Viewport Support**: Ensured zero clipping across mobile, tablet, and desktop viewports.

---

### Step 7: Verification & Test Walkthrough
Conducted full validation using a 23-test-case verification suite (TC-01 through TC-23) covering authentication, multi-companion dialogue, delta note gating, Firestore sync, and role-based administration. Verified with `lint_applet` and `compile_applet`.
