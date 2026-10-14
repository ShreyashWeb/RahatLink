import { useEffect, useState } from 'react';
import type { Household, CheckIn, Report } from '@rahatlink/core';
import {
  useSyncStatus,
  useHouseholds,
  useCheckIns,
  useReports,
  useNotifications,
  useSettings,
  useTasks,
  useVolunteers,
  useFloodZones,
  useAccessLog,
  useHealthProfiles,
  addCheckIn,
  addReport,
  upsertHousehold,
  upsertVolunteer,
  updateTask,
  updateSettings,
  saveHealthProfile,
  deleteHealthProfile,
  downloadResidentData,
  logAccess,
  runSilenceEvaluation,
  seedDemoDataIfEmpty,
  updateReport,
  sendSmsGatewayReport,
  mergeQrSnapshot,
} from './store';
import { translations, Language } from './i18n';
import { UserRole, OnboardingModal } from './components/OnboardingModal';
import { RoadmapModal } from './components/RoadmapModal';
import { PwaInstallBanner } from './components/PwaInstallBanner';
import { ResidentScreen } from './screens/ResidentScreen';
import { NeighbourScreen } from './screens/NeighbourScreen';
import { CoordinatorScreen } from './screens/CoordinatorScreen';
import { VolunteerScreen } from './screens/VolunteerScreen';
import {
  Shield,
  Radio,
  Wifi,
  WifiOff,
  Database,
  Globe,
  UserCheck,
  Bluetooth,
  Home,
  Users,
  HeartHandshake,
} from 'lucide-react';

