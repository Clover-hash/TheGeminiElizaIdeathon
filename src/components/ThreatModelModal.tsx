import React from 'react';
import { Shield, CheckCircle2, Lock, Key, Database, Cpu, X } from 'lucide-react';
import { ThreatZoneCountermeasure } from '../types';

interface ThreatModelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const threatData: ThreatZoneCountermeasure[] = [
  {
    zone: '1. Input Surfaces',
    threat: 'Malicious prompt injection, oversized payload ingestion, XSS in journal entries',
    mitigation: 'Defensive null-safe destructuring, 5MB body limits, React DOM auto-escaping, and strict schema validation.',
    owaspRef: 'OWASP LLM01 / LLM02',
    status: 'Enforced',
  },
  {
    zone: '2. Planning & Reasoning',
    threat: 'System prompt hijacking, model hallucination, service degradation during high load',
    mitigation: 'Contextual system boundaries, resilient fallback ladder (Gemini 3.6 Flash -> 3.1 Flash Lite -> Latest -> 3.7 Flash).',
    owaspRef: 'OWASP LLM01 / A03',
    status: 'Implemented',
  },
  {
    zone: '3. Tool Execution & API',
    threat: 'SSRF, unauthorized backend route traversal, unauthenticated API calls',
    mitigation: 'Backend Express isolation, typed JSON payloads, strict route verification, and server-side secret binding.',
    owaspRef: 'OWASP A01 / A03',
    status: 'Enforced',
  },
  {
    zone: '4. Memory & State',
    threat: 'Cross-user journal leaks, unauthorized reads/writes in Firestore',
    mitigation: 'Owner-bound Firestore Security Rules (request.auth.uid == userId) on path /users/{userId}/interactions/{id}, undefined-stripping.',
    owaspRef: 'OWASP A01 (Broken Access Control)',
    status: 'Enforced',
  },
  {
    zone: '5. Inter-System & Secrets',
    threat: 'Exposing Gemini API keys or service tokens in frontend bundles',
    mitigation: 'Zero-hardcoded secrets; Gemini API key strictly confined to server-side process.env and Secret Manager.',
    owaspRef: 'OWASP A02 / A07',
    status: 'Enforced',
  },
];

export const ThreatModelModal: React.FC<ThreatModelModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div id="threat-model-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Agentic Threat Model &amp; Security Architecture</h2>
              <p className="text-sm text-slate-500">OWASP Top 10 &amp; 5 Threat Zones Compliance</p>
            </div>
          </div>
          <button
            id="close-threat-model-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Lock className="w-5 h-5 text-indigo-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">User Isolation</p>
                <p className="text-sm font-medium text-slate-800">Owner-Bound Rules (`request.auth.uid == userId`)</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Key className="w-5 h-5 text-emerald-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Secret Hygiene</p>
                <p className="text-sm font-medium text-slate-800">Zero-Hardcoding / Server-Side Gemini Proxy</p>
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Cpu className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Model Resilience</p>
                <p className="text-sm font-medium text-slate-800">4-Tier Fallback Ladder (3.6 Flash / 3.1 / Latest / 3.7)</p>
              </div>
            </div>
          </div>

          {/* Threat Summary Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Threat Zone</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Attack Vector &amp; Scenario</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Active Countermeasure</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">OWASP Lens</th>
                  <th scope="col" className="px-4 py-3 font-semibold text-slate-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {threatData.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-semibold text-slate-900 whitespace-nowrap">{item.zone}</td>
                    <td className="px-4 py-3.5 text-slate-600">{item.threat}</td>
                    <td className="px-4 py-3.5 text-slate-700">{item.mitigation}</td>
                    <td className="px-4 py-3.5 text-xs font-mono text-indigo-600 whitespace-nowrap">{item.owaspRef}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Security Rules Preview */}
          <div className="bg-slate-900 rounded-xl p-4 text-slate-200 font-mono text-xs overflow-x-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-slate-400 mb-2">
              <span className="flex items-center gap-2 font-sans font-semibold">
                <Database className="w-4 h-4 text-emerald-400" />
                Deployed Firestore Security Rules (Isolation Standard)
              </span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded">firestore.rules</span>
            </div>
            <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/interactions/{interactionId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}`}</pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            id="dismiss-threat-model-btn"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-medium text-sm transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
