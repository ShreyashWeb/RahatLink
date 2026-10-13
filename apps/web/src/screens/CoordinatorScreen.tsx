import { useState, useEffect } from 'react';
import type { Household, CheckIn, Settings, Report, AppNotification } from '@rahatlink/core';
import { evaluateHousehold } from '@rahatlink/core';
import { translations, Language } from '../i18n';
import {
  Shield,
  Flame,
  Sliders,
  Users,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Bell,
  AlertOctagon,
} from 'lucide-react';

interface CoordinatorScreenProps {
  households: Household[];
  checkIns: CheckIn[];
  reports: Report[];
  notifications: AppNotification[];
  settings: Settings;
  lang: Language;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  onMarkSeenSafe: (householdId: string) => void;
  onRunEvaluation: (simulatedNow?: Date) => void;
  onUpsertHousehold: (household: Household) => void;
}

export function CoordinatorScreen({
  households,
  checkIns: _checkIns,
  reports: _reports,
  notifications,
  settings,
  lang,
  onUpdateSettings,
  onMarkSeenSafe,
  onRunEvaluation,
  onUpsertHousehold,
}: CoordinatorScreenProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'settings' | 'ladder' | 'households' | 'feed'>('ladder');

  // Fast-Forward Clock State (60x multiplier)
  const [isFastForwardActive, setIsFastForwardActive] = useState(false);
  const [simulatedMinutesElapsed, setSimulatedMinutesElapsed] = useState(0);
  const [selectedWalkHouseholdId, setSelectedWalkHouseholdId] = useState<string>('h-101');

  // 60x fast-forward timer: every 1s real time = 60 minutes simulated time
  useEffect(() => {
    let interval: any = null;
    if (isFastForwardActive) {
      interval = setInterval(() => {
        setSimulatedMinutesElapsed((prev) => {
          const next = prev + 60; // advance 1 hour per second at 60x
          const virtualDate = new Date(Date.now() + next * 60000);
          onRunEvaluation(virtualDate);
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isFastForwardActive, onRunEvaluation]);

  const targetHousehold =
    households.find((h) => h.id === selectedWalkHouseholdId) || households[0];

  // Virtual evaluation for target household
  const virtualNow = new Date(Date.now() + simulatedMinutesElapsed * 60000);
  const targetEvaluation = targetHousehold
    ? evaluateHousehold(targetHousehold, virtualNow, settings)
    : null;

  // Local weights state synced from props
  const weights = settings.weights;

  const handleWeightChange = (key: string, value: number) => {
    onUpdateSettings({
      weights: {
        ...weights,
        [key]: value,
      },
    });
  };

  const okCount = households.filter((h) => h.status === 'ok').length;
  const flaggedCount = households.filter((h) => h.status === 'flagged').length;
  const warningCount = households.length - okCount - flaggedCount;

  // Manual jump helper for testing
  const handleJumpToHours = (hours: number) => {
    if (!targetHousehold) return;
    const simulatedLastCheckIn = new Date(Date.now() - hours * 3600000).toISOString();
    onUpsertHousehold({
      ...targetHousehold,
      lastCheckInAt: simulatedLastCheckIn,
    });
    setSimulatedMinutesElapsed(0);
    setTimeout(() => onRunEvaluation(new Date()), 100);
  };

  const handleResetClock = () => {
    setIsFastForwardActive(false);
    setSimulatedMinutesElapsed(0);
    if (targetHousehold) {
      onUpsertHousehold({
        ...targetHousehold,
        lastCheckInAt: new Date().toISOString(),
        status: 'ok',
      });
    }
    onRunEvaluation(new Date());
  };

  const stages = [
    { key: 'ok', label: 'OK (0-24h)', color: 'bg-emerald-500' },
    { key: 'due', label: 'DUE (+0.25 grace)', color: 'bg-yellow-500' },
    { key: 'grace', label: 'GRACE (+1.0 grace)', color: 'bg-amber-500' },
    { key: 'reminded', label: 'REMINDED (+1.25 grace)', color: 'bg-orange-500' },
    { key: 'pinged', label: 'PINGED (+1.5 grace)', color: 'bg-rose-500' },
    { key: 'flagged', label: 'FLAGGED (Clustered)', color: 'bg-red-600' },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Coordinator Summary */}
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0B1B3A] flex items-center justify-center text-white">
              <Shield className="w-5 h-5 text-[#F26A1B]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#0B1B3A]">{t.coordinator.title}</h2>
              <p className="text-xs text-[#6B7280]">
                Silence Engine Hub • Offline Yjs Sync • SRIJAN 2K26
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2">
            <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
              <div className="text-xs text-[#0F7A5F] font-bold">{okCount} OK</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl text-center">
              <div className="text-xs text-amber-700 font-bold">{warningCount} Due/Grace</div>
            </div>
            <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-center">
              <div className="text-xs text-red-700 font-bold">{flaggedCount} Flagged</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-[#F1D5BF] pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('ladder')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'ladder'
                ? 'border-[#F26A1B] text-[#F26A1B]'
                : 'border-transparent text-[#6B7280] hover:text-[#0B1B3A]'
            }`}
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Fast-Forward Clock (60x)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'settings'
                ? 'border-[#0B1B3A] text-[#0B1B3A]'
                : 'border-transparent text-[#6B7280] hover:text-[#0B1B3A]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Disaster & Weights</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('households')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'households'
                ? 'border-[#0B1B3A] text-[#0B1B3A]'
                : 'border-transparent text-[#6B7280] hover:text-[#0B1B3A]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Households ({households.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('feed')}
            className={`pb-2.5 px-3 text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 ${
              activeTab === 'feed'
                ? 'border-[#0B1B3A] text-[#0B1B3A]'
                : 'border-transparent text-[#6B7280] hover:text-[#0B1B3A]'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Alerts & Notifications ({notifications.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Fast-Forward Clock & Ladder Stepper */}
      {activeTab === 'ladder' && (
        <div className="space-y-6">
          {/* Dev Control Card */}
          <div className="bg-white border-2 border-[#F26A1B] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-[#FDE8D7] px-2.5 py-0.5 rounded-full text-xs font-bold text-[#F26A1B] mb-1">
                  <FastForward className="w-3 h-3" /> Dev Control • 60x Fast-Forward
                </div>
                <h3 className="text-base font-bold text-[#0B1B3A]">
                  Watch Silence Escalation Walk in 1 Minute
                </h3>
                <p className="text-xs text-[#6B7280]">
                  At 60x speed, 1 hour passes every second. Watch households walk: ok ➔ due ➔ grace ➔ reminded ➔ pinged ➔ flagged.
                </p>
              </div>

              {/* Play / Pause 60x Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsFastForwardActive(!isFastForwardActive)}
                  className={`px-4 py-2.5 rounded-2xl font-bold text-xs shadow transition-all flex items-center gap-2 ${
                    isFastForwardActive
                      ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse'
                      : 'bg-[#0F7A5F] hover:bg-[#0c624c] text-white'
                  }`}
                >
                  {isFastForwardActive ? (
                    <>
                      <Pause className="w-4 h-4" /> Pause Clock (60x)
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Start 60x Clock
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetClock}
                  className="p-2.5 bg-[#FFF6EE] border border-[#F1D5BF] hover:bg-gray-100 rounded-2xl text-xs font-bold text-[#0B1B3A] transition-colors"
                  title="Reset clock and selected household to OK"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Virtual Clock Display */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-[#F1D5BF] text-xs">
              <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
                <span className="text-[#6B7280] block text-[10px]">Elapsed Time:</span>
                <span className="font-extrabold text-[#0B1B3A]">
                  +{(simulatedMinutesElapsed / 60).toFixed(1)} hours
                </span>
              </div>
              <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
                <span className="text-[#6B7280] block text-[10px]">Virtual Timestamp:</span>
                <span className="font-bold text-[#0B1B3A]">
                  {virtualNow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
                <span className="text-[#6B7280] block text-[10px]">Clock Status:</span>
                <span className={`font-bold ${isFastForwardActive ? 'text-[#F26A1B]' : 'text-gray-500'}`}>
                  {isFastForwardActive ? '⚡ 60x Running' : 'Paused (1x)'}
                </span>
              </div>
              <div className="bg-[#FFF6EE] p-2.5 rounded-xl border border-[#F1D5BF]">
                <span className="text-[#6B7280] block text-[10px]">Disaster Mode:</span>
                <span className="font-bold text-[#0B1B3A]">
                  {settings.disasterMode ? '0.5x Grace' : '1.0x Normal'}
                </span>
              </div>
            </div>
          </div>

          {/* Household Ladder Visual Walkthrough */}
          {targetHousehold && (
            <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-[#0B1B3A] flex items-center gap-2">
                    <span>Selected Household:</span>
                    <select
                      value={selectedWalkHouseholdId}
                      onChange={(e) => setSelectedWalkHouseholdId(e.target.value)}
                      className="text-xs p-1.5 border border-[#F1D5BF] rounded-lg bg-[#FFF6EE] text-[#0B1B3A] font-bold focus:outline-none"
                    >
                      {households.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.id})
                        </option>
                      ))}
                    </select>
                  </h4>
                  <p className="text-xs text-[#6B7280] mt-0.5">
                    Grace: {targetHousehold.graceHours}h • Last check-in:{' '}
                    {targetHousehold.lastCheckInAt
                      ? new Date(targetHousehold.lastCheckInAt).toLocaleTimeString()
                      : 'Never'} • {targetEvaluation?.stageName}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      targetHousehold.status === 'ok'
                        ? 'bg-emerald-100 text-[#0F7A5F]'
                        : targetHousehold.status === 'due'
                        ? 'bg-yellow-100 text-yellow-800'
                        : targetHousehold.status === 'grace'
                        ? 'bg-amber-100 text-amber-800'
                        : targetHousehold.status === 'reminded'
                        ? 'bg-orange-100 text-[#F26A1B]'
                        : targetHousehold.status === 'pinged'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-red-600 text-white animate-pulse'
                    }`}
                  >
                    Current: {targetHousehold.status}
                  </span>

                  <button
                    type="button"
                    onClick={() => onMarkSeenSafe(targetHousehold.id)}
                    className="px-2.5 py-1 bg-[#0F7A5F] hover:bg-[#0c624c] text-white text-xs font-bold rounded-lg shadow"
                  >
                    Mark Seen Safe
                  </button>
                </div>
              </div>

              {/* Ladder Visual Progression Bar */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">
                  Escalation Ladder Stepper
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                  {stages.map((st) => {
                    const isCurrent = targetHousehold.status === st.key;
                    return (
                      <div
                        key={st.key}
                        className={`p-2.5 rounded-2xl border text-center transition-all ${
                          isCurrent
                            ? 'border-2 border-[#0B1B3A] bg-[#0B1B3A] text-white shadow-md scale-102'
                            : 'border-[#F1D5BF] bg-[#FFF6EE] text-[#1F2937] opacity-60'
                        }`}
                      >
                        <div
                          className={`w-3 h-3 rounded-full mx-auto mb-1.5 ${st.color} ${
                            isCurrent ? 'ring-2 ring-white ring-offset-2' : ''
                          }`}
                        />
                        <div className="text-[11px] font-black uppercase">{st.key}</div>
                        <div className="text-[9px] opacity-80">{st.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Manual Stage Jump Buttons for instant testing */}
              <div className="p-3 bg-[#FFF6EE] rounded-2xl border border-[#F1D5BF] space-y-2">
                <span className="text-[11px] font-bold text-[#0B1B3A] block">
                  Instant Stage Testing Shortcuts:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(0)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-emerald-50 text-[11px] font-semibold rounded-lg text-[#0F7A5F]"
                  >
                    Jump 0h (OK)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(25)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-yellow-50 text-[11px] font-semibold rounded-lg text-yellow-800"
                  >
                    Jump 25h (DUE)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(32)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-amber-50 text-[11px] font-semibold rounded-lg text-amber-800"
                  >
                    Jump 32h (GRACE)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(50)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-orange-50 text-[11px] font-semibold rounded-lg text-[#F26A1B]"
                  >
                    Jump 50h (REMINDED)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(56)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-rose-50 text-[11px] font-semibold rounded-lg text-rose-800"
                  >
                    Jump 56h (PINGED)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleJumpToHours(62)}
                    className="px-2.5 py-1 bg-white border border-[#F1D5BF] hover:bg-red-50 text-[11px] font-semibold rounded-lg text-red-700"
                  >
                    Jump 62h (FLAGGED)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Settings (Disaster Mode & Weights) */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#0B1B3A]">
                <Flame className="w-5 h-5 text-[#F26A1B]" />
                <h3 className="text-base font-bold">{t.coordinator.disasterMode}</h3>
              </div>
              <button
                type="button"
                onClick={() => onUpdateSettings({ disasterMode: !settings.disasterMode })}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                  settings.disasterMode ? 'bg-[#F26A1B]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    settings.disasterMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <p className="text-xs text-[#6B7280]">{t.coordinator.disasterModeDesc}</p>

            <div className="p-3 bg-[#FFF6EE] rounded-2xl border border-[#F1D5BF] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0B1B3A]">{t.coordinator.graceFactor}</span>
                <span className="font-bold text-[#F26A1B]">{settings.disasterGraceFactor}x</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="1.0"
                step="0.05"
                value={settings.disasterGraceFactor}
                onChange={(e) =>
                  onUpdateSettings({ disasterGraceFactor: parseFloat(e.target.value) })
                }
                className="w-full accent-[#F26A1B]"
              />
              <div className="flex justify-between text-[10px] text-[#6B7280]">
                <span>0.25x (Quarter window)</span>
                <span>0.5x (Halved - default)</span>
                <span>1.0x (Normal)</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#0B1B3A]">
              <Sliders className="w-5 h-5 text-[#2F6FDE]" />
              <h3 className="text-base font-bold">{t.coordinator.riskWeights}</h3>
            </div>
            <p className="text-xs text-[#6B7280]">
              Transparent formula weights (sum = 100). Tunable in real-time.
            </p>

            <div className="space-y-3 text-xs">
              {[
                { key: 'silenceBeyondGrace', label: 'Silence beyond grace', val: weights.silenceBeyondGrace ?? 25 },
                { key: 'clusterSize', label: 'Cluster size (DBSCAN)', val: weights.clusterSize ?? 20 },
                { key: 'medicalVulnerability', label: 'Medical vulnerability', val: weights.medicalVulnerability ?? 25 },
                { key: 'floodZoneDistance', label: 'Proximity to flood zone', val: weights.floodZoneDistance ?? 15 },
                { key: 'battery', label: 'Low battery level', val: weights.battery ?? 5 },
                { key: 'corroboratingReports', label: 'Corroborating reports', val: weights.corroboratingReports ?? 10 },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#0B1B3A] font-semibold">{item.label}</span>
                    <span className="font-bold text-[#2F6FDE]">+{item.val}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={item.val}
                    onChange={(e) => handleWeightChange(item.key, parseInt(e.target.value, 10))}
                    className="w-full accent-[#2F6FDE]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Households Directory */}
      {activeTab === 'households' && (
        <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1B3A]">{t.coordinator.householdsList}</h3>
            <span className="text-xs text-[#6B7280]">Total: {households.length}</span>
          </div>

          <div className="divide-y divide-gray-100">
            {households.map((h) => {
              const lastTime = h.lastCheckInAt
                ? new Date(h.lastCheckInAt).toLocaleTimeString()
                : 'Never';

              return (
                <div key={h.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-bold text-[#0B1B3A]">{h.name}</div>
                    <div className="text-[11px] text-[#6B7280]">
                      {h.address} • Floor {h.floor ?? 1} •{' '}
                      {h.hasSmartphone ? 'Smartphone' : 'No Phone (Proxy)'}
                    </div>
                    <div className="text-[10px] text-[#6B7280]">
                      Last check-in: {lastTime} • Grace:{' '}
                      {settings.disasterMode ? h.graceHours * settings.disasterGraceFactor : h.graceHours}h
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                        h.status === 'ok'
                          ? 'bg-emerald-100 text-[#0F7A5F]'
                          : h.status === 'due'
                          ? 'bg-yellow-100 text-yellow-800'
                          : h.status === 'grace'
                          ? 'bg-amber-100 text-amber-800'
                          : h.status === 'reminded'
                          ? 'bg-orange-100 text-[#F26A1B]'
                          : h.status === 'pinged'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-red-600 text-white'
                      }`}
                    >
                      {h.status}
                    </span>

                    {h.status !== 'ok' && (
                      <button
                        type="button"
                        onClick={() => onMarkSeenSafe(h.id)}
                        className="px-2.5 py-1 bg-[#0F7A5F] hover:bg-[#0c624c] text-white font-bold text-[10px] rounded-lg shadow"
                      >
                        Seen Safe
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 4: Live Notifications & Incident Feed */}
      {activeTab === 'feed' && (
        <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0B1B3A] flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#F26A1B]" />
              <span>Simulated Notifications Feed ({notifications.length})</span>
            </h3>
            <span className="text-xs text-[#6B7280]">Automated Ladder Transitions</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="text-xs text-[#6B7280] italic py-6 text-center">
                No ladder notifications generated yet. Use the 60x Fast-Forward clock to trigger transitions.
              </div>
            ) : (
              notifications
                .slice()
                .reverse()
                .map((notif) => {
                  return (
                    <div
                      key={notif.id}
                      className={`p-3 rounded-2xl border text-xs space-y-1 ${
                        notif.type === 'reminded'
                          ? 'bg-orange-50 border-orange-200 text-orange-950'
                          : notif.type === 'pinged'
                          ? 'bg-rose-50 border-rose-200 text-rose-950'
                          : 'bg-red-50 border-red-200 text-red-950'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span className="flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                          {notif.type === 'reminded' ? (
                            <Clock className="w-3.5 h-3.5 text-[#F26A1B]" />
                          ) : notif.type === 'pinged' ? (
                            <Users className="w-3.5 h-3.5 text-rose-600" />
                          ) : (
                            <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
                          )}
                          {notif.type} • {notif.householdName}
                        </span>
                        <span className="text-[10px] opacity-75">
                          {new Date(notif.at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed">{notif.message}</p>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
