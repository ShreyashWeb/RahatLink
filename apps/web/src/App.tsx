import { useEffect, useState } from 'react';
import {
  useSyncStatus,
  useHouseholds,
  useCheckIns,
  useSettings,
  addCheckIn,
  updateSettings,
  seedDemoDataIfEmpty,
} from './store';
import {
  Shield,
  Radio,
  Users,
  CheckCircle,
  Clock,
  Wifi,
  WifiOff,
  Database,
  Flame,
  Battery,
} from 'lucide-react';

export default function App() {
  const syncStatus = useSyncStatus();
  const households = useHouseholds();
  const checkIns = useCheckIns();
  const settings = useSettings();

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>('h-101');
  const [justCheckedIn, setJustCheckedIn] = useState(false);

  useEffect(() => {
    seedDemoDataIfEmpty();
  }, []);

  const activeHousehold =
    households.find((h) => h.id === selectedHouseholdId) || households[0];

  const handleCheckIn = () => {
    if (!activeHousehold) return;

    const newCheckIn = {
      id: `ci-${Date.now()}`,
      householdId: activeHousehold.id,
      at: new Date().toISOString(),
      by: 'self' as const,
      batteryPct: Math.floor(Math.random() * 20) + 75,
    };

    addCheckIn(newCheckIn);
    setJustCheckedIn(true);
    setTimeout(() => setJustCheckedIn(false), 2000);
  };

  const handleDisasterToggle = () => {
    updateSettings({ disasterMode: !settings.disasterMode });
  };

  // Status Chip formatting
  const getStatusChip = () => {
    if (syncStatus.status === 'synced') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-[#0F7A5F] border border-emerald-300">
          <Wifi className="w-3.5 h-3.5 text-[#0F7A5F]" />
          <span>Synced ({syncStatus.peersCount} peer{syncStatus.peersCount === 1 ? '' : 's'})</span>
        </span>
      );
    }
    if (syncStatus.status === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-[#D97706] border border-amber-300 animate-pulse">
          <Clock className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Syncing peers...</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
        <WifiOff className="w-3.5 h-3.5 text-gray-500" />
        <span>Offline (IndexedDB active)</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FFF6EE] text-[#1F2937] flex flex-col font-sans">
      {/* Top Simulated Data Ribbon */}
      <div className="bg-[#0B1B3A] text-white text-xs py-1.5 px-4 text-center font-medium tracking-wide flex items-center justify-center gap-2">
        <span className="bg-[#F26A1B] text-white px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
          Simulated Data
        </span>
        <span>RahatLink Offline-first CRDT • Yjs + y-webrtc + IndexedDB</span>
      </div>

      {/* Human-in-the-loop Governance Banner */}
      <div className="bg-[#FDE8D7] border-b border-[#F1D5BF] py-2 px-4 text-center text-xs sm:text-sm font-semibold text-[#C2500F] flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-[#F26A1B]" />
        <span>RahatLink suggests. A coordinator decides.</span>
      </div>

      {/* Navigation / Header */}
      <header className="bg-white border-b border-[#F1D5BF] py-4 px-6 shadow-sm sticky top-0 z-20">
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

          <div className="flex items-center gap-3">
            {/* Storage indicator */}
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-[#6B7280] bg-[#E8ECF4] px-2.5 py-1 rounded-full">
              <Database className="w-3.5 h-3.5 text-[#2F6FDE]" />
              {syncStatus.idbLoaded ? 'IDB Persisted' : 'Loading IDB...'}
            </span>

            {/* Sync status chip */}
            {getStatusChip()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Hero Tagline Banner */}
        <section className="bg-white border border-[#F1D5BF] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0B1B3A] mb-2">
                Other apps wait for an SOS. <span className="text-[#F26A1B]">RahatLink notices who went silent.</span>
              </h1>
              <p className="text-sm text-[#6B7280] max-w-2xl">
                Open this app in multiple browser windows or devices on the same Wi-Fi. Add a check-in in one window;
                it converges in real-time without cloud servers. Disconnect Wi-Fi and edits persist offline in IndexedDB.
              </p>
            </div>

            {/* Disaster Mode Global Toggle */}
            <div className="flex items-center gap-3 bg-[#FFF6EE] border border-[#F1D5BF] p-3 rounded-xl self-start md:self-auto">
              <div>
                <div className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5 text-[#F26A1B]" />
                  Disaster Mode
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  Grace {settings.disasterMode ? 'halved (0.5x)' : 'normal (1.0x)'}
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisasterToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.disasterMode ? 'bg-[#F26A1B]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.disasterMode ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>

        {/* Action Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card 1: Resident Check-In Action */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#2F6FDE]" />
                Resident Check-In
              </h2>
              {activeHousehold && (
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    activeHousehold.status === 'ok'
                      ? 'bg-emerald-50 text-[#0F7A5F] border border-emerald-200'
                      : 'bg-amber-50 text-[#D97706] border border-amber-200'
                  }`}
                >
                  <CheckCircle className="w-3 h-3" /> {activeHousehold.status.toUpperCase()}
                </span>
              )}
            </div>

            {/* Household Switcher */}
            <div className="space-y-1">
              <label className="text-xs text-[#6B7280] font-medium">Select Household for Demo:</label>
              <select
                value={selectedHouseholdId}
                onChange={(e) => setSelectedHouseholdId(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-[#F1D5BF] bg-[#FFF6EE] text-[#0B1B3A] font-semibold focus:outline-none"
              >
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name} ({h.id})
                  </option>
                ))}
              </select>
            </div>

            {activeHousehold && (
              <div className="bg-[#FFF6EE] border border-[#F1D5BF] p-3 rounded-xl space-y-1 text-xs">
                <div className="font-semibold text-[#0B1B3A]">{activeHousehold.address}</div>
                <div className="text-[#6B7280]">
                  Grace Window:{' '}
                  <span className="font-bold text-[#0B1B3A]">
                    {settings.disasterMode
                      ? activeHousehold.graceHours * settings.disasterGraceFactor
                      : activeHousehold.graceHours}
                    h
                  </span>
                </div>
                <div className="text-[#6B7280] flex items-center gap-1">
                  <Battery className="w-3.5 h-3.5 text-[#0F7A5F]" />
                  Battery: {activeHousehold.lastBattery ?? 80}%
                </div>
                <div className="text-[#6B7280]">
                  Last Check-In:{' '}
                  <span className="text-[#0B1B3A]">
                    {activeHousehold.lastCheckInAt
                      ? new Date(activeHousehold.lastCheckInAt).toLocaleTimeString()
                      : 'Never'}
                  </span>
                </div>
              </div>
            )}

            {/* Big "I'm Okay" button */}
            <button
              type="button"
              onClick={handleCheckIn}
              className={`w-full h-16 text-white text-base font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2 ${
                justCheckedIn
                  ? 'bg-[#0c624c] scale-98 ring-4 ring-emerald-300'
                  : 'bg-[#0F7A5F] hover:bg-[#0c624c]'
              }`}
            >
              <CheckCircle className="w-5 h-5" />
              {justCheckedIn ? "Check-In Recorded!" : "I'm Okay (Tap to Check In)"}
            </button>
            <p className="text-[11px] text-[#6B7280] text-center">
              Tapping broadcasts CRDT check-in via WebRTC and writes to IndexedDB.
            </p>
          </div>

          {/* Card 2: Live Households Peer Directory */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-5 shadow-sm space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <Users className="w-4 h-4 text-[#F26A1B]" />
                Synced Households ({households.length})
              </h2>
              <span className="text-xs text-[#6B7280]">Real-time Y.Map CRDT</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#E8ECF4] text-[#0B1B3A] font-semibold">
                  <tr>
                    <th className="py-2 px-3 rounded-l-lg">Household</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Grace</th>
                    <th className="py-2 px-3">Health Consent</th>
                    <th className="py-2 px-3 rounded-r-lg">Last Check-In</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {households.map((h) => (
                    <tr key={h.id} className="hover:bg-[#FFF6EE]">
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#0B1B3A]">{h.name}</div>
                        <div className="text-[11px] text-[#6B7280]">{h.address}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            h.status === 'ok'
                              ? 'bg-emerald-100 text-[#0F7A5F]'
                              : 'bg-amber-100 text-[#D97706]'
                          }`}
                        >
                          {h.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#1F2937] font-medium">
                        {settings.disasterMode ? h.graceHours * settings.disasterGraceFactor : h.graceHours}h
                      </td>
                      <td className="py-2.5 px-3">
                        {h.consent.health ? (
                          <span className="text-[#0F7A5F] font-semibold">Consented (Gated)</span>
                        ) : (
                          <span className="text-gray-400">None</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-[#6B7280]">
                        {h.lastCheckInAt
                          ? new Date(h.lastCheckInAt).toLocaleTimeString()
                          : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Card 3: Recent Check-in Activity Stream */}
            <div className="pt-2 border-t border-[#F1D5BF]">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2F6FDE]" />
                  Converged Check-In Log (Y.Array: {checkIns.length} events)
                </h3>
                <span className="text-[10px] text-[#6B7280]">Last 5 events</span>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {checkIns.length === 0 ? (
                  <div className="text-xs text-[#6B7280] italic py-2">
                    No check-ins yet. Tap "I'm Okay" above to trigger one.
                  </div>
                ) : (
                  checkIns
                    .slice(-5)
                    .reverse()
                    .map((ci) => (
                      <div
                        key={ci.id}
                        className="flex items-center justify-between bg-[#FFF6EE] p-2 rounded-lg text-xs border border-[#F1D5BF]"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-[#0F7A5F]" />
                          <span className="font-semibold text-[#0B1B3A]">
                            {households.find((h) => h.id === ci.householdId)?.name || ci.householdId}
                          </span>
                          <span className="text-[10px] bg-white px-1.5 py-0.5 rounded border border-gray-200 text-gray-600">
                            by {ci.by}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#6B7280]">
                          {new Date(ci.at).toLocaleTimeString()} • {ci.batteryPct ?? 80}% battery
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-[#F1D5BF] py-4 px-6 text-center text-xs text-[#6B7280]">
        RahatLink • Task 2: Offline-first data layer (Yjs Y.Doc + y-indexeddb + y-webrtc + Node Hub ws://localhost:4444)
      </footer>
    </div>
  );
}
