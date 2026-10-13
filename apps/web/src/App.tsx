import { useEffect, useState } from 'react';
import type { Household, CheckIn, Report } from '@rahatlink/core';
import {
  useSyncStatus,
  useHouseholds,
  useCheckIns,
  useReports,
  useNotifications,
  useSettings,
  addCheckIn,
  addReport,
  upsertHousehold,
  updateSettings,
  runSilenceEvaluation,
  seedDemoDataIfEmpty,
} from './store';
import { translations, Language } from './i18n';
import { UserRole, OnboardingModal } from './components/OnboardingModal';
import { ResidentScreen } from './screens/ResidentScreen';
import { NeighbourScreen } from './screens/NeighbourScreen';
import { CoordinatorScreen } from './screens/CoordinatorScreen';
import {
  Shield,
  Radio,
  Wifi,
  WifiOff,
  Database,
  Globe,
  UserCheck,
} from 'lucide-react';

export default function App() {
  const syncStatus = useSyncStatus();
  const households = useHouseholds();
  const checkIns = useCheckIns();
  const reports = useReports();
  const notifications = useNotifications();
  const settings = useSettings();

  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('rahatlink_role') as UserRole) || 'resident';
  });

  const [activeHouseholdId, setActiveHouseholdId] = useState<string>(() => {
    return localStorage.getItem('rahatlink_active_household') || 'h-101';
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  useEffect(() => {
    seedDemoDataIfEmpty();
  }, []);

  const handleSelectRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem('rahatlink_role', newRole);
  };

  const handleSelectHousehold = (id: string) => {
    setActiveHouseholdId(id);
    localStorage.setItem('rahatlink_active_household', id);
  };

  const handleRegisterHousehold = (newH: Household) => {
    upsertHousehold(newH);
  };

  const activeHousehold =
    households.find((h) => h.id === activeHouseholdId) || households[0];

  // Actions
  const handleCheckIn = (ci: CheckIn) => {
    addCheckIn(ci);
  };

  const handleSendReport = (rep: Report) => {
    addReport(rep);
  };

  const handleNudgeEscalation = (householdId: string, note: string) => {
    const target = households.find((h) => h.id === householdId);
    if (target) {
      upsertHousehold({
        ...target,
        status: 'pinged',
      });
    }
    addReport({
      id: `rep-nudge-${Date.now()}`,
      at: new Date().toISOString(),
      lat: target?.lat,
      lng: target?.lng,
      text: note,
      source: 'app',
      parsed: {
        type: 'neighbour-nudge',
        urgency: 'MEDIUM',
        matchedHouseholdId: householdId,
      },
    });
  };

  const handleMarkSeenSafe = (householdId: string) => {
    const target = households.find((h) => h.id === householdId);
    if (target) {
      upsertHousehold({
        ...target,
        status: 'seenSafe',
        lastCheckInAt: new Date().toISOString(),
      });
    }
  };

  // Status Chip
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
          <Wifi className="w-3.5 h-3.5 text-[#D97706]" />
          <span>Syncing peers...</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300">
        <WifiOff className="w-3.5 h-3.5 text-gray-500" />
        <span>Offline (IndexedDB)</span>
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
        <span>{t.simulatedRibbon}</span>
      </div>

      {/* Human-in-the-loop Governance Banner */}
      <div className="bg-[#FDE8D7] border-b border-[#F1D5BF] py-2 px-4 text-center text-xs sm:text-sm font-semibold text-[#C2500F] flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-[#F26A1B]" />
        <span>{t.suggestsDecides}</span>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-[#F1D5BF] py-3.5 px-4 sm:px-6 shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#0B1B3A] flex items-center justify-center text-white shadow">
              <Radio className="w-5 h-5 sm:w-6 sm:h-6 text-[#F26A1B]" />
            </div>
            <div>
              <div className="text-lg sm:text-xl font-bold tracking-tight text-[#0B1B3A]">
                Rahat<span className="text-[#F26A1B]">Link</span>
              </div>
              <div className="text-[10px] sm:text-xs text-[#6B7280]">
                Team <span className="text-[#0B1B3A] font-semibold">Code</span>
                <span className="text-[#F26A1B] font-semibold">Forge</span> | SRIJAN 2K26
              </div>
            </div>
          </div>

          {/* Right Controls: Role Badge + Language Toggle + Sync Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Role Button */}
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF6EE] border border-[#F1D5BF] text-[#0B1B3A] hover:bg-[#FDE8D7] transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#F26A1B]" />
              <span className="hidden sm:inline">{t.switchRole}:</span>
              <span className="text-[#F26A1B]">{t.roles[role]}</span>
            </button>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#E8ECF4] text-[#0B1B3A] hover:bg-gray-200 transition-colors"
              title="Toggle English / हिंदी"
            >
              <Globe className="w-3.5 h-3.5 text-[#2F6FDE]" />
              <span>{t.langToggle}</span>
            </button>

            {/* Storage indicator */}
            <span className="hidden md:inline-flex items-center gap-1 text-xs text-[#6B7280] bg-[#E8ECF4] px-2.5 py-1 rounded-full">
              <Database className="w-3.5 h-3.5 text-[#2F6FDE]" />
              {syncStatus.idbLoaded ? 'IDB' : '...'}
            </span>

            {/* Sync status chip */}
            {getStatusChip()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6">
        {/* Render Active Screen based on Selected Role */}
        {role === 'resident' && activeHousehold && (
          <ResidentScreen
            household={activeHousehold}
            checkIns={checkIns}
            settings={settings}
            lang={lang}
            onCheckIn={handleCheckIn}
            onSendSOS={handleSendReport}
            onOpenSettingsModal={() => setIsOnboardingOpen(true)}
          />
        )}

        {role === 'neighbour' && activeHousehold && (
          <NeighbourScreen
            currentHousehold={activeHousehold}
            households={households}
            lang={lang}
            onProxyCheckIn={handleCheckIn}
            onNudgeEscalation={handleNudgeEscalation}
            onSendReport={handleSendReport}
          />
        )}

        {(role === 'coordinator' || role === 'volunteer') && (
          <CoordinatorScreen
            households={households}
            checkIns={checkIns}
            reports={reports}
            notifications={notifications}
            settings={settings}
            lang={lang}
            onUpdateSettings={(partial) => updateSettings(partial)}
            onMarkSeenSafe={handleMarkSeenSafe}
            onRunEvaluation={(simulatedNow) => runSilenceEvaluation(simulatedNow)}
            onUpsertHousehold={upsertHousehold}
          />
        )}
      </main>

      {/* Onboarding & Role Switcher Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        lang={lang}
        currentRole={role}
        onSelectRole={handleSelectRole}
        households={households}
        activeHouseholdId={activeHouseholdId}
        onSelectHousehold={handleSelectHousehold}
        onRegisterHousehold={handleRegisterHousehold}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[#F1D5BF] py-4 px-6 text-center text-xs text-[#6B7280]">
        RahatLink • {t.tagline} • Team CodeForge
      </footer>
    </div>
  );
}
