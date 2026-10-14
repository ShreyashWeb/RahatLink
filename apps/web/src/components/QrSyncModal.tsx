import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  encodeSnapshotToQrChunks,
  QrChunkAssembler,
  QrAssemblyProgress,
} from '@rahatlink/core';
import {
  QrCode,
  Camera,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';

interface QrSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  // If sharing data:
  dataToShare?: any;
  // If scanning data:
  onSnapshotMerged?: (data: any) => void;
  defaultMode?: 'share' | 'scan';
}

export function QrSyncModal({
  isOpen,
  onClose,
  title,
  subtitle,
  dataToShare,
  onSnapshotMerged,
  defaultMode = 'share',
}: QrSyncModalProps) {
  const [mode, setMode] = useState<'share' | 'scan'>(defaultMode);

  // Sharing state
  const [chunks, setChunks] = useState<string[]>([]);
  const [qrImages, setQrImages] = useState<string[]>([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [copiedChunk, setCopiedChunk] = useState(false);

  // Scanning state
  const [assembler] = useState(() => new QrChunkAssembler());
  const [scanProgress, setScanProgress] = useState<QrAssemblyProgress | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualQrInput, setManualQrInput] = useState('');
  const [completedPayload, setCompletedPayload] = useState<any | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  // Encode data into QR chunks whenever dataToShare changes
  useEffect(() => {
    if (dataToShare) {
      const generatedChunks = encodeSnapshotToQrChunks(dataToShare, {
        maxChunkSize: 220,
      });
      setChunks(generatedChunks);
      setCurrentChunkIndex(0);

      // Render QR images for all chunks
      Promise.all(
        generatedChunks.map((chunk) =>
          QRCode.toDataURL(chunk, {
            errorCorrectionLevel: 'M',
            width: 260,
            margin: 2,
            color: {
              dark: '#0B1B3A',
              light: '#FFFFFF',
            },
          }),
        ),
      ).then((images) => {
        setQrImages(images);
      });
    }
  }, [dataToShare]);

  // Auto-cycle through QR frames for rapid scanner reading
  useEffect(() => {
    if (mode === 'share' && isAutoCycling && qrImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentChunkIndex((prev) => (prev + 1) % qrImages.length);
      }, 900);
      return () => clearInterval(interval);
    }
  }, [mode, isAutoCycling, qrImages.length]);

  // Camera scanner loop
  useEffect(() => {
    if (mode === 'scan' && isCameraActive) {
      let stream: MediaStream | null = null;

      navigator.mediaDevices
        ?.getUserMedia({ video: { facingMode: 'environment' } })
        .then((s) => {
          stream = s;
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            videoRef.current.play();
            scanLoop();
          }
        })
        .catch((err) => {
          console.warn('Camera access denied or unavailable:', err);
          setCameraError('Camera unavailable. You can paste QR codes manually below.');
          setIsCameraActive(false);
        });

      return () => {
        if (animFrameIdRef.current) {
          cancelAnimationFrame(animFrameIdRef.current);
        }
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
      };
    }
  }, [mode, isCameraActive]);

  const scanLoop = () => {
    if (
      videoRef.current &&
      videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA &&
      canvasRef.current
    ) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleProcessScannedText(code.data);
        }
      }
    }
    animFrameIdRef.current = requestAnimationFrame(scanLoop);
  };

  const handleProcessScannedText = (text: string) => {
    const res = assembler.ingestChunk(text);
    if (res.progress) {
      setScanProgress(res.progress);
    }
    if (res.completedData) {
      setCompletedPayload(res.completedData);
      if (onSnapshotMerged) {
        onSnapshotMerged(res.completedData);
      }
      setIsCameraActive(false);
    }
  };

  const handleManualIngest = () => {
    if (!manualQrInput.trim()) return;
    handleProcessScannedText(manualQrInput.trim());
    setManualQrInput('');
  };

  const handleCopyCurrentChunk = () => {
    if (chunks[currentChunkIndex]) {
      navigator.clipboard.writeText(chunks[currentChunkIndex]);
      setCopiedChunk(true);
      setTimeout(() => setCopiedChunk(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-[#F1D5BF] space-y-4 animate-scaleUp overflow-y-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#FFF6EE] border border-[#F1D5BF] text-[#F26A1B] flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B1B3A]">{title}</h3>
              <p className="text-[11px] text-[#6B7280]">{subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QR modal"
            className="text-gray-400 hover:text-gray-600 text-lg leading-none p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex bg-gray-100 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('share')}
            className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'share'
                ? 'bg-white text-[#0B1B3A] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>Show QR Codes ({chunks.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('scan')}
            className={`flex-1 py-1.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              mode === 'scan'
                ? 'bg-white text-[#0B1B3A] shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Scan QR Stream</span>
          </button>
        </div>

        {/* MODE 1: SHARE QR CHUNKS */}
        {mode === 'share' && (
          <div className="space-y-4 text-center">
            {qrImages.length > 0 ? (
              <div className="space-y-3">
                {/* QR Display Frame */}
                <div className="bg-white border-2 border-dashed border-[#F1D5BF] rounded-2xl p-4 inline-block shadow-inner">
                  <img
                    src={qrImages[currentChunkIndex]}
                    alt={`QR Frame ${currentChunkIndex + 1}`}
                    className="w-64 h-64 mx-auto object-contain"
                  />
                </div>

                {/* Multi-Part Controls */}
                <div className="flex items-center justify-between max-w-xs mx-auto">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentChunkIndex((prev) => (prev > 0 ? prev - 1 : qrImages.length - 1))
                    }
                    className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700"
                    title="Previous Frame"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <div className="text-xs font-bold text-[#0B1B3A] flex items-center gap-2">
                    <span>
                      Frame {currentChunkIndex + 1} of {qrImages.length}
                    </span>
                    {qrImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setIsAutoCycling(!isAutoCycling)}
                        className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                          isAutoCycling
                            ? 'bg-emerald-100 text-[#0F7A5F]'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                        title={isAutoCycling ? 'Pause Auto-cycle' : 'Auto-cycle Frames'}
                      >
                        {isAutoCycling ? (
                          <Pause className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        <span>{isAutoCycling ? '900ms' : 'Paused'}</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setCurrentChunkIndex((prev) => (prev + 1) % qrImages.length)
                    }
                    className="p-1.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-700"
                    title="Next Frame"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress Indicators */}
                {qrImages.length > 1 && (
                  <div className="flex justify-center gap-1">
                    {qrImages.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-1.5 rounded-full transition-all ${
                          idx === currentChunkIndex
                            ? 'w-6 bg-[#F26A1B]'
                            : 'w-2 bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCopyCurrentChunk}
                    className="text-[11px] font-semibold text-gray-600 hover:text-[#0B1B3A] inline-flex items-center gap-1 px-3 py-1 bg-gray-50 rounded-xl border border-gray-200"
                  >
                    {copiedChunk ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedChunk ? 'Copied frame code' : 'Copy Frame Code'}</span>
                  </button>
                </div>

                <p className="text-[10px] text-gray-500 max-w-sm mx-auto">
                  Hold camera still. Animated frames cycle automatically so multi-page dispatch records sync in seconds without network.
                </p>
              </div>
            ) : (
              <div className="py-12 text-xs text-gray-500">Preparing compressed snapshot...</div>
            )}
          </div>
        )}

        {/* MODE 2: SCAN QR STREAM */}
        {mode === 'scan' && (
          <div className="space-y-4">
            {completedPayload ? (
              /* Success Card */
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-2 animate-fadeIn">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-[#0F7A5F] flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-emerald-900">
                  QR Air-Gapped Sync Complete!
                </h4>
                <p className="text-xs text-emerald-800">
                  All stream chunks successfully assembled and merged into your local offline store.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCompletedPayload(null);
                      setScanProgress(null);
                      assembler.clearSession();
                    }}
                    className="px-3.5 py-1.5 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                  >
                    Scan Another Snapshot
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Progress bar if multi-part stream in progress */}
                {scanProgress && (
                  <div className="bg-[#FFF6EE] border border-[#F1D5BF] rounded-2xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold text-[#0B1B3A]">
                      <span>Assembling Multi-Part Snapshot</span>
                      <span className="text-[#F26A1B]">{scanProgress.progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#F26A1B] transition-all"
                        style={{ width: `${scanProgress.progressPercent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-gray-500 flex justify-between">
                      <span>
                        Received {scanProgress.receivedCount} of {scanProgress.total} chunks
                      </span>
                      {scanProgress.missingSeqs.length > 0 && (
                        <span>Missing frames: #{scanProgress.missingSeqs.join(', #')}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Camera Viewport or Start Button */}
                {isCameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video flex items-center justify-center">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute inset-0 border-2 border-emerald-400/70 pointer-events-none rounded-2xl m-6 animate-pulse" />
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(false)}
                      className="absolute top-2 right-2 bg-black/60 text-white px-2.5 py-1 rounded-xl text-xs font-bold"
                    >
                      Stop Camera
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        setIsCameraActive(true);
                      }}
                      className="px-4 py-2 bg-[#0B1B3A] text-white rounded-xl text-xs font-bold hover:bg-[#1a2d52] inline-flex items-center gap-1.5"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>Start Camera Scanner</span>
                    </button>
                    {cameraError && (
                      <p className="text-[11px] text-amber-700">{cameraError}</p>
                    )}
                  </div>
                )}

                {/* Manual Input Fallback */}
                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                  <label className="text-xs font-bold text-gray-700 block">
                    Paste Scanned QR Code Chunk:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualQrInput}
                      onChange={(e) => setManualQrInput(e.target.value)}
                      placeholder="e.g. RL:s123:1:2:eJzLSM3..."
                      className="flex-1 text-xs px-3 py-2 border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0B1B3A]"
                    />
                    <button
                      type="button"
                      onClick={handleManualIngest}
                      className="px-3.5 py-2 bg-[#F26A1B] text-white rounded-xl text-xs font-bold hover:bg-[#d9560f]"
                    >
                      Ingest
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
          <span className="text-[10px] text-gray-400">
            DEFLATE compressed • Zero internet required
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-xl"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
