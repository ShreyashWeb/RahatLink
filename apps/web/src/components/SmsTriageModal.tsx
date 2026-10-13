import { useState } from 'react';
import type { Report, Household } from '@rahatlink/core';
import {
  MessageSquare,
  Users,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Send,
  PlusCircle,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface SmsTriageModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
  households: Household[];
  onUpdateReport: (report: Report) => void;
  onCreateTaskFromReport: (report: Report, householdId: string) => void;
  onSendSms: (from: string, text: string) => Promise<any>;
}

export function SmsTriageModal({
  isOpen,
  onClose,
  reports,
  households,
  onUpdateReport,
  onCreateTaskFromReport,
  onSendSms,
}: SmsTriageModalProps) {
  const [activeTab, setActiveTab] = useState<'triage' | 'test'>('triage');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Linking modal state
  const [linkingReportId, setLinkingReportId] = useState<string | null>(null);
  const [selectedHouseholdToLink, setSelectedHouseholdToLink] = useState<string>('');

  // Test SMS Gateway state
  const [testPhone, setTestPhone] = useState('+91 98765 43210');
  const [testText, setTestText] = useState('sector 5 me 3 log phans gaye, ek diabetic hai, jaldi');
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  if (!isOpen) return null;

  const handleLinkHousehold = (report: Report, targetHouseholdId: string) => {
    const targetH = households.find((h) => h.id === targetHouseholdId);
    if (!targetH) return;

    onUpdateReport({
      ...report,
      status: 'linked',
      lat: targetH.lat,
      lng: targetH.lng,
      parsed: {
        ...report.parsed,
        matchedHouseholdId: targetH.id,
      },
    });

    setLinkingReportId(null);
    setSelectedHouseholdToLink('');
  };

  const handleIgnoreReport = (report: Report) => {
    onUpdateReport({
      ...report,
      status: 'ignored',
    });
  };

  const handleSendTestSms = async () => {
    if (!testText.trim()) return;
    setIsSendingSms(true);
    setTestResult(null);
    try {
      const res = await onSendSms(testPhone.trim(), testText.trim());
      setTestResult(res);
    } catch (err: any) {
      console.error('Failed to send test SMS:', err);
    } finally {
      setIsSendingSms(false);
    }
  };

  const sampleMessages = [
    'sector 5 me 3 log phans gaye, ek diabetic hai, jaldi',
    'bachao bachao paani chhat tak aa gaya 4 log fas gaye',
    'elderly uncle ko insuln dawa chahiye turant sharma residence',
    'peene ka pani aur khana chahiye bacchon ke liye 5 log riverbank bridge',
  ];

  const filteredReports = reports.filter((r) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'PENDING') return r.status === 'pending' || !r.status;
    if (filterStatus === 'LINKED') return r.status === 'linked';
    if (filterStatus === 'IGNORED') return r.status === 'ignored';
    return true;
  });

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl border border-[#F1D5BF] animate-scaleUp overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1B3A] flex items-center gap-2">
                <span>SMS & Incident Triage</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 uppercase tracking-wider">
                  Hinglish NLP
                </span>
              </h3>
              <p className="text-xs text-[#6B7280]">
                Extract distress signals from messy SMS messages and link them to silent households.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#F1D5BF] bg-[#FFF6EE] px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('triage')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-t border-x ${
              activeTab === 'triage'
                ? 'bg-white text-[#0B1B3A] border-[#F1D5BF] border-b-white'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
            }`}
          >
            <span>Triage Stream ({reports.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all border-t border-x flex items-center gap-1.5 ${
              activeTab === 'test'
                ? 'bg-white text-[#0B1B3A] border-[#F1D5BF] border-b-white'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#F26A1B]" />
            <span>Simulate SMS Gateway (Judging Demo)</span>
          </button>
        </div>

        {/* TAB 1: TRIAGE STREAM */}
        {activeTab === 'triage' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <div className="px-6 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5">
                {(['ALL', 'PENDING', 'LINKED', 'IGNORED'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setFilterStatus(st)}
                    className={`px-2.5 py-1 rounded-xl font-bold transition-colors ${
                      filterStatus === st
                        ? 'bg-[#0B1B3A] text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {st === 'ALL'
                      ? 'All'
                      : st === 'PENDING'
                      ? 'Unlinked'
                      : st === 'LINKED'
                      ? 'Linked'
                      : 'Ignored'}
                  </button>
                ))}
              </div>
              <span className="text-[11px] text-gray-500 font-semibold">
                {filteredReports.length} reports
              </span>
            </div>

            {/* Reports List */}
            <div className="p-6 overflow-y-auto space-y-3.5 flex-1">
              {filteredReports.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No reports matching this filter. Send an SMS report to see it parsed here.
                </div>
              ) : (
                filteredReports.map((report) => {
                  const matchedH = households.find(
                    (h) => h.id === report.parsed?.matchedHouseholdId,
                  );
                  const isIgnored = report.status === 'ignored';
                  const isLinked = report.status === 'linked' || Boolean(report.parsed?.matchedHouseholdId);

                  return (
                    <div
                      key={report.id}
                      className={`p-4 rounded-2xl border transition-all space-y-3 ${
                        isIgnored
                          ? 'bg-gray-50/60 border-gray-200 opacity-60'
                          : isLinked
                          ? 'bg-white border-blue-200 shadow-sm'
                          : 'bg-amber-50/50 border-amber-200 shadow-sm'
                      }`}
                    >
                      {/* Top Row: Source, From, Timestamp */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#0B1B3A]">
                            {report.from || 'Unknown Sender'}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              report.source === 'sms'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {report.source.toUpperCase()}
                          </span>
                          {report.parsed?.urgency && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                report.parsed.urgency === 'HIGH'
                                  ? 'bg-red-100 text-red-800 border border-red-300'
                                  : report.parsed.urgency === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                  : 'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {report.parsed.urgency} URGENCY
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(report.at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* Raw SMS Text */}
                      <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-xs text-[#0B1B3A] italic font-medium">
                        "{report.text}"
                      </div>

                      {/* Parsed Heuristics Breakdown */}
                      {report.parsed && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                          {/* Needs */}
                          <div className="bg-white p-2 rounded-xl border border-gray-100 space-y-1">
                            <span className="text-gray-500 font-semibold block text-[10px]">
                              Extracted Needs:
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {report.parsed.needs?.map((need) => (
                                <span
                                  key={need}
                                  className="bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded text-[10px] uppercase"
                                >
                                  {need}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* People Count */}
                          <div className="bg-white p-2 rounded-xl border border-gray-100 space-y-1">
                            <span className="text-gray-500 font-semibold block text-[10px]">
                              Estimated People:
                            </span>
                            <span className="font-extrabold text-[#0B1B3A] text-xs flex items-center gap-1">
                              <Users className="w-3 h-3 text-[#F26A1B]" />
                              {report.parsed.peopleCount ?? 1} person(s)
                            </span>
                          </div>

                          {/* Location Clue */}
                          <div className="bg-white p-2 rounded-xl border border-gray-100 space-y-1">
                            <span className="text-gray-500 font-semibold block text-[10px]">
                              Location Hint:
                            </span>
                            <span className="font-semibold text-gray-800 text-[11px] truncate block">
                              {report.parsed.locationHint || 'Not specified'}
                            </span>
                          </div>

                          {/* Confidence */}
                          <div className="bg-white p-2 rounded-xl border border-gray-100 space-y-1">
                            <span className="text-gray-500 font-semibold block text-[10px]">
                              Parser Confidence:
                            </span>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full"
                                  style={{
                                    width: `${Math.round(
                                      (report.parsed.confidence ?? 0.5) * 100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <span className="font-bold text-[#0B1B3A] text-[10px]">
                                {Math.round((report.parsed.confidence ?? 0.5) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Household Link & Action Bar */}
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          {matchedH ? (
                            <span className="text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Linked: {matchedH.name}</span>
                            </span>
                          ) : (
                            <span className="text-amber-800 font-semibold flex items-center gap-1 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg text-[11px]">
                              <HelpCircle className="w-3 h-3 text-amber-600" />
                              <span>Unlinked incident report</span>
                            </span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5">
                          {/* Link Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setLinkingReportId(report.id);
                              setSelectedHouseholdToLink(
                                report.parsed?.matchedHouseholdId || households[0]?.id || '',
                              );
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white border border-[#F1D5BF] hover:bg-gray-50 text-[#0B1B3A] flex items-center gap-1 transition-colors"
                          >
                            <LinkIcon className="w-3 h-3 text-[#2F6FDE]" />
                            <span>{matchedH ? 'Re-link' : 'Link Household'}</span>
                          </button>

                          {/* Create Task Button */}
                          <button
                            type="button"
                            onClick={() => {
                              const targetId =
                                report.parsed?.matchedHouseholdId || households[0]?.id;
                              if (targetId) {
                                onCreateTaskFromReport(report, targetId);
                              }
                            }}
                            className="px-2.5 py-1 rounded-xl text-xs font-bold bg-[#0B1B3A] text-white hover:bg-[#1a2d52] flex items-center gap-1 transition-colors"
                          >
                            <PlusCircle className="w-3 h-3 text-[#F26A1B]" />
                            <span>Create Dispatch Task</span>
                          </button>

                          {/* Ignore Button */}
                          {!isIgnored && (
                            <button
                              type="button"
                              onClick={() => handleIgnoreReport(report)}
                              className="p-1 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Ignore / Dismiss Report"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Link Household Inline Picker */}
                      {linkingReportId === report.id && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl space-y-2 animate-fadeIn">
                          <label className="text-xs font-bold text-blue-900 block">
                            Select Household to Link with this Report:
                          </label>
                          <div className="flex gap-2">
                            <select
                              value={selectedHouseholdToLink}
                              onChange={(e) => setSelectedHouseholdToLink(e.target.value)}
                              className="flex-1 text-xs p-2 rounded-lg border border-blue-300 bg-white"
                            >
                              {households.map((h) => (
                                <option key={h.id} value={h.id}>
                                  {h.name} ({h.address})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleLinkHousehold(report, selectedHouseholdToLink)}
                              className="px-3 py-1 bg-blue-700 text-white rounded-lg text-xs font-bold"
                            >
                              Confirm Link
                            </button>
                            <button
                              type="button"
                              onClick={() => setLinkingReportId(null)}
                              className="px-2 py-1 text-gray-500 text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SIMULATE SMS GATEWAY TESTER */}
        {activeTab === 'test' && (
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-[#0B1B3A] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#F26A1B]" />
                <span>Simulated SMS Gateway (Local HTTP POST /sms)</span>
              </h4>
              <p className="text-[11px] text-[#6B7280]">
                Test the rule-based Hinglish + English NLP parser. The hub ingests the SMS, computes confidence, extracts needs & count, and matches the household to boost its risk score.
              </p>
            </div>

            {/* Quick Sample Message Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 block">
                Quick Sample Messy Messages (Click to Load):
              </label>
              <div className="space-y-1.5">
                {sampleMessages.map((msg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setTestText(msg)}
                    className="w-full text-left p-2 rounded-xl text-xs bg-gray-50 border border-gray-200 hover:bg-[#FFF6EE] hover:border-[#F1D5BF] transition-colors text-[#0B1B3A] italic font-medium"
                  >
                    "{msg}"
                  </button>
                ))}
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">
                  Sender Phone Number:
                </label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-xl"
                  placeholder="+91 98765 43210"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700 block">
                  SMS Message Body:
                </label>
                <textarea
                  rows={3}
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-xl"
                  placeholder="Enter messy SMS text in Hinglish or English..."
                />
              </div>

              <button
                type="button"
                onClick={handleSendTestSms}
                disabled={isSendingSms || !testText.trim()}
                className="w-full py-2.5 bg-[#0B1B3A] hover:bg-[#1a2d52] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5 text-[#F26A1B]" />
                <span>{isSendingSms ? 'Simulating Ingestion...' : 'Simulate SMS Ingestion (POST /sms)'}</span>
              </button>
            </div>

            {/* Result display */}
            {testResult && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 animate-fadeIn text-xs">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Report Ingested & Parsed Successfully</span>
                </div>
                <div className="text-[11px] text-emerald-800 space-y-1">
                  <div>
                    <strong>Urgency:</strong> {testResult.urgency} | <strong>Needs:</strong>{' '}
                    {testResult.needs?.join(', ')}
                  </div>
                  <div>
                    <strong>People Count:</strong> {testResult.peopleCount} |{' '}
                    <strong>Confidence:</strong>{' '}
                    {Math.round((testResult.confidence ?? 0.5) * 100)}%
                  </div>
                  {testResult.matchedHouseholdId && (
                    <div className="font-bold text-[#0B1B3A]">
                      ✓ Matched to Household: {testResult.matchedHouseholdId} (Risk Score BUMPED!)
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Zero cloud APIs • Local heuristic NLP</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold bg-[#0B1B3A] text-white hover:bg-[#1a2d52] rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
