import { useState, useEffect, useMemo } from 'react';
import type {
  Household,
  CheckIn,
  Settings,
  Report,
  AppNotification,
  Task,
  Volunteer,
  FloodZone,
  AccessLogEntry,
  RiskTier,
  ScoreBreakdownItem,
} from '@rahatlink/core';
import {
  clusterFlaggedHouseholds,
  scoreHousehold,
  haversine,
} from '@rahatlink/core';
import { getHealthProfile } from '../store';
import { CoordinatorMap } from '../components/CoordinatorMap';
import type { Language } from '../i18n';
import {
  Shield,
  Flame,
  Clock,
  Play,
  Pause,
  RotateCcw,
  FastForward,
  Bell,
  CheckCircle2,
  XCircle,
  Edit3,
  UserCheck,
  ChevronDown,
  ChevronUp,
  MapPin,
  Activity,
  Layers,
  Heart,
  Droplets,
  Sliders,
  Check,
} from 'lucide-react';

interface CoordinatorScreenProps {
  households: Household[];
  checkIns: CheckIn[];
  reports: Report[];
  notifications: AppNotification[];
  settings: Settings;
  tasks: Task[];
  volunteers: Volunteer[];
  floodZones: FloodZone[];
  syncStatus: any;
  lang: Language;
  onUpdateSettings: (partial: Partial<Settings>) => void;
  onMarkSeenSafe: (householdId: string) => void;
  onRunEvaluation: (simulatedNow?: Date) => void;
  onUpsertHousehold: (household: Household) => void;
  onUpdateTask: (task: Task) => void;
  onLogAccess: (entry: AccessLogEntry) => void;
}

