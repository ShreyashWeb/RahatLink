import { Radio, Wifi, Bluetooth, MessageSquare, QrCode, Shield, Clock } from 'lucide-react';

interface RoadmapModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RoadmapModal({ isOpen, onClose }: RoadmapModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#F1D5BF] space-y-4 animate-scaleUp overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#0B1B3A] text-white flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#F26A1B]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1B3A]">
                Technology Architecture & Roadmap
              </h3>
              <p className="text-[11px] text-[#6B7280]">
                Team CodeForge • SRIJAN 2K26 Architecture Scope
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Status Callout Banner */}
        <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-3.5 space-y-1">
          <div className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#F26A1B]" />
            <span>DPDP Compliant Offline-First Paradigm</span>
          </div>
          <p className="text-[11px] text-[#6B7280]">
            RahatLink runs 100% locally with zero cloud dependencies and zero paid APIs. All data exchanges stay within the disaster neighbourhood perimeter.
          </p>
        </div>

        {/* Feature Matrix */}
        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {/* Active 1: Local Mesh & Yjs WebRTC */}
          <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-700" />
                Local Wi-Fi Mesh & WebRTC PWA
              </span>
              <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                Active & Tested
              </span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Zero-cloud CRDT sync via Yjs, y-indexeddb local persistence, and browser-to-browser WebRTC signaling through local Node.js hub.
            </p>
          </div>

          {/* Active 2: Air-Gapped QR Snapshot Sync */}
          <div className="p-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-700" />
                Air-Gapped Multi-Part QR Sync
              </span>
              <span className="bg-emerald-200 text-emerald-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                Active & Tested
              </span>
            </div>
            <p className="text-[11px] text-emerald-800">
              DEFLATE compression + base64 chunked QR codes allow coordinators and volunteers to exchange dispatch assignments with zero radio frequency connectivity.
            </p>
          </div>

          {/* Active 3: SMS Gateway Ingestion & Heuristic Parser */}
          <div className="p-3 rounded-2xl border border-blue-200 bg-blue-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-blue-700" />
                Hinglish SMS Ingestion & Triage
              </span>
              <span className="bg-blue-200 text-blue-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">
                Active (Simulated Gateway)
              </span>
            </div>
            <p className="text-[11px] text-blue-800">
              Rule-based NLP extracts urgency, people counts, needs, and location hints from messy Hinglish messages. Simulated gateway endpoint POST /sms.
            </p>
          </div>

          {/* Roadmap 1: Bluetooth Mesh */}
          <div className="p-3.5 rounded-2xl border border-purple-300 bg-purple-50/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-purple-950 flex items-center gap-1.5">
                <Bluetooth className="w-4 h-4 text-purple-700" />
                Hardware Bluetooth Low Energy (BLE) Mesh
              </span>
              <span className="bg-purple-200 text-purple-900 text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                Roadmap Only
              </span>
            </div>
            <p className="text-[11px] text-purple-800">
              Native BLE ad-hoc flooding mesh is in the post-hackathon roadmap. Intentionally not implemented in hackathon build per SRIJAN 2K26 specification (Hard Rule #5).
            </p>
          </div>

          {/* Roadmap 2: Commercial Telco SMS Gateway */}
          <div className="p-3.5 rounded-2xl border border-gray-300 bg-gray-50/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-gray-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-500" />
                Commercial Telco GSM Hardware Dongle
              </span>
              <span className="bg-gray-200 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                Roadmap
              </span>
            </div>
            <p className="text-[11px] text-gray-600">
              Physical USB GSM dongle / Twilio webhook connection is planned for municipality deployment. Demo runs on local REST simulation.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <span className="text-[10px] text-gray-400">
            Complies with Competition Hard Rule #5
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold bg-[#0B1B3A] text-white hover:bg-[#1a2d52] rounded-xl"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
