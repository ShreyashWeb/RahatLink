import React, { useState } from 'react';
import type { Household } from '@rahatlink/core';
import { LocationPickerMap } from './LocationPickerMap';
import { translations, Language } from '../i18n';
import { Users, Shield, HeartHandshake, Check, Plus, Home } from 'lucide-react';

export type UserRole = 'resident' | 'neighbour' | 'volunteer' | 'coordinator';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  households: Household[];
  activeHouseholdId: string;
  onSelectHousehold: (id: string) => void;
  onRegisterHousehold: (household: Household) => void;
}

export function OnboardingModal({
  isOpen,
  onClose,
  lang,
  currentRole,
  onSelectRole,
  households,
  activeHouseholdId,
  onSelectHousehold,
  onRegisterHousehold,
}: OnboardingModalProps) {
  const t = translations[lang];
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New Household Form State
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [floor, setFloor] = useState('1');
  const [phone, setPhone] = useState('');
  const [householdSize, setHouseholdSize] = useState(2);
  const [graceHours, setGraceHours] = useState<number>(24);
  const [hasSmartphone, setHasSmartphone] = useState(true);
  const [proxyNeighbourId, setProxyNeighbourId] = useState<string>('');
  const [healthConsent, setHealthConsent] = useState(true);
  const [lat, setLat] = useState(26.8467);
  const [lng, setLng] = useState(80.9462);

  if (!isOpen) return null;

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !address) return;

    const newId = `h-${Date.now().toString().slice(-4)}`;
    const newHousehold: Household = {
      id: newId,
      name,
      address,
      floor: Number(floor) || 1,
      contactPhone: phone || '+91 98000 00000',
      householdSize: Number(householdSize) || 1,
      graceHours,
      hasSmartphone,
      proxyNeighbourId: proxyNeighbourId || undefined,
      lat,
      lng,
      consent: {
        health: healthConsent,
        grantedAt: healthConsent ? new Date().toISOString() : undefined,
      },
      status: 'ok',
      lastCheckInAt: new Date().toISOString(),
      lastBattery: 85,
    };

    onRegisterHousehold(newHousehold);
    onSelectHousehold(newId);
    setIsCreatingNew(false);
  };

  const roles = [
    {
      id: 'resident' as const,
      name: t.roles.resident,
      desc: lang === 'hi' ? 'दैनिक "मैं ठीक हूँ" चेक-इन और सुरक्षा' : 'Daily "I\'m okay" safety check-ins',
      icon: Home,
    },
    {
      id: 'neighbour' as const,
      name: t.roles.neighbour,
      desc: lang === 'hi' ? 'बिना स्मार्टफोन वाले पड़ोसियों के लिए चेक-इन' : 'Check in for neighbours without phones',
      icon: Users,
    },
    {
      id: 'coordinator' as const,
      name: t.roles.coordinator,
      desc: lang === 'hi' ? 'मानचित्र, क्लस्टर, अलर्ट और सेटिंग्स नियंत्रण' : 'Manage map, clusters, tasks & disaster mode',
      icon: Shield,
    },
    {
      id: 'volunteer' as const,
      name: t.roles.volunteer,
      desc: lang === 'hi' ? 'राहत कार्य और स्वीकृत सहायता दल' : 'Field responders & accepted dispatch tasks',
      icon: HeartHandshake,
    },
  ];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full border border-[#F1D5BF] shadow-2xl p-4 sm:p-6 max-h-[92vh] overflow-y-auto space-y-5 sm:space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div>
          <h2 className="text-xl font-bold text-[#0B1B3A]">{t.onboarding.welcome}</h2>
          <p className="text-xs text-[#6B7280] mt-1">{t.onboarding.selectRole}</p>
        </div>

        {/* Role Selector Grid */}
        <div className="grid grid-cols-2 gap-3">
          {roles.map((r) => {
            const Icon = r.icon;
            const isSelected = selectedRole === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRole(r.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#0B1B3A] bg-[#0B1B3A] text-white shadow-md'
                    : 'border-[#F1D5BF] bg-[#FFF6EE] text-[#1F2937] hover:border-[#0B1B3A]/30'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <Icon className={`w-5 h-5 ${isSelected ? 'text-[#F26A1B]' : 'text-[#0B1B3A]'}`} />
                  {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <div className="font-bold text-xs sm:text-sm">{r.name}</div>
                  <div className={`text-[10px] mt-0.5 line-clamp-2 ${isSelected ? 'text-gray-300' : 'text-[#6B7280]'}`}>
                    {r.desc}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Resident Household Selection / Registration */}
        {(selectedRole === 'resident' || selectedRole === 'neighbour') && (
          <div className="pt-3 border-t border-[#F1D5BF] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0B1B3A]">
                {selectedRole === 'resident' ? 'Your Household Profile' : 'Select Active Profile'}
              </span>
              <button
                type="button"
                onClick={() => setIsCreatingNew(!isCreatingNew)}
                className="text-xs font-bold text-[#F26A1B] hover:underline flex items-center gap-1"
              >
                {isCreatingNew ? (
                  'Choose Existing'
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" /> {t.onboarding.registerHousehold}
                  </>
                )}
              </button>
            </div>

            {!isCreatingNew ? (
              <div className="space-y-2">
                <label className="text-[11px] text-[#6B7280] font-medium">Select Household:</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {households.map((h) => {
                    const isSelected = activeHouseholdId === h.id;
                    return (
                      <div
                        key={h.id}
                        onClick={() => onSelectHousehold(h.id)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#FDE8D7] border-[#F26A1B] text-[#0B1B3A] font-bold'
                            : 'bg-[#FFF6EE] border-[#F1D5BF] hover:bg-[#FDE8D7]/40'
                        }`}
                      >
                        <div>
                          <div>{h.name}</div>
                          <div className="text-[10px] text-[#6B7280] font-normal">{h.address}</div>
                        </div>
                        {isSelected && <Check className="w-4 h-4 text-[#F26A1B]" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* New Household Registration Form */
              <form onSubmit={handleRegisterSubmit} className="space-y-3 bg-[#FFF6EE] p-4 rounded-2xl border border-[#F1D5BF]">
                <div className="text-xs font-bold text-[#0B1B3A] mb-1">
                  {t.onboarding.registerHousehold}
                </div>

                <div>
                  <label className="text-[11px] text-[#6B7280]">{t.onboarding.householdName} *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Ramesh Chandra (Elderly)"
                    className="w-full text-xs p-2.5 rounded-lg border border-[#F1D5BF] bg-white text-[#0B1B3A]"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-[#6B7280]">{t.onboarding.address} *</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. B-12, Sector 4, Gomti Nagar"
                    className="w-full text-xs p-2.5 rounded-lg border border-[#F1D5BF] bg-white text-[#0B1B3A]"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-[#6B7280]">{t.onboarding.floor}</label>
                    <input
                      type="text"
                      value={floor}
                      onChange={(e) => setFloor(e.target.value)}
                      placeholder="1"
                      className="w-full text-xs p-2 rounded-lg border border-[#F1D5BF] bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B7280]">{t.onboarding.phone}</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91..."
                      className="w-full text-xs p-2 rounded-lg border border-[#F1D5BF] bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B7280]">{t.onboarding.size}</label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={householdSize}
                      onChange={(e) => setHouseholdSize(Number(e.target.value))}
                      className="w-full text-xs p-2 rounded-lg border border-[#F1D5BF] bg-white"
                    />
                  </div>
                </div>

                {/* Grace Window Radio Options */}
                <div>
                  <label className="text-[11px] text-[#6B7280] block mb-1">{t.onboarding.graceSelect}</label>
                  <div className="flex gap-2">
                    {[12, 24, 48].map((hours) => (
                      <button
                        key={hours}
                        type="button"
                        onClick={() => setGraceHours(hours)}
                        className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                          graceHours === hours
                            ? 'bg-[#0B1B3A] text-white border-[#0B1B3A]'
                            : 'bg-white text-[#1F2937] border-[#F1D5BF]'
                        }`}
                      >
                        {hours}h
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smartphone Yes / No */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-[#1F2937]">{t.onboarding.hasPhone}</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHasSmartphone(true)}
                      className={`px-3 py-1 text-xs rounded-lg font-bold ${
                        hasSmartphone ? 'bg-[#0F7A5F] text-white' : 'bg-white border border-[#F1D5BF]'
                      }`}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasSmartphone(false)}
                      className={`px-3 py-1 text-xs rounded-lg font-bold ${
                        !hasSmartphone ? 'bg-[#D97706] text-white' : 'bg-white border border-[#F1D5BF]'
                      }`}
                    >
                      No (Proxy)
                    </button>
                  </div>
                </div>

                {/* Optional Neighbour Proxy */}
                <div>
                  <label className="text-[11px] text-[#6B7280]">Designate Neighbour Proxy (Optional):</label>
                  <select
                    value={proxyNeighbourId}
                    onChange={(e) => setProxyNeighbourId(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-[#F1D5BF] bg-white mt-1"
                  >
                    <option value="">None (Self-managed)</option>
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.address})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tap-on-Map coordinate picker */}
                <div>
                  <label className="text-[11px] text-[#6B7280] block mb-1">
                    {t.onboarding.location}
                  </label>
                  <LocationPickerMap
                    lat={lat}
                    lng={lng}
                    onChange={(newLat, newLng) => {
                      setLat(newLat);
                      setLng(newLng);
                    }}
                  />
                </div>

                {/* Health Consent Checkbox */}
                <div className="p-3 bg-white rounded-xl border border-[#F1D5BF] space-y-1">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={healthConsent}
                      onChange={(e) => setHealthConsent(e.target.checked)}
                      className="mt-0.5 rounded text-[#0F7A5F] focus:ring-[#0F7A5F]"
                    />
                    <span className="text-xs font-bold text-[#0B1B3A]">
                      {t.onboarding.healthConsent}
                    </span>
                  </label>
                  <p className="text-[10px] text-[#6B7280] pl-5">
                    {t.onboarding.healthConsentDesc}
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#0F7A5F] hover:bg-[#0c624c] text-white font-bold text-xs rounded-xl shadow transition-colors"
                >
                  {t.onboarding.submitRegister}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              onSelectRole(selectedRole);
              onClose();
            }}
            className="w-full py-3.5 bg-[#0B1B3A] hover:bg-[#12264D] text-white font-bold text-sm rounded-2xl shadow transition-colors flex items-center justify-center gap-2"
          >
            Confirm & Enter App
          </button>
        </div>
      </div>
    </div>
  );
}
