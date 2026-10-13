import { useState } from 'react';
import type { Household, CheckIn, Settings, Report } from '@rahatlink/core';
import { translations, Language } from '../i18n';
import {
  Shield,
  Flame,
  Sliders,
  Users,
  CheckCircle,
  Clock,
  Radio,
  FileText,
} from 'lucide-react';

interface CoordinatorScreenProps {
  households: Household[];
  checkIns: CheckIn[];
  reports: Report[];
  settings: Settings;
  lang: Language;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  onMarkSeenSafe: (householdId: string) => void;
}

export function CoordinatorScreen({
  households,
  checkIns,
  reports,
  settings,
  lang,
  onUpdateSettings,
  onMarkSeenSafe,
}: CoordinatorScreenProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'settings' | 'households' | 'feed'>('settings');

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
                Headless Detection Hub • Offline Yjs Sync • SRIJAN 2K26
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
        <div className="flex gap-2 border-b border-[#F1D5BF] pt-2">
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
            <span>Disaster & Algorithm Settings</span>
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
            <Radio className="w-3.5 h-3.5" />
            <span>Live Incident Feed ({checkIns.length + reports.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Settings */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Disaster Mode Controls */}
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

          {/* Card 2: Risk Scoring Formula Weights */}
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

      {/* Tab 2: Households Directory */}
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
                    <div className="text-[11px] text-[#6B7280]">{h.address} • Floor {h.floor ?? 1}</div>
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
                          : 'bg-amber-100 text-[#D97706]'
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

      {/* Tab 3: Live Feed */}
      {activeTab === 'feed' && (
        <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-[#0B1B3A]">{t.coordinator.recentFeed}</h3>

          <div className="space-y-2">
            {/* Reports */}
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="bg-red-50 border border-red-200 p-3 rounded-2xl text-xs space-y-1"
              >
                <div className="flex items-center justify-between text-red-900 font-bold">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-red-600" />
                    Report #{rep.id} ({rep.source.toUpperCase()})
                  </span>
                  <span className="text-[10px] text-red-700">
                    {new Date(rep.at).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-red-800">{rep.text}</p>
              </div>
            ))}

            {/* Check-ins */}
            {checkIns.slice(-10).reverse().map((ci) => {
              const matchedHousehold = households.find((h) => h.id === ci.householdId);
              return (
                <div
                  key={ci.id}
                  className="bg-[#FFF6EE] border border-[#F1D5BF] p-3 rounded-2xl text-xs flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-[#0F7A5F]" />
                    <div>
                      <div className="font-bold text-[#0B1B3A]">
                        {matchedHousehold?.name || ci.householdId}
                      </div>
                      <div className="text-[10px] text-[#6B7280]">
                        by {ci.by} • {ci.batteryPct ?? 80}% battery
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-[#6B7280] flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ci.at).toLocaleTimeString()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
