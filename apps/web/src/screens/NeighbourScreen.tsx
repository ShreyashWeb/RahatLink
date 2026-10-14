import { useState } from 'react';
import type { Household, CheckIn, Report } from '@rahatlink/core';
import { translations, Language } from '../i18n';
import {
  Users,
  CheckCircle,
  AlertTriangle,
  Smartphone,
  PhoneOff,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface NeighbourScreenProps {
  currentHousehold: Household;
  households: Household[];
  lang: Language;
  onProxyCheckIn: (checkIn: CheckIn) => void;
  onNudgeEscalation: (householdId: string, note: string) => void;
  onSendReport: (report: Report) => void;
}

export function NeighbourScreen({
  currentHousehold,
  households,
  lang,
  onProxyCheckIn,
  onNudgeEscalation,
  onSendReport,
}: NeighbourScreenProps) {
  const t = translations[lang];
  const [feedback, setFeedback] = useState<string | null>(null);

  // Households this neighbour looks after (either explicitly assigned or without smartphone)
  const proxyHouseholds = households.filter(
    (h) => h.id !== currentHousehold.id && (h.proxyNeighbourId === currentHousehold.id || !h.hasSmartphone),
  );

  const fallbackHouseholds = proxyHouseholds.length > 0
    ? proxyHouseholds
    : households.filter((h) => h.id !== currentHousehold.id);

  const handleSawThem = (household: Household) => {
    const checkIn: CheckIn = {
      id: `ci-proxy-${Date.now()}`,
      householdId: household.id,
      at: new Date().toISOString(),
      by: 'neighbour',
      batteryPct: household.lastBattery ?? 80,
    };

    onProxyCheckIn(checkIn);
    setFeedback(`Confirmed safety for ${household.name}. Check-in saved.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleCantReach = (household: Household) => {
    onNudgeEscalation(
      household.id,
      `Neighbour proxy (${currentHousehold.name}) reported unable to reach ${household.name}`,
    );

    const report: Report = {
      id: `rep-nudge-${Date.now()}`,
      at: new Date().toISOString(),
      lat: household.lat,
      lng: household.lng,
      text: `Neighbour proxy note: Unable to contact or sight ${household.name} at ${household.address}`,
      source: 'app',
      parsed: {
        type: 'neighbour-nudge',
        urgency: 'MEDIUM',
        matchedHouseholdId: household.id,
      },
    };
    onSendReport(report);

    setFeedback(`Alert nudged for ${household.name}. Escalation ladder notified.`);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Header Info Banner */}
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-2">
        <div className="flex items-center gap-2 text-[#0B1B3A]">
          <Users className="w-5 h-5 text-[#F26A1B]" />
          <h2 className="text-lg font-bold">{t.neighbour.title}</h2>
        </div>
        <p className="text-xs text-[#6B7280]">
          {t.neighbour.subtitle}
        </p>
        <div className="text-xs text-[#0B1B3A] font-semibold pt-1">
          Active Proxy: <span className="text-[#F26A1B]">{currentHousehold.name}</span>
        </div>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-[#0F7A5F] rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <ShieldCheck className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Household Cards */}
      <div className="space-y-4">
        {fallbackHouseholds.map((h) => {
          const lastTime = h.lastCheckInAt
            ? new Date(h.lastCheckInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : 'Never';

          return (
            <div
              key={h.id}
              className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4 hover:border-[#F26A1B]/40 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#0B1B3A]">{h.name}</h3>
                  <p className="text-xs text-[#6B7280]">{h.address} • Floor {h.floor ?? 1}</p>
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                    h.status === 'ok'
                      ? 'bg-emerald-100 text-[#0F7A5F]'
                      : 'bg-amber-100 text-[#D97706]'
                  }`}
                >
                  {h.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF] flex items-center gap-2">
                  {h.hasSmartphone ? (
                    <>
                      <Smartphone className="w-4 h-4 text-[#2F6FDE] shrink-0" />
                      <span>Has Smartphone</span>
                    </>
                  ) : (
                    <>
                      <PhoneOff className="w-4 h-4 text-[#D97706] shrink-0" />
                      <span className="font-semibold text-[#D97706]">No Smartphone (Proxy Needed)</span>
                    </>
                  )}
                </div>

                <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6B7280] shrink-0" />
                  <span>{t.neighbour.lastChecked} <strong>{lastTime}</strong></span>
                </div>
              </div>

              {/* Action Buttons for Neighbour */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {/* Button 1: I saw them */}
                <button
                  type="button"
                  onClick={() => handleSawThem(h)}
                  className="w-full py-3 bg-[#0F7A5F] hover:bg-[#0c624c] text-white font-bold text-xs rounded-2xl shadow transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{t.neighbour.sawThem}</span>
                </button>

                {/* Button 2: Can't reach them */}
                <button
                  type="button"
                  onClick={() => handleCantReach(h)}
                  className="w-full py-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs rounded-2xl transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>{t.neighbour.cantReach}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
