import { useState, useMemo } from 'react';
import type {
  Volunteer,
  Task,
  Household,
  AccessLogEntry,
  Report,
} from '@rahatlink/core';
import { haversine } from '@rahatlink/core';
import { requestHealthBriefing } from '../store';
import {
  UserCheck,
  MapPin,
  Shield,
  Heart,
  Compass,
  Phone,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  CheckSquare,
  Square,
  Lock,
  Unlock,
  Clock,
  Send,
  Radio,
  QrCode,
} from 'lucide-react';
import { QrSyncModal } from '../components/QrSyncModal';

interface VolunteerScreenProps {
  volunteers: Volunteer[];
  tasks: Task[];
  households: Household[];
  onUpdateVolunteer: (volunteer: Volunteer) => void;
  onUpdateTask: (task: Task) => void;
  onMarkSeenSafe: (householdId: string) => void;
  onLogAccess: (entry: AccessLogEntry) => void;
  onSendReport: (report: Report) => void;
  onMergeQrSnapshot?: (snapshot: any) => boolean;
}

export function VolunteerScreen({
  volunteers,
  tasks,
  households,
  onUpdateVolunteer,
  onUpdateTask,
  onMarkSeenSafe,
  onLogAccess: _onLogAccess,
  onSendReport,
  onMergeQrSnapshot,
}: VolunteerScreenProps) {
  // Active volunteer identity (defaults to v-101 Priya Verma)
  const [activeVolunteerId, setActiveVolunteerId] = useState<string>(() => {
    return volunteers[0]?.id || 'v-101';
  });

  const [isQrSyncOpen, setIsQrSyncOpen] = useState(false);

  const currentVolunteer =
    volunteers.find((v) => v.id === activeVolunteerId) || volunteers[0];

  // Briefing unlock cache: taskId -> unlocked payload
  const [unlockedBriefings, setUnlockedBriefings] = useState<Record<string, any>>({});
  const [isUnlocking, setIsUnlocking] = useState<string | null>(null);

  // Field checklist state: taskId -> set of checked items
  const [taskChecklists, setTaskChecklists] = useState<Record<string, Set<number>>>({});

  // Resolution modal state
  const [resolvingTaskId, setResolvingTaskId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  // Backup request state
  const [backupTaskId, setBackupTaskId] = useState<string | null>(null);
  const [backupNote, setBackupNote] = useState('');
  const [backupSent, setBackupSent] = useState<string | null>(null);

  // Filter tasks assigned to this volunteer that are approved or accepted
  const myAssignedTasks = useMemo(() => {
    return tasks.filter(
      (t) =>
        t.volunteerId === currentVolunteer?.id &&
        (t.status === 'approved' || t.status === 'accepted'),
    );
  }, [tasks, currentVolunteer?.id]);

  const resolvedTasksCount = useMemo(() => {
    return tasks.filter(
      (t) => t.volunteerId === currentVolunteer?.id && t.status === 'resolved',
    ).length;
  }, [tasks, currentVolunteer?.id]);

  if (!currentVolunteer) {
    return (
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-8 text-center text-xs text-[#6B7280]">
        No volunteer profile configured. Please add or select a volunteer profile.
      </div>
    );
  }

  // Handle Availability Toggle
  const handleToggleAvailability = () => {
    onUpdateVolunteer({
      ...currentVolunteer,
      available: !currentVolunteer.available,
    });
  };

  // Handle Accept Task: unlocks briefing via hub or offline fallback
  const handleAcceptTask = async (task: Task) => {
    setIsUnlocking(task.id);
    try {
      const briefing = await requestHealthBriefing(task.id, currentVolunteer.id);
      setUnlockedBriefings((prev) => ({
        ...prev,
        [task.id]: briefing,
      }));

      // Update task status to accepted
      onUpdateTask({
        ...task,
        status: 'accepted',
      });
    } catch (err) {
      console.error('Failed to accept task briefing:', err);
    } finally {
      setIsUnlocking(null);
    }
  };

  // Handle Decline Task
  const handleDeclineTask = (task: Task) => {
    onUpdateTask({
      ...task,
      status: 'suggested',
      volunteerId: undefined,
    });
    // Remove from unlocked cache if present
    setUnlockedBriefings((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });
  };

  // Checklist item toggle
  const handleToggleChecklist = (taskId: string, index: number) => {
    setTaskChecklists((prev) => {
      const currentSet = new Set(prev[taskId] || []);
      if (currentSet.has(index)) {
        currentSet.delete(index);
      } else {
        currentSet.add(index);
      }
      return { ...prev, [taskId]: currentSet };
    });
  };

  // Handle Resolve Task
  const handleConfirmResolve = (task: Task) => {
    // 1. Mark household seenSafe
    task.householdIds.forEach((hId) => {
      onMarkSeenSafe(hId);
    });

    // 2. Mark task resolved
    onUpdateTask({
      ...task,
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
    });

    // 3. Expire / clear briefing from memory
    setUnlockedBriefings((prev) => {
      const next = { ...prev };
      delete next[task.id];
      return next;
    });

    setResolvingTaskId(null);
    setResolutionNote('');
  };

  // Handle Send Backup Request
  const handleSendBackupRequest = (task: Task) => {
    if (!backupNote.trim()) return;

    onSendReport({
      id: `rep-backup-${Date.now()}`,
      at: new Date().toISOString(),
      lat: currentVolunteer.lat,
      lng: currentVolunteer.lng,
      text: `[EMERGENCY BACKUP REQUEST] Volunteer ${currentVolunteer.name} requested immediate support for Task ${task.id}: ${backupNote.trim()}`,
      source: 'app',
      parsed: {
        type: 'volunteer-backup-request',
        urgency: 'HIGH',
        needs: ['boat', 'medical', 'first-aid'],
        matchedHouseholdId: task.householdIds[0],
      },
    });

    setBackupSent(task.id);
    setTimeout(() => {
      setBackupTaskId(null);
      setBackupNote('');
      setBackupSent(null);
    }, 1500);
  };

  // Helper to compute rough compass bearing
  const calculateBearing = (startLat: number, startLng: number, destLat: number, destLng: number) => {
    const y = Math.sin(destLng - startLng) * Math.cos(destLat);
    const x =
      Math.cos(startLat) * Math.sin(destLat) -
      Math.sin(startLat) * Math.cos(destLat) * Math.cos(destLng - startLng);
    const brng = Math.atan2(y, x);
    const deg = ((brng * 180) / Math.PI + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directions[Math.round(deg / 45) % 8];
  };

  const defaultChecklistItems = [
    'Assess perimeter water & structural hazards before entry',
    'Establish physical contact & confirm resident identity',
    'Check pulse, respiration, and alertness',
    'Inspect medical supplies / refrigerated insulin needs',
    'Provide initial hydration or first-aid comfort',
    'Report resident safe & confirm closure with coordinator',
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* 1. Header & Identity Switcher */}
      <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#0B1B3A] text-white flex items-center justify-center text-lg font-bold shadow">
              🦺
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-[#0B1B3A]">{currentVolunteer.name}</h2>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    currentVolunteer.available
                      ? 'bg-emerald-100 text-[#0F7A5F] border border-emerald-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {currentVolunteer.available ? '● Available' : '○ Offline'}
                </span>
              </div>
              <p className="text-xs text-[#6B7280]">
                Field Responder App • Offline IndexedDB Sync • SRIJAN 2K26
              </p>
            </div>
          </div>

          {/* Volunteer Profile Selector & QR Sync */}
          <div className="flex items-center gap-2 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setIsQrSyncOpen(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#0B1B3A] text-white hover:bg-[#1a2d52] transition-colors flex items-center gap-1.5 shadow-sm"
              title="Air-gapped sync with coordinator via QR code"
            >
              <QrCode className="w-3.5 h-3.5 text-[#F26A1B]" />
              <span>QR Sync</span>
            </button>

            <span className="text-xs text-[#6B7280] font-semibold">Profile:</span>
            <select
              value={activeVolunteerId}
              onChange={(e) => setActiveVolunteerId(e.target.value)}
              className="text-xs font-bold bg-[#FFF6EE] border border-[#F1D5BF] rounded-xl px-2.5 py-1.5 text-[#0B1B3A] focus:outline-none"
            >
              {volunteers.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.skills.join(', ')})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Volunteer Skills, Equipment, and Availability Toggle */}
        <div className="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Skills & Equipment */}
          <div className="sm:col-span-2 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-600">Certified Skills:</span>
              {currentVolunteer.skills.map((skill) => (
                <span
                  key={skill}
                  className="bg-[#FFF6EE] border border-[#F1D5BF] text-[#F26A1B] text-[10px] font-bold px-2 py-0.5 rounded-md uppercase"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-600">Equipment:</span>
              {currentVolunteer.equipment.map((eq) => (
                <span
                  key={eq}
                  className="bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-semibold px-2 py-0.5 rounded-md"
                >
                  {eq}
                </span>
              ))}
            </div>
          </div>

          {/* Availability Toggle */}
          <div className="flex items-center sm:justify-end gap-2.5">
            <button
              type="button"
              onClick={handleToggleAvailability}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                currentVolunteer.available
                  ? 'bg-[#0F7A5F] hover:bg-[#0c624c] text-white shadow'
                  : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>{currentVolunteer.available ? 'Ready for Dispatch' : 'Set as Available'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Privacy Rule Banner (Hard Rule 3) */}
      <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-3.5 text-xs text-[#0B1B3A] flex items-start gap-2.5 shadow-sm">
        <Shield className="w-4 h-4 text-[#F26A1B] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-extrabold text-[#0B1B3A]">
            Privacy Shield Active (DPDP Act Compliance)
          </div>
          <p className="text-[11px] text-[#6B7280]">
            Resident identities and medical details are encrypted and hidden until you accept an approved dispatch. Access is audit-logged and expires upon task resolution.
          </p>
        </div>
      </div>

      {/* 3. Task Inbox */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#F26A1B]" />
            <h3 className="text-sm font-bold text-[#0B1B3A]">
              My Dispatch Inbox ({myAssignedTasks.length})
            </h3>
          </div>
          <span className="text-xs text-[#6B7280]">
            {resolvedTasksCount} successfully resolved
          </span>
        </div>

        {myAssignedTasks.length === 0 ? (
          /* Empty Inbox State */
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto text-gray-400">
              <Clock className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-[#0B1B3A]">No Pending Dispatches</h4>
            <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
              When a coordinator approves a dispatch matching your skills and location, your alert will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {myAssignedTasks.map((task) => {
              const primaryHousehold = households.find((h) => h.id === task.householdIds[0]);
              const isAccepted = task.status === 'accepted';
              const unlockedData = unlockedBriefings[task.id];

              // Calculate distance to primary household
              const distMeters = primaryHousehold
                ? Math.round(haversine(currentVolunteer, primaryHousehold))
                : 250;

              // Derive rough neighborhood area (hide exact house/floor before acceptance)
              const roughArea = primaryHousehold
                ? primaryHousehold.address.split(',')[1]?.trim() || 'Sector A Gomti Nagar'
                : 'Riverbank Area';

              // Key estimated need (privacy-preserving heuristic)
              let estimatedNeed = 'Silent welfare check';
              if (task.score >= 80) {
                estimatedNeed = 'May need insulin / medical support & urgent physical check';
              } else if (task.score >= 60) {
                estimatedNeed = 'Check-in overdue past grace; welfare assessment';
              }

              const bearing = primaryHousehold
                ? calculateBearing(
                    currentVolunteer.lat,
                    currentVolunteer.lng,
                    primaryHousehold.lat,
                    primaryHousehold.lng,
                  )
                : 'NE';

              return (
                <div
                  key={task.id}
                  className={`bg-white border rounded-3xl p-5 shadow-sm space-y-4 transition-all ${
                    isAccepted
                      ? 'border-[#0B1B3A] ring-1 ring-[#0B1B3A]'
                      : 'border-[#F1D5BF]'
                  }`}
                >
                  {/* Task Header: Risk Tier & Urgency */}
                  <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-black uppercase px-2.5 py-0.5 rounded-full border ${
                          task.riskTier === 'HIGH'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300'
                        }`}
                      >
                        {task.riskTier} URGENCY
                      </span>
                      <span className="text-[11px] font-bold text-gray-500">
                        Task #{task.id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isAccepted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-[#0F7A5F]">
                          <Unlock className="w-3.5 h-3.5" /> Briefing Unlocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                          <Lock className="w-3.5 h-3.5" /> Awaiting Acceptance
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Privacy-Preserving View (BEFORE ACCEPTANCE) */}
                  {!isAccepted && (
                    <div className="space-y-3">
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-600 flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-[#F26A1B]" /> Rough Vicinity:
                          </span>
                          <span className="font-extrabold text-[#0B1B3A]">{roughArea}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-600 flex items-center gap-1.5">
                            <Navigation className="w-4 h-4 text-[#2F6FDE]" /> Proximity:
                          </span>
                          <span className="font-bold text-[#0B1B3A]">
                            ~{distMeters} m ({bearing})
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-600 flex items-center gap-1.5">
                            <Heart className="w-4 h-4 text-rose-500" /> Estimated Key Need:
                          </span>
                          <span className="font-extrabold text-rose-700">{estimatedNeed}</span>
                        </div>

                        <div className="pt-2 border-t border-gray-200 text-[11px] text-[#6B7280] italic flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-gray-400" />
                          <span>
                            Exact name, floor, and complete health records remain locked until you accept.
                          </span>
                        </div>
                      </div>

                      {/* Accept & Decline Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleAcceptTask(task)}
                          disabled={isUnlocking === task.id}
                          className="flex-1 px-4 py-2.5 rounded-2xl text-xs font-bold bg-[#0B1B3A] hover:bg-[#1a2d52] text-white shadow transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Unlock className="w-4 h-4 text-[#F26A1B]" />
                          <span>{isUnlocking === task.id ? 'Unlocking Briefing...' : 'Accept & Unlock Briefing'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeclineTask(task)}
                          className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-white border border-[#F1D5BF] hover:bg-gray-100 text-[#0B1B3A] transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Full Unlocked Briefing (AFTER ACCEPTANCE) */}
                  {isAccepted && (
                    <div className="space-y-4 animate-fadeIn">
                      {/* 1. Household Exact Details */}
                      <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-4 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="font-extrabold text-sm text-[#0B1B3A]">
                            {primaryHousehold?.name || 'Resident Name'}
                          </div>
                          {primaryHousehold?.contactPhone && (
                            <a
                              href={`tel:${primaryHousehold.contactPhone}`}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[#0F7A5F] text-white shadow-sm hover:bg-[#0c624c] transition-colors"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>Call {primaryHousehold.contactPhone}</span>
                            </a>
                          )}
                        </div>

                        <div className="text-xs text-[#0B1B3A] space-y-1">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#F26A1B] shrink-0" />
                            <span>
                              <strong>Address:</strong> {primaryHousehold?.address}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#6B7280] ml-5">
                            Floor: <strong>{primaryHousehold?.floor ?? 0}</strong> • Family Size: <strong>{primaryHousehold?.householdSize ?? 1}</strong>
                          </div>
                        </div>

                        {/* Medical Briefing Section */}
                        {unlockedData?.healthProfile && (
                          <div className="mt-2.5 pt-2.5 border-t border-[#F1D5BF] space-y-1.5">
                            <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                              <Heart className="w-3.5 h-3.5 fill-rose-600 text-rose-600" />
                              <span>Unlocked Medical Profile:</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                              {unlockedData.healthProfile.conditions?.map((cond: string) => (
                                <span
                                  key={cond}
                                  className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2 py-0.5 rounded uppercase"
                                >
                                  {cond}
                                </span>
                              ))}
                            </div>

                            {unlockedData.healthProfile.allergies && unlockedData.healthProfile.allergies.length > 0 && (
                              <div className="text-[11px] text-[#4B5563]">
                                <strong>Allergies:</strong> {unlockedData.healthProfile.allergies.join(', ')}
                              </div>
                            )}

                            {unlockedData.healthProfile.medications && (
                              <div className="text-[11px] text-[#4B5563]">
                                <strong>Medications:</strong> {unlockedData.healthProfile.medications}
                              </div>
                            )}

                            {unlockedData.healthProfile.notes && (
                              <div className="text-[11px] text-[#4B5563]">
                                <strong>Care Notes:</strong> {unlockedData.healthProfile.notes}
                              </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-rose-200 text-[10px] text-rose-800 italic flex flex-wrap items-center justify-between gap-1">
                              <span>Self-reported by the resident. Not medical advice.</span>
                              <span className="font-semibold text-gray-500 not-italic">Revokes upon resolution (Max 6h)</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Navigation & Compass Guidance */}
                      <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2F6FDE]">
                            <Compass className="w-5 h-5 animate-spin-slow" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1.5">
                              <span>Field Navigation:</span>
                              <span className="text-[#2F6FDE] font-extrabold">~{distMeters} m ({bearing})</span>
                            </div>
                            <div className="text-[11px] text-[#6B7280]">
                              Coordinates: {primaryHousehold?.lat.toFixed(4)}, {primaryHousehold?.lng.toFixed(4)}
                            </div>
                          </div>
                        </div>

                        {primaryHousehold && (
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${primaryHousehold.lat},${primaryHousehold.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0B1B3A] text-white hover:bg-[#1a2d52] transition-colors shadow-sm"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#F26A1B]" />
                            <span>Open Navigation Map</span>
                          </a>
                        )}
                      </div>

                      {/* 3. Operational Field Checklist */}
                      <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-2.5">
                        <div className="text-xs font-bold text-[#0B1B3A] flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-[#0F7A5F]" />
                            Response Protocol Checklist:
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {(taskChecklists[task.id]?.size || 0)}/{defaultChecklistItems.length} completed
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {defaultChecklistItems.map((item, idx) => {
                            const isChecked = taskChecklists[task.id]?.has(idx);
                            return (
                              <div
                                key={idx}
                                onClick={() => handleToggleChecklist(task.id, idx)}
                                className="flex items-center gap-2 text-xs text-[#0B1B3A] cursor-pointer hover:bg-gray-100 p-1 rounded-lg transition-colors"
                              >
                                {isChecked ? (
                                  <CheckSquare className="w-4 h-4 text-[#0F7A5F] shrink-0" />
                                ) : (
                                  <Square className="w-4 h-4 text-gray-400 shrink-0" />
                                )}
                                <span className={isChecked ? 'line-through text-gray-500' : ''}>
                                  {item}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* 4. Action Buttons: Found Them Resolved / Need Backup */}
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setResolvingTaskId(task.id)}
                          className="flex-1 min-w-[140px] px-4 py-2.5 rounded-2xl text-xs font-bold bg-[#0F7A5F] hover:bg-[#0c624c] text-white shadow transition-all flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Found them: resolved</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBackupTaskId(task.id)}
                          className="px-4 py-2.5 rounded-2xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow transition-all flex items-center justify-center gap-1.5"
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-300" />
                          <span>Need backup</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Resolution Note Modal */}
                  {resolvingTaskId === task.id && (
                    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#F1D5BF] space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-[#0F7A5F]" />
                            <h3 className="text-base font-bold text-[#0B1B3A]">
                              Resolve Field Dispatch
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setResolvingTaskId(null)}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                          >
                            ✕
                          </button>
                        </div>

                        <p className="text-xs text-[#6B7280]">
                          Confirming resolution will mark the household as safe, reset their silence countdown, clear this task, and expire your medical briefing access.
                        </p>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#0B1B3A] block">
                            Field Notes & Status:
                          </label>
                          <textarea
                            rows={3}
                            value={resolutionNote}
                            onChange={(e) => setResolutionNote(e.target.value)}
                            placeholder="e.g. Resident found safe in 2nd floor room, delivered fresh drinking water and verified phone charged..."
                            className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => setResolvingTaskId(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleConfirmResolve(task)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#0F7A5F] hover:bg-[#0c624c] text-white shadow"
                          >
                            Confirm Resolution
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Need Backup Modal */}
                  {backupTaskId === task.id && (
                    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-red-300 space-y-4 animate-scaleUp">
                        <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <h3 className="text-base font-bold text-[#0B1B3A]">
                              Request Immediate Backup
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => setBackupTaskId(null)}
                            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
                          >
                            ✕
                          </button>
                        </div>

                        <p className="text-xs text-[#6B7280]">
                          This sends an urgent distress report to the coordinator dashboard with your current GPS coordinates.
                        </p>

                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-[#0B1B3A] block">
                            Backup Reason / Required Equipment:
                          </label>
                          <textarea
                            rows={3}
                            value={backupNote}
                            onChange={(e) => setBackupNote(e.target.value)}
                            placeholder="e.g. Water level rising above 3 feet, need rescue boat or advanced medical kit..."
                            className="w-full text-xs p-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                          <button
                            type="button"
                            onClick={() => setBackupTaskId(null)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSendBackupRequest(task)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white shadow flex items-center gap-1.5"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{backupSent === task.id ? 'Sent!' : 'Send Urgent Alert'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Air-Gapped Volunteer QR Sync Modal */}
      <QrSyncModal
        isOpen={isQrSyncOpen}
        onClose={() => setIsQrSyncOpen(false)}
        title="Volunteer Air-Gapped QR Sync"
        subtitle="Scan assignments from coordinator or share completed dispatches"
        dataToShare={{
          type: 'volunteer-results-sync',
          volunteerId: currentVolunteer?.id,
          volunteerName: currentVolunteer?.name,
          resolvedTasks: tasks
            .filter((t) => t.volunteerId === currentVolunteer?.id && t.status === 'resolved')
            .map((t) => t.id),
          timestamp: new Date().toISOString(),
        }}
        onSnapshotMerged={(data) => {
          onMergeQrSnapshot?.(data);
        }}
        defaultMode="scan"
      />
    </div>
  );
}