export function CoordinatorScreen({
  households,
  checkIns: _checkIns,
  reports,
  notifications,
  settings,
  tasks,
  volunteers,
  floodZones,
  syncStatus: _syncStatus,
  lang: _lang,
  onUpdateSettings,
  onMarkSeenSafe,
  onRunEvaluation,
  onUpsertHousehold: _onUpsertHousehold,
  onUpdateTask,
  onLogAccess,
}: CoordinatorScreenProps) {
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | undefined>('h-103');
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set(['task-cluster-1']));
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Volunteer Match Modal State
  const [matchingTask, setMatchingTask] = useState<{
    id: string;
    householdIds: string[];
    riskTier: RiskTier;
    score: number;
    breakdown: ScoreBreakdownItem[];
  } | null>(null);

  // Override Modal State
  const [overridingTask, setOverridingTask] = useState<{
    id: string;
    householdIds: string[];
    riskTier: RiskTier;
    score: number;
  } | null>(null);
  const [overrideChosenTier, setOverrideChosenTier] = useState<RiskTier>('MEDIUM');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');

  // Dev Fast-Forward Clock State (60x multiplier)
  const [isFastForwardActive, setIsFastForwardActive] = useState(false);
  const [simulatedMinutesElapsed, setSimulatedMinutesElapsed] = useState(0);

  // 60x fast-forward clock timer: 1 sec real = 60 min simulated
  useEffect(() => {
    let interval: any = null;
    if (isFastForwardActive) {
      interval = setInterval(() => {
        setSimulatedMinutesElapsed((prev) => {
          const next = prev + 60;
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

  const virtualNow = useMemo(() => {
    return new Date(Date.now() + simulatedMinutesElapsed * 60000);
  }, [simulatedMinutesElapsed]);

  // Spatial DBSCAN clustering of silent households
  const clusteringResult = useMemo(() => {
    return clusterFlaggedHouseholds(households, 150, 2);
  }, [households]);

  // Generate and Rank Dispatch Tasks dynamically from clusters and isolated flagged households
  interface ComputedTaskView {
    id: string;
    householdIds: string[];
    households: Household[];
    isCluster: boolean;
    clusterName?: string;
    riskTier: RiskTier;
    score: number;
    breakdown: ScoreBreakdownItem[];
    status: 'suggested' | 'approved' | 'overridden' | 'resolved' | 'cancelled';
    volunteerId?: string;
    overrideReason?: string;
    elapsedSilenceHours: number;
    effectiveGraceHours: number;
  }

  const rankedTasks = useMemo(() => {
    const list: ComputedTaskView[] = [];
    const processedHouseholdIds = new Set<string>();

    // 1. Process DBSCAN clusters
    clusteringResult.clusters.forEach((cluster, idx) => {
      const clusterHouseholds = households.filter((h) => cluster.memberIds.includes(h.id));
      if (clusterHouseholds.length === 0) return;

      cluster.memberIds.forEach((id) => processedHouseholdIds.add(id));

      // Calculate member scores and select representative highest score
      let maxScore = -1;
      let representativeBreakdown: ScoreBreakdownItem[] = [];
      let representativeTier: RiskTier = 'LOW';

      for (const h of clusterHouseholds) {
        const hp = getHealthProfile(h.id);
        const scoreRes = scoreHousehold(h, {
          healthProfile: hp,
          clusterSize: cluster.size,
          floodZones,
          reports,
          now: virtualNow,
          settings,
        });

        if (scoreRes.score > maxScore) {
          maxScore = scoreRes.score;
          representativeBreakdown = scoreRes.breakdown;
          representativeTier = scoreRes.tier;
        }
      }

      const taskId = `task-cluster-${cluster.id || idx + 1}`;
      const persistedTask = tasks.find((t) => t.id === taskId);

      // Representative silence & grace calculations
      const firstH = clusterHouseholds[0];
      const elapsedSilence = firstH.lastCheckInAt
        ? Math.round(
            Math.max(0, (virtualNow.getTime() - new Date(firstH.lastCheckInAt).getTime()) / 3600000),
          )
        : 24;
      const effectiveGrace = Math.round(
        (firstH.graceHours || 24) * (settings.disasterMode ? settings.disasterGraceFactor ?? 0.5 : 1),
      );

      list.push({
        id: taskId,
        householdIds: clusterHouseholds.map((h) => h.id),
        households: clusterHouseholds,
        isCluster: true,
        clusterName: `DBSCAN Cluster #${idx + 1} (${clusterHouseholds.length} Households)`,
        riskTier: (persistedTask?.riskTier as RiskTier) || representativeTier,
        score: maxScore,
        breakdown: representativeBreakdown,
        status: (persistedTask?.status as any) || 'suggested',
        volunteerId: persistedTask?.volunteerId,
        overrideReason: (persistedTask as any)?.overrideReason,
        elapsedSilenceHours: elapsedSilence,
        effectiveGraceHours: effectiveGrace,
      });
    });

    // 2. Process Isolated / Solitary Flagged Households
    const solitaryFlagged = households.filter(
      (h) => (h.status === 'flagged' || h.status === 'pinged') && !processedHouseholdIds.has(h.id),
    );

    for (const h of solitaryFlagged) {
      const hp = getHealthProfile(h.id);
      const scoreRes = scoreHousehold(h, {
        healthProfile: hp,
        clusterSize: 1, // isolated
        floodZones,
        reports,
        now: virtualNow,
        settings,
      });

      const taskId = `task-${h.id}`;
      const persistedTask = tasks.find((t) => t.id === taskId);

      const elapsedSilence = h.lastCheckInAt
        ? Math.round(
            Math.max(0, (virtualNow.getTime() - new Date(h.lastCheckInAt).getTime()) / 3600000),
          )
        : 24;
      const effectiveGrace = Math.round(
        (h.graceHours || 24) * (settings.disasterMode ? settings.disasterGraceFactor ?? 0.5 : 1),
      );

      list.push({
        id: taskId,
        householdIds: [h.id],
        households: [h],
        isCluster: false,
        riskTier: (persistedTask?.riskTier as RiskTier) || scoreRes.tier,
        score: scoreRes.score,
        breakdown: scoreRes.breakdown,
        status: (persistedTask?.status as any) || 'suggested',
        volunteerId: persistedTask?.volunteerId,
        overrideReason: (persistedTask as any)?.overrideReason,
        elapsedSilenceHours: elapsedSilence,
        effectiveGraceHours: effectiveGrace,
      });
    }

    // Sort descending by score; active tasks first
    return list.sort((a, b) => {
      const aActive = a.status !== 'resolved' && a.status !== 'cancelled' ? 1 : 0;
      const bActive = b.status !== 'resolved' && b.status !== 'cancelled' ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return b.score - a.score;
    });
  }, [
    clusteringResult,
    households,
    floodZones,
    reports,
    virtualNow,
    settings,
    tasks,
  ]);

  // Metric counts
  const flaggedCount = households.filter((h) => h.status === 'flagged').length;
  const okCount = households.filter((h) => h.status === 'ok').length;
  const seenSafeCount = households.filter((h) => h.status === 'seenSafe').length;
  const approvedTasksCount = tasks.filter((t) => t.status === 'approved').length;

  // Toggle "Why this score?" accordion
  const toggleExpand = (taskId: string) => {
    setExpandedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Actions
  const handleApprove = (taskView: ComputedTaskView) => {
    // Open volunteer matching modal to assign responder
    setMatchingTask({
      id: taskView.id,
      householdIds: taskView.householdIds,
      riskTier: taskView.riskTier,
      score: taskView.score,
      breakdown: taskView.breakdown,
    });
  };

  const handleConfirmVolunteerDispatch = (volunteerId: string) => {
    if (!matchingTask) return;
    const taskRecord: Task = {
      id: matchingTask.id,
      householdIds: matchingTask.householdIds,
      riskTier: matchingTask.riskTier,
      score: matchingTask.score,
      breakdown: matchingTask.breakdown,
      status: 'approved',
      volunteerId,
      approvedBy: 'Coordinator',
      createdAt: new Date().toISOString(),
    };
    onUpdateTask(taskRecord);
    onLogAccess({
      id: `log-${Date.now()}`,
      at: new Date().toISOString(),
      actor: 'Coordinator',
      role: 'coordinator',
      householdId: matchingTask.householdIds[0],
      field: 'dispatch-approval',
      action: 'view',
      reason: `Approved dispatch matching with volunteer ${volunteerId}`,
    });
    setMatchingTask(null);
  };

  const handleOpenOverride = (taskView: ComputedTaskView) => {
    setOverridingTask({
      id: taskView.id,
      householdIds: taskView.householdIds,
      riskTier: taskView.riskTier,
      score: taskView.score,
    });
    setOverrideChosenTier(taskView.riskTier);
    setOverrideReason('');
    setOverrideError('');
  };

  const handleSaveOverride = () => {
    if (!overridingTask) return;
    if (!overrideReason.trim()) {
      setOverrideError('A documented reason is required to override automated risk tier.');
      return;
    }

    const taskRecord: any = {
      id: overridingTask.id,
      householdIds: overridingTask.householdIds,
      riskTier: overrideChosenTier,
      score: overridingTask.score,
      breakdown: [],
      status: 'overridden',
      overrideReason: overrideReason.trim(),
      approvedBy: 'Coordinator',
      createdAt: new Date().toISOString(),
    };
    onUpdateTask(taskRecord);
    onLogAccess({
      id: `log-override-${Date.now()}`,
      at: new Date().toISOString(),
      actor: 'Coordinator',
      role: 'coordinator',
      householdId: overridingTask.householdIds[0],
      field: 'riskTier-override',
      action: 'view',
      reason: `Overrode tier to ${overrideChosenTier}: ${overrideReason.trim()}`,
    });
    setOverridingTask(null);
  };

  const handleSeenSafeTask = (taskView: ComputedTaskView) => {
    taskView.householdIds.forEach((hId) => {
      onMarkSeenSafe(hId);
    });
    onUpdateTask({
      id: taskView.id,
      householdIds: taskView.householdIds,
      riskTier: taskView.riskTier,
      score: taskView.score,
      breakdown: taskView.breakdown,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      approvedBy: 'Coordinator',
      createdAt: new Date().toISOString(),
    });
    onLogAccess({
      id: `log-seenSafe-${Date.now()}`,
      at: new Date().toISOString(),
      actor: 'Coordinator',
      role: 'coordinator',
      householdId: taskView.householdIds[0],
      field: 'status-seenSafe',
      action: 'view',
      reason: 'Confirmed safe by coordinator / neighbour outreach; flag cleared',
    });
  };

  const handleCancelTask = (taskView: ComputedTaskView) => {
    onUpdateTask({
      id: taskView.id,
      householdIds: taskView.householdIds,
      riskTier: taskView.riskTier,
      score: taskView.score,
      breakdown: taskView.breakdown,
      status: 'cancelled',
      createdAt: new Date().toISOString(),
    });
  };

  const handleFastForwardJump = (hours: number) => {
    setSimulatedMinutesElapsed((prev) => {
      const next = prev + hours * 60;
      onRunEvaluation(new Date(Date.now() + next * 60000));
      return next;
    });
  };

  const handleResetClock = () => {
    setIsFastForwardActive(false);
    setSimulatedMinutesElapsed(0);
    onRunEvaluation(new Date());
  };

  // Helper for factor maximums
  const getMaxWeightForFactor = (factor: string) => {
    const w = settings.weights;
    switch (factor) {
      case 'silenceBeyondGrace':
        return w.silenceBeyondGrace ?? 25;
      case 'clusterSize':
        return w.clusterSize ?? 20;
      case 'medicalVulnerability':
        return w.medicalVulnerability ?? 25;
      case 'floodZoneDistance':
        return w.floodZoneDistance ?? 15;
      case 'battery':
        return w.battery ?? 5;
      case 'corroboratingReports':
        return w.corroboratingReports ?? 10;
      default:
        return 25;
    }
  };

  const getFactorLabel = (factor: string) => {
    switch (factor) {
      case 'silenceBeyondGrace':
        return 'Silence Past Grace';
      case 'clusterSize':
        return 'DBSCAN Cluster Size';
      case 'medicalVulnerability':
        return 'Medical Vulnerability (DPDP Consent)';
      case 'floodZoneDistance':
        return 'Flood Zone Proximity';
      case 'battery':
        return 'Critical Battery Level';
      case 'corroboratingReports':
        return 'Distress Reports Nearby';
      default:
        return factor;
    }
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* 1. Governance Banner: Hard Rule 2 */}
      <div className="bg-[#FFF6EE] border-2 border-[#F26A1B]/40 rounded-2xl p-3 sm:p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0B1B3A] flex items-center justify-center text-white shrink-0 shadow">
            <Shield className="w-5 h-5 text-[#F26A1B]" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-extrabold text-[#0B1B3A] tracking-tight flex items-center gap-1.5">
              <span>RahatLink suggests. A coordinator decides.</span>
              <span className="bg-[#F26A1B] text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Human Oversight
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#6B7280]">
              Automated heuristics prioritize silent homes. Every volunteer dispatch and tier override requires coordinator authorization.
            </p>
          </div>
        </div>

        {/* Action Controls in Banner */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            type="button"
            onClick={() => setIsFeedOpen(!isFeedOpen)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
              isFeedOpen
                ? 'bg-[#0B1B3A] text-white border-[#0B1B3A]'
                : 'bg-white text-[#0B1B3A] border-[#F1D5BF] hover:bg-[#FFF6EE]'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-[#F26A1B]" />
            <span>Feed ({notifications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-[#0B1B3A] border border-[#F1D5BF] hover:bg-[#FFF6EE] transition-all flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-[#2F6FDE]" />
            <span>Weights</span>
          </button>
        </div>
      </div>

      {/* 2. Top Bar: Disaster Toggle, Fast-Forward, Metrics, Simulated Ribbon */}
      <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Left Side: Disaster Mode & Fast Forward */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Disaster Mode Toggle */}
          <button
            type="button"
            onClick={() => onUpdateSettings({ disasterMode: !settings.disasterMode })}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
              settings.disasterMode
                ? 'bg-red-600 text-white border-red-700 shadow-md animate-pulse'
                : 'bg-[#FFF6EE] text-[#0B1B3A] border-[#F1D5BF] hover:bg-[#FDE8D7]'
            }`}
            title="Halves check-in grace period and heightens clustering urgency"
          >
            <Flame className={`w-4 h-4 ${settings.disasterMode ? 'text-amber-300' : 'text-[#F26A1B]'}`} />
            <span>Disaster Mode: {settings.disasterMode ? 'ACTIVE (0.5x Grace)' : 'STANDBY'}</span>
          </button>

          {/* Dev Fast-Forward 60x Button */}
          <div className="flex items-center gap-1.5 bg-[#F8FAFC] border border-gray-200 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setIsFastForwardActive(!isFastForwardActive)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                isFastForwardActive
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-[#0B1B3A] border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {isFastForwardActive ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pause 60x
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" /> Dev 60x Clock
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleFastForwardJump(24)}
              className="px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              title="Fast forward +24 hours"
            >
              +24h
            </button>

            <button
              type="button"
              onClick={() => handleFastForwardJump(48)}
              className="px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
              title="Fast forward +48 hours"
            >
              +48h
            </button>

            {simulatedMinutesElapsed > 0 && (
              <button
                type="button"
                onClick={handleResetClock}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                title="Reset simulated clock to real time"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {simulatedMinutesElapsed > 0 && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              +{Math.round(simulatedMinutesElapsed / 60)}h Virtual Time
            </span>
          )}
        </div>

        {/* Right Side: Counts of Flagged / Approved / Resolved / OK */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-xs font-extrabold text-red-700">{flaggedCount} Flagged</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-xs font-extrabold text-[#0F7A5F]">{approvedTasksCount} Approved</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-xs font-extrabold text-[#2F6FDE]">{seenSafeCount} Resolved</span>
          </div>

          <div className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-xl text-center">
            <span className="text-xs font-bold text-gray-600">{okCount} OK</span>
          </div>
        </div>
      </div>

      {/* Notifications Drawer (Collapsible) */}
      {isFeedOpen && (
        <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#F26A1B]" />
              <h3 className="text-xs font-bold text-[#0B1B3A] uppercase tracking-wider">
                Simulated Alerts & Neighbour Ping Feed
              </h3>
            </div>
            <span className="text-[11px] text-[#6B7280]">
              {notifications.length} logged events
            </span>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-[#6B7280] py-3 text-center">
              No recent notifications logged. Advance the silence clock to observe SMS reminders and neighbour pings.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {notifications.slice(-6).reverse().map((notif) => (
                <div
                  key={notif.id}
                  className="p-2.5 rounded-xl text-xs flex items-start gap-2.5 bg-[#FFF6EE] border border-[#F1D5BF]"
                >
                  <span className="text-base leading-none">
                    {notif.type === 'flagged' ? '🚨' : notif.type === 'pinged' ? '🔔' : '📱'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B1B3A]">{notif.householdName}</span>
                      <span className="text-[10px] text-[#6B7280]">
                        {new Date(notif.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#4B5563] mt-0.5">{notif.message}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings / Weights Drawer (Collapsible) */}
      {isSettingsOpen && (
        <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 shadow-sm space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#2F6FDE]" />
              <h3 className="text-xs font-bold text-[#0B1B3A] uppercase tracking-wider">
                Transparent Heuristic Risk Weights
              </h3>
            </div>
            <span className="text-[11px] text-[#6B7280]">Tunable in CRDT settings</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {Object.entries(settings.weights).map(([k, v]) => (
              <div key={k} className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-center">
                <div className="text-[10px] text-gray-500 font-bold uppercase truncate">
                  {k}
                </div>
                <div className="text-base font-extrabold text-[#0B1B3A] mt-1">{v} pts</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Main Two-Column Layout (Desktop-First, Tablet Usable) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Map View (7 cols) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-3 shadow-sm min-h-[580px] flex flex-col">
            <CoordinatorMap
              households={households}
              floodZones={floodZones}
              volunteers={volunteers}
              clusters={clusteringResult.clusters}
              selectedHouseholdId={selectedHouseholdId}
              onSelectHousehold={(id) => {
                setSelectedHouseholdId(id);
                // Also auto-expand matching task if present
                const match = rankedTasks.find((t) => t.householdIds.includes(id));
                if (match) {
                  setExpandedTaskIds((prev) => new Set([...prev, match.id]));
                }
              }}
            />
          </div>

          {/* Map Footer: Quick Cluster Selector */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-3 shadow-sm flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#F26A1B]" />
              <span className="font-bold text-[#0B1B3A]">DBSCAN Clusters Detected:</span>
              <span className="font-extrabold bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-[11px]">
                {clusteringResult.clusters.length}
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {clusteringResult.clusters.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    const firstMember = c.memberIds[0];
                    setSelectedHouseholdId(firstMember);
                    setExpandedTaskIds((prev) => new Set([...prev, `task-cluster-${c.id || i + 1}`]));
                  }}
                  className="px-2.5 py-1 rounded-xl bg-[#FFF6EE] border border-[#F1D5BF] hover:bg-[#FDE8D7] font-semibold text-[11px] text-[#0B1B3A] transition-colors"
                >
                  Cluster #{i + 1} ({c.size} homes)
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Ranked Dispatch Queue (5 cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          {/* Header */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-3.5 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#F26A1B]" />
              <h3 className="text-sm font-bold text-[#0B1B3A]">
                Ranked Dispatch Tasks ({rankedTasks.length})
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-[#6B7280]">
              Sorted by Risk Score
            </span>
          </div>

          {/* Task Cards List */}
          {rankedTasks.length === 0 ? (
            /* 7. Empty State */
            <div className="bg-white border border-[#F1D5BF] rounded-3xl p-8 shadow-sm text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-[#0F7A5F] flex items-center justify-center mx-auto border border-emerald-200">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="text-base font-bold text-[#0B1B3A]">
                All Households Checked In & Safe
              </h4>
              <p className="text-xs text-[#6B7280] max-w-xs mx-auto">
                No households are currently overdue or silent beyond their grace window.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleFastForwardJump(36)}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-[#FFF6EE] border border-[#F1D5BF] text-[#F26A1B] hover:bg-[#FDE8D7] transition-colors inline-flex items-center gap-1.5"
                >
                  <FastForward className="w-3.5 h-3.5" />
                  <span>Simulate 36h Silence Escalation</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 max-h-[640px] overflow-y-auto pr-1">
              {rankedTasks.map((task) => {
                const isExpanded = expandedTaskIds.has(task.id);
                const isSelected = task.householdIds.includes(selectedHouseholdId || '');

                // Tier Styling
                const tierStyles =
                  task.riskTier === 'HIGH'
                    ? {
                        badge: 'bg-red-100 text-red-800 border-red-300',
                        border: 'border-l-4 border-l-red-600',
                        scoreBg: 'bg-red-600 text-white',
                      }
                    : task.riskTier === 'MEDIUM'
                    ? {
                        badge: 'bg-amber-100 text-amber-800 border-amber-300',
                        border: 'border-l-4 border-l-amber-500',
                        scoreBg: 'bg-amber-500 text-white',
                      }
                    : {
                        badge: 'bg-blue-100 text-blue-800 border-blue-300',
                        border: 'border-l-4 border-l-blue-500',
                        scoreBg: 'bg-blue-600 text-white',
                      };

                const isResolved = task.status === 'resolved' || task.status === 'cancelled';

                return (
                  <div
                    key={task.id}
                    className={`bg-white border rounded-2xl p-4 shadow-sm transition-all space-y-3 ${
                      isSelected ? 'ring-2 ring-[#0B1B3A] border-[#0B1B3A]' : 'border-[#F1D5BF]'
                    } ${tierStyles.border} ${isResolved ? 'opacity-65' : ''}`}
                  >
                    {/* Top Row: Tier Badge + Score + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border ${tierStyles.badge}`}
                        >
                          {task.riskTier} TIER
                        </span>

                        {task.isCluster && (
                          <span className="bg-[#FFF6EE] border border-[#F1D5BF] text-[#F26A1B] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Layers className="w-3 h-3" /> DBSCAN Cluster
                          </span>
                        )}

                        {task.status !== 'suggested' && (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              task.status === 'approved'
                                ? 'bg-emerald-100 text-[#0F7A5F]'
                                : task.status === 'overridden'
                                ? 'bg-purple-100 text-purple-700'
                                : task.status === 'resolved'
                                ? 'bg-blue-100 text-[#2F6FDE]'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {task.status}
                          </span>
                        )}
                      </div>

                      {/* Score Pill */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#6B7280]">Score:</span>
                        <span
                          className={`text-xs font-black px-2 py-0.5 rounded-lg shadow-sm ${tierStyles.scoreBg}`}
                        >
                          {task.score}/100
                        </span>
                      </div>
                    </div>

                    {/* Household Details */}
                    <div className="space-y-1.5">
                      {task.households.map((h) => (
                        <div
                          key={h.id}
                          onClick={() => setSelectedHouseholdId(h.id)}
                          className="cursor-pointer hover:bg-[#FFF6EE] p-1.5 rounded-xl transition-colors"
                        >
                          <div className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#F26A1B] shrink-0" />
                            <span>{h.name}</span>
                            {h.consent?.health && (
                              <span
                                title="Health profile consented under DPDP Act"
                                className="inline-flex items-center text-rose-600"
                              >
                                <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#6B7280] ml-5">
                            {h.address} • Floor {h.floor ?? 0} • Family size {h.householdSize ?? 1}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Silence Duration & Grace Window */}
                    <div className="bg-[#FFF6EE] rounded-xl px-3 py-2 text-[11px] flex items-center justify-between text-[#0B1B3A]">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#F26A1B]" />
                        <span>
                          <strong className="text-red-700">silent {task.elapsedSilenceHours} h</strong>, grace {task.effectiveGraceHours} h
                        </span>
                      </div>
                      <span className="text-[10px] text-[#6B7280]">
                        Exceeded by {Math.max(0, task.elapsedSilenceHours - task.effectiveGraceHours)}h
                      </span>
                    </div>

                    {/* Override reason notice if present */}
                    {task.overrideReason && (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 text-[11px] text-purple-900">
                        <strong>Coordinator Override:</strong> {task.overrideReason}
                      </div>
                    )}

                    {/* Assigned Volunteer notice if present */}
                    {task.volunteerId && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 text-[11px] text-emerald-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Dispatched to Volunteer: <strong>{volunteers.find((v) => v.id === task.volunteerId)?.name || task.volunteerId}</strong></span>
                      </div>
                    )}

                    {/* "Why this score?" Expandable Panel */}
                    <div className="border-t border-gray-100 pt-2">
                      <button
                        type="button"
                        onClick={() => toggleExpand(task.id)}
                        className="w-full flex items-center justify-between text-xs font-bold text-[#0B1B3A] hover:text-[#F26A1B] transition-colors py-1"
                      >
                        <span className="flex items-center gap-1.5">
                          <Droplets className="w-3.5 h-3.5 text-[#2F6FDE]" />
                          Why this score? (Factor Breakdown)
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="mt-2.5 pt-2 border-t border-gray-100 space-y-2.5 bg-gray-50/70 p-3 rounded-xl animate-fadeIn">
                          {task.breakdown.map((item) => {
                            const maxWeight = getMaxWeightForFactor(item.factor);
                            const pct = Math.min(100, Math.round((item.points / maxWeight) * 100));

                            return (
                              <div key={item.factor} className="space-y-1">
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className="font-semibold text-gray-700">
                                    {getFactorLabel(item.factor)}
                                  </span>
                                  <span className="font-extrabold text-[#0B1B3A]">
                                    +{item.points} / {maxWeight} pts
                                  </span>
                                </div>

                                {/* Horizontal progress bar */}
                                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      item.points > 0 ? 'bg-[#F26A1B]' : 'bg-gray-300'
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>

                                {/* Natural Language Explanation Sentence */}
                                <div className="text-[10px] text-[#4B5563] italic">
                                  "{item.description}"
                                </div>
                              </div>
                            );
                          })}

                          <div className="pt-1 text-[9px] text-[#6B7280] border-t border-gray-200">
                            Transparent heuristic formula ($0-100$). Medical factors strictly gated by resident DPDP consent.
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Actions per Task: Approve / Override / Seen Safe / Cancel */}
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
                      {/* Approve Button */}
                      <button
                        type="button"
                        onClick={() => handleApprove(task)}
                        disabled={task.status === 'resolved'}
                        className="flex-1 min-w-[90px] px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#0F7A5F] hover:bg-[#0c624c] text-white transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Approve dispatch and match available volunteer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      {/* Override Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenOverride(task)}
                        disabled={task.status === 'resolved'}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[#F1D5BF] hover:bg-gray-50 text-[#0B1B3A] transition-all flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Override risk tier with required reason"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-purple-600" />
                        <span>Override</span>
                      </button>

                      {/* Seen Safe Button */}
                      <button
                        type="button"
                        onClick={() => handleSeenSafeTask(task)}
                        disabled={task.status === 'resolved'}
                        className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[#2F6FDE] hover:bg-[#255ac0] text-white transition-all shadow-sm flex items-center justify-center gap-1 disabled:opacity-50"
                        title="Neighbour or volunteer confirmed household is safe; resets silence clock and clears flag"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Seen Safe</span>
                      </button>

                      {/* Cancel Button */}
                      <button
                        type="button"
                        onClick={() => handleCancelTask(task)}
                        disabled={task.status === 'cancelled' || task.status === 'resolved'}
                        className="px-2 py-1.5 rounded-xl text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        title="Cancel task"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 4. Volunteer Matching Modal (Triggered on Approve) */}
      {matchingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-[#F1D5BF] space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-[#0F7A5F]" />
                <h3 className="text-base font-bold text-[#0B1B3A]">
                  Volunteer Dispatch Matching
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setMatchingTask(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-[#FFF6EE] p-3 rounded-2xl text-xs text-[#0B1B3A] space-y-1">
              <div className="font-bold flex items-center justify-between">
                <span>Task: {matchingTask.id}</span>
                <span className="bg-red-100 text-red-800 px-2 py-0.5 rounded font-black">
                  {matchingTask.riskTier} TIER ({matchingTask.score} pts)
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                Households to check: {matchingTask.householdIds.join(', ')}
              </p>
            </div>

            {/* Candidate Volunteers List sorted by distance */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {volunteers.map((v) => {
                const targetH = households.find((h) => h.id === matchingTask.householdIds[0]);
                const distMeters = targetH
                  ? Math.round(haversine(targetH, { lat: v.lat, lng: v.lng }))
                  : 500;

                return (
                  <div
                    key={v.id}
                    className="border border-[#F1D5BF] rounded-2xl p-3 flex items-center justify-between gap-3 hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <div className="font-bold text-xs text-[#0B1B3A] flex items-center gap-2">
                        <span>{v.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                            v.available
                              ? 'bg-emerald-100 text-[#0F7A5F]'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {v.available ? 'Available' : 'Assigned'}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-0.5">
                        Distance: ~{distMeters}m away • Skills: {v.skills.join(', ')}
                      </div>
                      <div className="text-[10px] text-[#6B7280]">
                        Equipment: {v.equipment.join(', ')}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleConfirmVolunteerDispatch(v.id)}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B1B3A] hover:bg-[#1a2d52] text-white shadow transition-all shrink-0"
                    >
                      Dispatch
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMatchingTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Override Modal (Choose tier + Required reason) */}
      {overridingTask && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#F1D5BF] space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-purple-600" />
                <h3 className="text-base font-bold text-[#0B1B3A]">
                  Override Risk Tier
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOverridingTask(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#6B7280]">
              As coordinator, you can adjust automated risk classifications. All overrides require a documented reason for compliance and audit logging.
            </p>

            {/* Choose Tier */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Select Adjusted Risk Tier:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['HIGH', 'MEDIUM', 'LOW'] as RiskTier[]).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setOverrideChosenTier(tier)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      overrideChosenTier === tier
                        ? 'bg-[#0B1B3A] text-white border-[#0B1B3A] shadow'
                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Required Reason Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Required Reason for Override: <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={3}
                value={overrideReason}
                onChange={(e) => {
                  setOverrideReason(e.target.value);
                  if (overrideError) setOverrideError('');
                }}
                placeholder="e.g. Field volunteer verified resident evacuated safely, or power outage verified by local sub-station..."
                className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]"
              />
              {overrideError && (
                <div className="text-[11px] text-red-600 font-semibold">
                  {overrideError}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setOverridingTask(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveOverride}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0B1B3A] hover:bg-[#1a2d52] text-white shadow transition-all"
              >
                Confirm Override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
