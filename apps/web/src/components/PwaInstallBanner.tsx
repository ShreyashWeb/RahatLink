import { useState, useEffect } from 'react';
import { Download, WifiOff, X, CheckCircle2 } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check if already in standalone display mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setIsInstalled(true);
    }
    setInstallPrompt(null);
  };

  return (
    <>
      {/* Offline Ribbon when device is in Airplane Mode / disconnected */}
      {isOffline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-[#0B1B3A] text-amber-300 text-xs py-1.5 px-4 text-center font-bold flex items-center justify-center gap-2 border-b border-amber-500/30 shadow-inner"
        >
          <WifiOff className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span>Airplane Mode / Zero Connectivity Detected • Operating 100% Offline via Local IndexedDB &amp; PWA Cache</span>
        </div>
      )}

      {/* PWA Install Banner */}
      {installPrompt && !isDismissed && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-scaleUp">
          <div className="bg-[#0B1B3A] text-white p-4 rounded-3xl shadow-2xl border border-[#F26A1B]/40 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-[#F26A1B] text-white flex items-center justify-center shrink-0 shadow">
              <Download className="w-5 h-5" />
            </div>

            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  Install RahatLink App
                </h4>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  aria-label="Dismiss install prompt"
                  className="text-gray-400 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                Add to your phone’s home screen for instantaneous loading and guaranteed offline-first emergency access during blackouts.
              </p>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#F26A1B] text-white hover:bg-[#d95610] transition-colors shadow flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Install for Offline Use</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-gray-200 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
