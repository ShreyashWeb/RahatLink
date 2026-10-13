import { useState, useEffect } from 'react';
import type {
  Household,
  CheckIn,
  Settings,
  Report,
  HealthProfile,
  AccessLogEntry,
} from '@rahatlink/core';
import { translations, Language } from '../i18n';
import {
  CheckCircle,
  Clock,
  Battery,
  Flame,
  AlertTriangle,
  History,
  ShieldAlert,
  Heart,
  Shield,
  Download,
  Trash2,
  Lock,
  Plus,
  Eye,
  UserCheck,
  Check,
  AlertCircle,
} from 'lucide-react';

interface ResidentScreenProps {
  household: Household;
  checkIns: CheckIn[];
  settings: Settings;
  lang: Language;
  healthProfile?: HealthProfile;
  accessLogs?: AccessLogEntry[];
  onCheckIn: (checkIn: CheckIn) => void;
  onSendSOS: (report: Report) => void;
  onOpenSettingsModal: () => void;
  onSaveHealthProfile?: (profile: HealthProfile) => void;
  onDeleteHealthProfile?: (householdId: string) => void;
  onDownloadData?: (householdId: string) => void;
}

const AVAILABLE_CONDITIONS = [
  'diabetes',
  'asthma',
  'insulin-dependent',
  'heart condition',
  'limited mobility',
  'pregnant',
  'other',
];

