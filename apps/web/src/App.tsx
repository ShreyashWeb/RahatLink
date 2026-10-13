import { useState } from 'react';
import type { Household, Task, Settings } from '@rahatlink/core';
import { DEFAULT_SETTINGS } from '@rahatlink/core';
import { Shield, Radio, Users, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export default function App() {
  const [settings] = useState<Settings>(DEFAULT_SETTINGS);

  // Demo state typed with @rahatlink/core models
  const [sampleHousehold] = useState<Household>({
    id: 'h-101',
    name: 'Sharma Residence',
    lat: 26.8467,
    lng: 80.9462,
    address: 'House 12, Gomti Nagar, Lucknow',
    contactPhone: '+91 98765 43210',
    householdSize: 2,
    hasSmartphone: true,
    graceHours: 24,
    lastCheckInAt: new Date().toISOString(),
    lastBattery: 85,
    consent: { health: true, grantedAt: new Date().toISOString() },
    status: 'ok',
  });

  const [sampleTask] = useState<Task>({
    id: 't-101',
    householdIds: ['h-101'],
    riskTier: 'LOW',
    score: 18,
    breakdown: [{ factor: 'silenceBeyondGrace', points: 0, description: 'Checked in on time' }],
    status: 'suggested',
    createdAt: new Date().toISOString(),
  });

  return (
    <div className="min-h-screen bg-[#FFF6EE] text-[#1F2937] flex flex-col">
      {/* Top Simulated Data Ribbon */}
      <div className="bg-[#0B1B3A] text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2">
        <span className="bg-[#F26A1B] text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
          Simulated Data
        </span>
        <span>RahatLink Prototype • Offline-first local mesh & zero paid APIs</span>
      </div>

      {/* Human-in-the-loop Governance Banner */}
      <div className="bg-[#FDE8D7] border-b border-[#F1D5BF] py-2 px-4 text-center text-xs sm:text-sm font-semibold text-[#C2500F] flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-[#F26A1B]" />
        <span>RahatLink suggests. A coordinator decides.</span>
      </div>

      {/* Navigation / Header */}
      <header className="bg-white border-b border-[#F1D5BF] py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0B1B3A] flex items-center justify-center text-white shadow">
              <Radio className="w-6 h-6 text-[#F26A1B]" />
            </div>
            <div>
              <div className="text-xl font-bold tracking-tight text-[#0B1B3A]">
                Rahat<span className="text-[#F26A1B]">Link</span>
              </div>
              <div className="text-xs text-[#6B7280]">
                Team <span className="text-[#0B1B3A] font-semibold">Code</span>
                <span className="text-[#F26A1B] font-semibold">Forge</span> | SRIJAN 2K26
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#E8ECF4] text-[#0B1B3A]">
              <span className="w-2 h-2 rounded-full bg-[#0F7A5F]"></span>
              Hub Connected (:4444)
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Hero Tagline Banner */}
        <section className="bg-white border border-[#F1D5BF] rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0B1B3A] mb-2">
            Other apps wait for an SOS. <span className="text-[#F26A1B]">RahatLink notices who went silent.</span>
          </h1>
          <p className="text-sm text-[#6B7280] max-w-3xl">
            Detecting missed daily check-ins for elderly, ill, and trapped residents during peacetime and disaster.
            Pure offline synchronization via local CRDT, explainable DBSCAN clustering, and consent-guarded health profiles.
          </p>
        </section>

        {/* Status Dashboard Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Resident Check-in */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2F6FDE]" />
                Resident Check-In
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-[#0F7A5F] border border-emerald-200">
                <CheckCircle className="w-3 h-3" /> OK
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="font-semibold text-[#0B1B3A]">{sampleHousehold.name}</div>
              <div className="text-xs text-[#6B7280]">{sampleHousehold.address}</div>
              <div className="text-xs text-[#6B7280]">
                Grace Window: <span className="font-medium text-[#1F2937]">{sampleHousehold.graceHours}h</span>
              </div>
            </div>
            <button
              type="button"
              className="w-full h-14 bg-[#0F7A5F] hover:bg-[#0c624c] text-white text-base font-bold rounded-xl shadow transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              I'm Okay (Tap to Check In)
            </button>
          </div>

          {/* Card 2: Silence & Risk Engine */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#D97706]" />
                Engine Status
              </h2>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-[#2F6FDE] border border-blue-200">
                Tier {sampleTask.riskTier}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="text-xs text-[#6B7280]">Mode</div>
              <div className="font-semibold text-[#0B1B3A]">
                {settings.disasterMode ? 'Disaster Escalation' : 'Peacetime Monitoring (24h)'}
              </div>
              <div className="text-xs text-[#6B7280]">Grace Factor</div>
              <div className="font-semibold text-[#0B1B3A]">{settings.disasterGraceFactor}x</div>
            </div>
            <div className="p-3 bg-[#E8ECF4] rounded-xl text-xs text-[#0B1B3A]">
              DBSCAN: 150m radius • Auto-ladder walks: due ➔ grace ➔ reminded ➔ pinged ➔ flagged
            </div>
          </div>

          {/* Card 3: Privacy & Coordinator Action */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#F26A1B]" />
                Coordinator Queue
              </h2>
              <span className="text-xs font-bold text-[#6B7280]">Task #{sampleTask.id}</span>
            </div>
            <div className="text-sm space-y-1">
              <div className="font-semibold text-[#0B1B3A]">Household ID: {sampleHousehold.id}</div>
              <div className="text-xs text-[#6B7280]">
                Health consent: {sampleHousehold.consent.health ? 'Granted (Gated)' : 'Not granted'}
              </div>
              <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 mt-2">
                Volunteer sees no health data until task acceptance.
              </div>
            </div>
            <button
              type="button"
              className="w-full h-11 bg-[#0B1B3A] hover:bg-[#12264D] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Coordinator Review
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#F1D5BF] py-4 px-6 text-center text-xs text-[#6B7280]">
        RahatLink • Team CodeForge • Monorepo scaffold verified (@rahatlink/core + apps/web + apps/hub)
      </footer>
    </div>
  );
}