export default function App() {
  const syncStatus = useSyncStatus();
  const households = useHouseholds();
  const checkIns = useCheckIns();
  const reports = useReports();
  const notifications = useNotifications();
  const settings = useSettings();

  const tasks = useTasks();
  const volunteers = useVolunteers();
  const floodZones = useFloodZones();
  const accessLogs = useAccessLog();
  const healthProfiles = useHealthProfiles();

  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];

  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem('rahatlink_role') as UserRole) || 'resident';
  });

  const [activeHouseholdId, setActiveHouseholdId] = useState<string>(() => {
    return localStorage.getItem('rahatlink_active_household') || 'h-101';
  });

  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);
  const [isRoadmapOpen, setIsRoadmapOpen] = useState(false);

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
  const formatLastSynced = (date: Date | null) => {
    if (!date) return '';
    const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diffSec < 10) return ' • just now';
    if (diffSec < 60) return ` • ${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    return ` • ${diffMin}m ago`;
  };

  const getStatusChip = () => {
    if (syncStatus.status === 'synced') {
      return (
        <span
          role="status"
          aria-label={`Synced with ${syncStatus.peersCount} peer${syncStatus.peersCount === 1 ? '' : 's'}`}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-emerald-100 text-[#0F7A5F] border border-emerald-300 shrink-0 whitespace-nowrap shadow-xs"
          title={`Synced with ${syncStatus.peersCount} peer${syncStatus.peersCount === 1 ? '' : 's'}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#0F7A5F] animate-pulse shrink-0"></span>
          <Wifi className="w-3.5 h-3.5 text-[#0F7A5F] shrink-0" />
          <span>
            {syncStatus.peersCount} {syncStatus.peersCount === 1 ? 'peer' : 'peers'}
          </span>
          <span className="hidden lg:inline font-normal text-emerald-800">
            {formatLastSynced(syncStatus.lastSyncedAt)}
          </span>
        </span>
      );
    }
    if (syncStatus.status === 'syncing') {
      return (
        <span
          role="status"
          aria-label="Syncing with peers"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-amber-100 text-[#D97706] border border-amber-300 animate-pulse shrink-0 whitespace-nowrap shadow-xs"
          title="Syncing mesh peers..."
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] shrink-0"></span>
          <Wifi className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
          <span>Syncing</span>
        </span>
      );
    }
    return (
      <span
        role="status"
        aria-label="Offline, using local IndexedDB"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold bg-gray-100 text-gray-700 border border-gray-300 shrink-0 whitespace-nowrap shadow-xs"
        title="Offline (Local DB)"
      >
        <WifiOff className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span>Local DB</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#FFF6EE] text-[#1F2937] flex flex-col font-sans overflow-x-hidden">
      {/* PWA Offline / Install Banner */}
      <PwaInstallBanner />

      {/* Top Simulated Data Ribbon */}
      <div className="bg-[#0B1B3A] text-white text-[11px] sm:text-xs py-1.5 px-3 text-center font-medium tracking-wide flex items-center justify-center gap-1.5 sm:gap-2">
        <span className="bg-[#F26A1B] text-white px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0">
          Simulated Data
        </span>
        <span className="truncate max-w-[260px] sm:max-w-none">{t.simulatedRibbon}</span>
      </div>

      {/* Human-in-the-loop Governance Banner */}
      <div className="bg-[#FDE8D7] border-b border-[#F1D5BF] py-1.5 sm:py-2 px-3 sm:px-4 text-center text-[11px] sm:text-sm font-semibold text-[#C2500F] flex items-center justify-center gap-1.5 sm:gap-2">
        <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#F26A1B] shrink-0" />
        <span className="truncate max-w-[320px] sm:max-w-none">{t.suggestsDecides}</span>
      </div>

      {/* Main Header */}
      <header className="bg-white border-b border-[#F1D5BF] py-2 sm:py-3 px-3 sm:px-6 shadow-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#0B1B3A] flex items-center justify-center text-white shadow shrink-0">
              <Radio className="w-4 h-4 sm:w-6 sm:h-6 text-[#F26A1B]" />
            </div>
            <div>
              <div className="text-base sm:text-xl font-black tracking-tight text-[#0B1B3A] leading-tight">
                Rahat<span className="text-[#F26A1B]">Link</span>
              </div>
              <div className="hidden md:block text-[10px] sm:text-xs text-[#6B7280] leading-none mt-0.5">
                Proactive Neighbourhood Safety
              </div>
            </div>
          </div>

          {/* Right Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Roadmap button (hidden on mobile; available inside screens and desktop) */}
            <button
              type="button"
              onClick={() => setIsRoadmapOpen(true)}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#E8ECF4] border border-[#CCD6E8] text-[#0B1B3A] hover:bg-[#D4E0F5] transition-colors"
              title="Architecture & Future Roadmap (Bluetooth Mesh)"
              aria-label="View Architecture and Roadmap"
            >
              <Bluetooth className="w-3.5 h-3.5 text-[#2F6FDE]" />
              <span>Roadmap</span>
            </button>

            {/* Desktop Role Button (On mobile, the bottom nav bar provides instantaneous role switching) */}
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF6EE] border border-[#F1D5BF] text-[#0B1B3A] hover:bg-[#FDE8D7] transition-colors"
              title="Change active user role / household"
              aria-label="Change active user role"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#F26A1B] shrink-0" />
              <span>{t.switchRole}:</span>
              <span className="text-[#F26A1B] font-extrabold">{t.roles[role]}</span>
            </button>

            {/* Mobile Household / Onboarding trigger icon */}
            <button
              type="button"
              onClick={() => setIsOnboardingOpen(true)}
              className="sm:hidden inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#FFF6EE] border border-[#F1D5BF] text-[#F26A1B] hover:bg-[#FDE8D7] transition-colors shrink-0"
              title="Household & Role Settings"
              aria-label="Household Settings"
            >
              <UserCheck className="w-4 h-4 text-[#F26A1B]" />
            </button>

            {/* Language Switcher */}
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'hi' : 'en')}
              className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#E8ECF4] text-[#0B1B3A] hover:bg-gray-200 transition-colors shrink-0"
              title="Toggle English / हिंदी"
              aria-label="Toggle language"
            >
              <Globe className="w-3.5 h-3.5 text-[#2F6FDE] shrink-0" />
              <span className="text-[11px] sm:text-xs font-extrabold">{lang === 'en' ? 'हिं' : 'EN'}</span>
            </button>

            {/* Storage indicator (Desktop only) */}
            <span className="hidden lg:inline-flex items-center gap-1 text-xs text-[#6B7280] bg-[#E8ECF4] px-2.5 py-1 rounded-full shrink-0">
              <Database className="w-3.5 h-3.5 text-[#2F6FDE]" />
              {syncStatus.idbLoaded ? 'IDB' : '...'}
            </span>

            {/* Sync status chip (Compact, clean, non-wrapping badge) */}
            {getStatusChip()}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-6 pb-24 sm:pb-6">
        {/* Render Active Screen based on Selected Role */}
        {role === 'resident' && activeHousehold && (
          <ResidentScreen
            household={activeHousehold}
            checkIns={checkIns}
            settings={settings}
            lang={lang}
            healthProfile={healthProfiles.get(activeHousehold.id)}
            accessLogs={accessLogs.filter((entry) => entry.householdId === activeHousehold.id)}
            onCheckIn={handleCheckIn}
            onSendSOS={handleSendReport}
            onOpenSettingsModal={() => setIsOnboardingOpen(true)}
            onSaveHealthProfile={saveHealthProfile}
            onDeleteHealthProfile={deleteHealthProfile}
            onDownloadData={downloadResidentData}
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

        {role === 'coordinator' && (
          <CoordinatorScreen
            households={households}
            checkIns={checkIns}
            reports={reports}
            notifications={notifications}
            settings={settings}
            tasks={tasks}
            volunteers={volunteers}
            floodZones={floodZones}
            syncStatus={syncStatus}
            lang={lang}
            accessLogs={accessLogs}
            onUpdateSettings={(partial) => updateSettings(partial)}
            onMarkSeenSafe={handleMarkSeenSafe}
            onRunEvaluation={(simulatedNow) => runSilenceEvaluation(simulatedNow)}
            onUpsertHousehold={upsertHousehold}
            onUpdateTask={updateTask}
            onLogAccess={logAccess}
            onUpdateReport={updateReport}
            onSendSms={sendSmsGatewayReport}
            onMergeQrSnapshot={mergeQrSnapshot}
          />
        )}

        {role === 'volunteer' && (
          <VolunteerScreen
            volunteers={volunteers}
            tasks={tasks}
            households={households}
            onUpdateVolunteer={upsertVolunteer}
            onUpdateTask={updateTask}
            onMarkSeenSafe={handleMarkSeenSafe}
            onLogAccess={logAccess}
            onSendReport={handleSendReport}
            onMergeQrSnapshot={mergeQrSnapshot}
            onSwitchRole={handleSelectRole}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Fixed for thumb ergonomics on mobile) */}
      <nav
        aria-label="Mobile Role Switcher"
        className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F1D5BF] px-2 py-1 flex items-center justify-around shadow-2xl safe-area-pb"
      >
        <button
          type="button"
          id="mobile-nav-resident"
          onClick={() => handleSelectRole('resident')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            role === 'resident'
              ? 'text-[#F26A1B] font-extrabold bg-[#FFF6EE]'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.roles.resident}</span>
        </button>

        <button
          type="button"
          id="mobile-nav-neighbour"
          onClick={() => handleSelectRole('neighbour')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            role === 'neighbour'
              ? 'text-[#F26A1B] font-extrabold bg-[#FFF6EE]'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <Users className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.roles.neighbour}</span>
        </button>

        <button
          type="button"
          id="mobile-nav-coordinator"
          onClick={() => handleSelectRole('coordinator')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            role === 'coordinator'
              ? 'text-[#F26A1B] font-extrabold bg-[#FFF6EE]'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <Shield className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.roles.coordinator}</span>
        </button>

        <button
          type="button"
          id="mobile-nav-volunteer"
          onClick={() => handleSelectRole('volunteer')}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all active:scale-95 cursor-pointer ${
            role === 'volunteer'
              ? 'text-[#F26A1B] font-extrabold bg-[#FFF6EE]'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <HeartHandshake className="w-5 h-5 mb-0.5" />
          <span className="text-[10px] tracking-tight">{t.roles.volunteer}</span>
        </button>
      </nav>

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

      {/* Architecture & Future Roadmap Modal */}
      <RoadmapModal
        isOpen={isRoadmapOpen}
        onClose={() => setIsRoadmapOpen(false)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-[#F1D5BF] py-4 px-6 text-center text-xs text-[#6B7280] pb-24 sm:pb-4">
        RahatLink • {t.tagline}
      </footer>
    </div>
  );
}