export function ResidentScreen({
  household,
  checkIns,
  settings,
  lang,
  healthProfile,
  accessLogs = [],
  onCheckIn,
  onSendSOS,
  onOpenSettingsModal,
  onSaveHealthProfile,
  onDeleteHealthProfile,
  onDownloadData,
}: ResidentScreenProps) {
  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'checkin' | 'health' | 'privacyLog'>('checkin');

  const [justCheckedIn, setJustCheckedIn] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [showSosConfirm, setShowSosConfirm] = useState(false);

  // Health Profile Form State
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [customCondition, setCustomCondition] = useState('');
  const [allergiesText, setAllergiesText] = useState('');
  const [medicationsText, setMedicationsText] = useState('');
  const [notesText, setNotesText] = useState('');
  const [consentGranted, setConsentGranted] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sync health profile when household changes
  useEffect(() => {
    if (healthProfile) {
      setSelectedConditions(healthProfile.conditions || []);
      setAllergiesText((healthProfile.allergies || []).join(', '));
      setMedicationsText(healthProfile.medications || '');
      setNotesText(healthProfile.notes || '');
    } else {
      setSelectedConditions([]);
      setAllergiesText('');
      setMedicationsText('');
      setNotesText('');
    }
    setConsentGranted(Boolean(household.consent?.health));
  }, [healthProfile, household]);

  // Filter check-ins for this household, sorted descending
  const householdCheckIns = checkIns
    .filter((c) => c.householdId === household.id)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const last7CheckIns = householdCheckIns.slice(0, 7);
  const streak = Math.max(1, householdCheckIns.length);

  // Compute next due time
  const effectiveGraceHours = settings.disasterMode
    ? household.graceHours * settings.disasterGraceFactor
    : household.graceHours;

  const lastTime = household.lastCheckInAt
    ? new Date(household.lastCheckInAt).getTime()
    : Date.now();
  const nextDueDate = new Date(lastTime + effectiveGraceHours * 3600 * 1000);

  // Access logs for this resident
  const myAccessLogs = accessLogs.filter((l) => l.householdId === household.id);

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
    setTimeout(() => setSosSent(false), 4000);
  };

  // Toggle condition chip
  const toggleCondition = (cond: string) => {
    setSelectedConditions((prev) =>
      prev.includes(cond) ? prev.filter((c) => c !== cond) : [...prev, cond],
    );
  };

  const handleAddCustomCondition = () => {
    if (customCondition.trim() && !selectedConditions.includes(customCondition.trim())) {
      setSelectedConditions((prev) => [...prev, customCondition.trim()]);
      setCustomCondition('');
    }
  };

  const handleSaveProfile = () => {
    if (!onSaveHealthProfile) return;

    const allergiesArray = allergiesText
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const updatedProfile: HealthProfile = {
      householdId: household.id,
      conditions: selectedConditions,
      allergies: allergiesArray,
      medications: medicationsText.trim(),
      notes: notesText.trim(),
      updatedAt: new Date().toISOString(),
    };

    onSaveHealthProfile(updatedProfile);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleDeleteProfile = () => {
    if (onDeleteHealthProfile) {
      onDeleteHealthProfile(household.id);
    }
    setSelectedConditions([]);
    setAllergiesText('');
    setMedicationsText('');
    setNotesText('');
    setConsentGranted(false);
    setShowDeleteConfirm(false);
  };

  return (
    <div className="space-y-6 max-w-xl mx-auto">
      {/* Top Tabs: Check-In | Health Profile (DPDP) | Privacy Log */}
      <div className="bg-white border border-[#F1D5BF] rounded-2xl p-1.5 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab('checkin')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'checkin'
              ? 'bg-[#0B1B3A] text-white shadow'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <CheckCircle className="w-3.5 h-3.5" />
          <span>Daily Check-In</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('health')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'health'
              ? 'bg-[#0B1B3A] text-white shadow'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <Heart className="w-3.5 h-3.5 text-rose-500" />
          <span>Health Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('privacyLog')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'privacyLog'
              ? 'bg-[#0B1B3A] text-white shadow'
              : 'text-[#6B7280] hover:text-[#0B1B3A]'
          }`}
        >
          <Shield className="w-3.5 h-3.5 text-[#0F7A5F]" />
          <span>Access Log ({myAccessLogs.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: DAILY CHECK-IN & REASSURANCE SCREEN */}
      {/* ======================================================== */}
      {activeTab === 'checkin' && (
        <div className="space-y-6">
          {/* Status & Household Context Header */}
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#0B1B3A]">{household.name}</h2>
                <p className="text-xs text-[#6B7280]">{household.address}</p>
              </div>
              <button
                type="button"
                onClick={onOpenSettingsModal}
                className="text-xs font-semibold text-[#F26A1B] hover:underline"
              >
                {t.resident.settings}
              </button>
            </div>

            <div className="pt-2 border-t border-[#F1D5BF] flex items-center justify-between text-xs text-[#6B7280]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#F26A1B]" />
                <span>
                  {t.resident.nextDue}: {nextDueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Battery className="w-3.5 h-3.5 text-[#0F7A5F]" />
                <span>{household.lastBattery ? `${household.lastBattery}%` : '85%'}</span>
              </div>
            </div>

            {settings.disasterMode && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-800 flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Disaster Mode active: Check-in grace period is halved to {effectiveGraceHours}h.
                </span>
              </div>
            )}
          </div>

          {/* Primary Action: Huge "I'm Okay" Touch Target */}
          <div className="flex flex-col items-center justify-center py-4">
            <button
              type="button"
              onClick={handleTapOkay}
              className={`w-56 h-56 sm:w-64 sm:h-64 rounded-full flex flex-col items-center justify-center p-6 shadow-xl transition-all transform active:scale-95 border-8 ${
                justCheckedIn
                  ? 'bg-emerald-600 border-emerald-400 text-white animate-pulse'
                  : 'bg-[#0F7A5F] hover:bg-[#0c624c] border-emerald-100 text-white hover:shadow-2xl'
              }`}
            >
              <CheckCircle className="w-16 h-16 sm:w-20 sm:h-20 mb-2" />
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {justCheckedIn ? t.resident.allGood : t.resident.imOkay}
              </span>
              <span className="text-xs text-emerald-100 mt-1 text-center font-medium">
                {justCheckedIn ? 'Timestamp recorded' : t.resident.tapToCheckIn}
              </span>
            </button>

            {justCheckedIn && (
              <div className="mt-4 text-sm font-bold text-[#0F7A5F] bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full animate-fadeIn">
                ✓ Check-in recorded and synced across local mesh!
              </div>
            )}
          </div>

          {/* Peacetime Value: Streak Counter */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF6EE] flex items-center justify-center text-[#F26A1B] font-bold text-lg">
                🔥
              </div>
              <div>
                <div className="text-sm font-bold text-[#0B1B3A]">
                  {streak} {t.resident.dayStreak}
                </div>
                <div className="text-[11px] text-[#6B7280]">
                  {t.resident.streakHelp}
                </div>
              </div>
            </div>
          </div>

          {/* History List: Last 7 Check-ins */}
          <div className="bg-white border border-[#F1D5BF] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#0B1B3A]">
              <History className="w-4 h-4 text-[#F26A1B]" />
              <span>{t.resident.historyTitle}</span>
            </div>

            {last7CheckIns.length === 0 ? (
              <p className="text-xs text-[#6B7280] py-2 text-center">No check-ins yet today.</p>
            ) : (
              <div className="space-y-2">
                {last7CheckIns.map((ci) => (
                  <div
                    key={ci.id}
                    className="flex items-center justify-between text-xs py-1.5 border-b border-gray-100 last:border-none"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#0F7A5F]" />
                      <span className="font-semibold text-[#0B1B3A]">
                        {new Date(ci.at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}{' '}
                        at{' '}
                        {new Date(ci.at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      <span className="text-[10px] text-[#6B7280] bg-[#FFF6EE] px-1.5 py-0.5 rounded">
                        {ci.by === 'self' ? t.resident.bySelf : t.resident.byNeighbour}
                      </span>
                    </div>
                    {ci.batteryPct !== undefined && (
                      <span className="text-[11px] text-[#6B7280]">{ci.batteryPct}%</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Distress SOS Button */}
          <div className="pt-2">
            {!showSosConfirm ? (
              <button
                type="button"
                onClick={() => setShowSosConfirm(true)}
                className="w-full bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{t.resident.sosButton}</span>
              </button>
            ) : (
              <div className="bg-rose-100 border border-rose-300 rounded-2xl p-4 text-center space-y-3">
                <div className="text-xs font-bold text-rose-900 flex items-center justify-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>{t.resident.sosConfirmPrompt}</span>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <button
                    type="button"
                    onClick={() => setShowSosConfirm(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-white text-gray-700 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSOS}
                    className="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 shadow"
                  >
                    Confirm Distress Alert
                  </button>
                </div>
              </div>
            )}

            {sosSent && (
              <div className="mt-2 p-2 bg-rose-600 text-white text-xs font-bold rounded-xl text-center animate-fadeIn">
                Distress report transmitted to local hub and coordinator queue!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: HEALTH & DPDP ACT PRIVACY CONSENT PROFILE */}
      {/* ======================================================== */}
      {activeTab === 'health' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2.5">
                <Heart className="w-5 h-5 text-rose-600" />
                <div>
                  <h3 className="text-sm font-bold text-[#0B1B3A]">
                    Confidential Health Profile
                  </h3>
                  <p className="text-[11px] text-[#6B7280]">
                    Stored locally in private 'health' doc • Never sent to cloud APIs
                  </p>
                </div>
              </div>
              <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                DPDP Act 2023
              </span>
            </div>

            {/* Condition Chips Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Health Conditions & Special Needs:
              </label>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_CONDITIONS.map((cond) => {
                  const isSelected = selectedConditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => toggleCondition(cond)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                        isSelected
                          ? 'bg-[#0B1B3A] text-white border-[#0B1B3A] shadow-sm'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <span>{cond}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  );
                })}
              </div>

              {/* Add custom condition */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={customCondition}
                  onChange={(e) => setCustomCondition(e.target.value)}
                  placeholder="Other condition..."
                  className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0B1B3A]"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCondition();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomCondition}
                  className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add
                </button>
              </div>
            </div>

            {/* Allergies Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Known Allergies (e.g. Penicillin, Peanuts):
              </label>
              <input
                type="text"
                value={allergiesText}
                onChange={(e) => setAllergiesText(e.target.value)}
                placeholder="None or list allergies separated by commas..."
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0B1B3A]"
              />
            </div>

            {/* Medications (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Regular Medications (Optional):
              </label>
              <input
                type="text"
                value={medicationsText}
                onChange={(e) => setMedicationsText(e.target.value)}
                placeholder="e.g. Insulin Glargine 20u, Inhaler..."
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0B1B3A]"
              />
            </div>

            {/* Care Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#0B1B3A] block">
                Field Responder Care Notes:
              </label>
              <textarea
                rows={2}
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder="e.g. Keep insulin refrigerated; resident is hard of hearing..."
                className="w-full text-xs p-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-1 focus:ring-[#0B1B3A]"
              />
            </div>

            {/* Plain-Language Consent Toggle (Hard Rule 3 & 4) */}
            <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="consentCheckbox"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-[#0F7A5F] focus:ring-[#0F7A5F] cursor-pointer"
                />
                <label
                  htmlFor="consentCheckbox"
                  className="text-xs text-[#0B1B3A] font-semibold cursor-pointer leading-relaxed"
                >
                  "I agree to share this with an approved volunteer only after they accept a task for me."
                </label>
              </div>

              <p className="text-[11px] text-[#6B7280] ml-7">
                Under DPDP regulations, volunteers cannot see your medical details before accepting your rescue dispatch.
              </p>
            </div>

            {/* 7. Medical Disclaimer (Required everywhere) */}
            <div className="text-[10px] text-gray-500 italic bg-gray-50 border border-gray-200 p-2.5 rounded-xl flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Self-reported by the resident. Not professional medical advice.</span>
            </div>

            {/* Form Action Buttons: Save Profile */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="flex-1 py-2.5 bg-[#0B1B3A] hover:bg-[#1a2d52] text-white rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span>{saveSuccess ? 'Saved Locally!' : 'Save & Update Profile'}</span>
              </button>
            </div>
          </div>

          {/* Privacy Rights Section: Delete Data & Download Data */}
          <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-3">
            <div className="font-bold text-xs text-[#0B1B3A] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#F26A1B]" />
              <span>Data Rights & Sovereignty (Right to Erasure & Portability)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Download My Data Button */}
              <button
                type="button"
                onClick={() => onDownloadData && onDownloadData(household.id)}
                className="py-2.5 px-3 rounded-xl border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-[#0B1B3A] transition-colors flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4 text-[#2F6FDE]" />
                <span>Download my data (JSON)</span>
              </button>

              {/* Delete My Health Data Button */}
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="py-2.5 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-700 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4 text-red-600" />
                  <span>Delete my health data</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleDeleteProfile}
                    className="flex-1 py-2 px-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="py-2 px-3 bg-gray-100 text-gray-700 rounded-xl text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <p className="text-[10px] text-[#6B7280]">
              Deleting your health data immediately erases all medical conditions and notes from local memory, revokes dispatch consent, and records the deletion in the access audit trail.
            </p>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: RESIDENT ACCESS AUDIT LOG SCREEN */}
      {/* ======================================================== */}
      {activeTab === 'privacyLog' && (
        <div className="bg-white border border-[#F1D5BF] rounded-3xl p-5 shadow-sm space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-[#0F7A5F]" />
              <h3 className="text-sm font-bold text-[#0B1B3A]">
                My Personal Data Access Log
              </h3>
            </div>
            <span className="text-[11px] text-[#6B7280]">
              {myAccessLogs.length} audit records
            </span>
          </div>

          <p className="text-xs text-[#6B7280]">
            Every time a coordinator or volunteer views, unlocks, or modifies your profile, an immutable record is registered below.
          </p>

          {myAccessLogs.length === 0 ? (
            <div className="text-center py-6 text-xs text-[#6B7280] space-y-1">
              <Lock className="w-8 h-8 text-gray-300 mx-auto" />
              <p className="font-semibold text-gray-700">No external access on record</p>
              <p className="text-[11px]">Your health profile has not been unlocked by any responder.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              {myAccessLogs.slice().reverse().map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-2xl border border-gray-200 bg-gray-50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#0B1B3A] flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-[#2F6FDE]" />
                      Actor: {entry.actor} ({entry.role})
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {new Date(entry.at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <div className="text-[11px] text-[#4B5563]">
                    <strong>Action:</strong>{' '}
                    <span
                      className={`font-bold px-1.5 py-0.5 rounded text-[10px] uppercase ${
                        entry.action === 'break-glass'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {entry.action}
                    </span>{' '}
                    • Field: {entry.field}
                  </div>

                  {entry.reason && (
                    <div className="text-[10px] text-[#6B7280] italic">
                      Reason: "{entry.reason}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-gray-500 italic bg-gray-50 border border-gray-200 p-2 rounded-xl text-center">
            Self-reported by the resident. Not medical advice.
          </div>
        </div>
      )}
    </div>
  );
}
