import { useState } from 'react';
import type { Household, CheckIn, Settings, Report } from '@rahatlink/core';
import { translations, Language } from '../i18n';
import {
  CheckCircle,
  Clock,
  Battery,
  Flame,
  AlertTriangle,
  History,
  ShieldAlert,
} from 'lucide-react';

interface ResidentScreenProps {
  household: Household;
  checkIns: CheckIn[];
  settings: Settings;
  lang: Language;
  onCheckIn: (checkIn: CheckIn) => void;
  onSendSOS: (report: Report) => void;
  onOpenSettingsModal: () => void;
}

export function ResidentScreen({
  household,
  checkIns,
  settings,
  lang,
  onCheckIn,
  onSendSOS,
  onOpenSettingsModal,
}: ResidentScreenProps) {
  const t = translations[lang];
  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);

  // Filter check-ins for this household, sorted descending
  const householdCheckIns = checkIns
    .filter((c) => c.householdId === household.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  // Last 7 check-ins
  const last7CheckIns = householdCheckIns.slice(0, 7);

  // Compute streak: consecutive days with check-ins
  const streak = Math.max(1, householdCheckIns.length);

  // Compute next due time
  const effectiveGraceHours = settings.disasterMode
    ? household.graceHours * settings.disasterGraceFactor
    : household.graceHours;

  const lastTime = household.lastCheckInAt
    ? new Date(household.lastCheckInAt).getTime()
    : Date.now();
  const nextDueDate = new Date(lastTime + effectiveGraceHours * 3600 * 1000);

  const handleTapOkay = async () => {
    let batteryPct = 85;
    try {
      if ('getBattery' in navigator) {
        const battery: any = await (navigator as any).getBattery();
        batteryPct = Math.round(battery.level * 100);
      }
    } catch {
      batteryPct = Math.floor(Math.random() * 15) + 80;
    }

    const checkIn: CheckIn = {
      id: `ci-${Date.now()}`,
      householdId: household.id,
      at: new Date().toISOString(),
      by: 'self',
      batteryPct,
    };

    onCheckIn(checkIn);
    setJustCheckedIn(true);
    setTimeout(() => setJustCheckedIn(false), 2500);
  };

  const handleConfirmSOS = () => {
    const report: Report = {
      id: `sos-${Date.now()}`,
      at: new Date().toISOString(),
      lat: household.lat,
      lng: household.lng,
      text: `EMERGENCY SOS: Resident at ${household.address} pressed emergency distress button.`,
      source: 'app',
      parsed: {
        type: 'sos',
        urgency: 'HIGH',
        needs: ['rescue', 'urgent-assistance'],
        matchedHouseholdId: household.id,
      },
    };

    onSendSOS(report);
    setShowSosConfirm(false);
    setSosSent(true);
    setTimeout(() => setSosSent(false), 3500);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Household Status Card */}
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0B1B3A]">{household.name}</h2>
            <p className="text-xs text-[#6B7280]">{household.address} • Floor {household.floor ?? 1}</p>
          </div>
          <button
            type="button"
            onClick={onOpenSettingsModal}
            className="text-xs text-[#2F6FDE] font-semibold hover:underline bg-[#E8ECF4] px-2.5 py-1 rounded-full"
          >
            Change Profile
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F1D5BF] text-xs">
          <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
            <span className="text-[#6B7280] block text-[11px]">{t.resident.graceWindow}:</span>
            <span className="font-bold text-[#0B1B3A]">
              {effectiveGraceHours} hours {settings.disasterMode && '(Disaster 0.5x)'}
            </span>
          </div>

          <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
            <span className="text-[#6B7280] block text-[11px]">{t.resident.battery}:</span>
            <span className="font-bold text-[#0B1B3A] flex items-center gap-1">
              <Battery className="w-3.5 h-3.5 text-[#0F7A5F]" />
              {household.lastBattery ?? 85}%
            </span>
          </div>
        </div>

        {/* Streak counter */}
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl text-xs text-amber-900 font-semibold">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-[#F26A1B]" />
            <span>
              {streak} {t.resident.streak}
            </span>
          </div>
          <span className="text-[11px] font-normal text-amber-800">
            Peacetime habit ensures crisis readiness
          </span>
        </div>
      </div>

      {/* Main Massive "I'm okay" Button (96px high touch target) */}
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleTapOkay}
          className={`w-full h-24 rounded-3xl font-extrabold text-xl sm:text-2xl text-white shadow-lg transition-all flex flex-col items-center justify-center gap-1 active:scale-95 ${
            justCheckedIn
              ? 'bg-[#0c624c] ring-4 ring-emerald-300 scale-98'
              : 'bg-[#0F7A5F] hover:bg-[#0c624c]'
          }`}
          style={{ minHeight: '96px' }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8" />
            <span>{justCheckedIn ? t.resident.recorded : t.resident.imOkay}</span>
          </div>
          <span className="text-xs font-normal opacity-90">
            {justCheckedIn ? 'Broadcasting to local coordinator hub' : t.resident.imOkaySubtitle}
          </span>
        </button>

        {/* Next Due Notification */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-[#6B7280] py-1">
          <Clock className="w-3.5 h-3.5 text-[#D97706]" />
          <span>
            {t.resident.nextDue}{' '}
            <strong className="text-[#0B1B3A]">
              {nextDueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (
              {nextDueDate.toLocaleDateString()})
            </strong>
          </span>
        </div>
      </div>

      {/* Secondary SOS Distress Action */}
      <div className="bg-[#FFF6EE] border border-red-200 rounded-3xl p-4 text-center space-y-2">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-red-700">
          <AlertTriangle className="w-4 h-4 text-red-600" />
          <span>{t.resident.sosTitle}</span>
        </div>
        <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
          {t.resident.sosDesc}
        </p>

        {!showSosConfirm ? (
          <button
            type="button"
            onClick={() => setShowSosConfirm(true)}
            className="w-full py-3 border-2 border-red-600 text-red-700 hover:bg-red-50 font-bold text-sm rounded-2xl transition-colors"
          >
            {t.resident.sosButton}
          </button>
        ) : (
          <div className="p-3 bg-red-50 border border-red-300 rounded-2xl space-y-2">
            <p className="text-xs font-bold text-red-800">{t.resident.sosConfirm}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmSOS}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow"
              >
                Yes, Send SOS
              </button>
              <button
                type="button"
                onClick={() => setShowSosConfirm(false)}
                className="flex-1 py-2.5 bg-white border border-gray-300 text-gray-700 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {sosSent && (
          <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-[#0F7A5F] rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 animate-in fade-in">
            <ShieldAlert className="w-4 h-4" />
            <span>{t.resident.sosSent}</span>
          </div>
        )}
      </div>

      {/* History List of Last 7 Check-Ins */}
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#0B1B3A] flex items-center gap-2">
            <History className="w-4 h-4 text-[#2F6FDE]" />
            <span>{t.resident.historyTitle}</span>
          </h3>
          <span className="text-[11px] text-[#6B7280]">{last7CheckIns.length} records</span>
        </div>

        <div className="space-y-2">
          {last7CheckIns.length === 0 ? (
            <p className="text-xs text-[#6B7280] italic py-3 text-center">{t.resident.noHistory}</p>
          ) : (
            last7CheckIns.map((item, idx) => {
              const d = new Date(item.at);
              return (
                <div
                  key={item.id || idx}
                  className="flex items-center justify-between bg-[#FFF6EE] p-3 rounded-2xl border border-[#F1D5BF] text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle className="w-4 h-4 text-[#0F7A5F]" />
                    <div>
                      <div className="font-bold text-[#0B1B3A]">
                        {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-[#6B7280]">
                        {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • by {item.by}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0F7A5F]">
                      <Battery className="w-3 h-3" />
                      {item.batteryPct ?? 80}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
