import { deflate, inflate } from 'pako';

export interface QrChunkHeader {
  protocol: 'RL'; // RahatLink
  sessionId: string;
  seq: number; // 1-indexed
  total: number;
  payload: string; // Base64 slice
}

export interface QrAssemblyProgress {
  sessionId: string;
  total: number;
  receivedCount: number;
  missingSeqs: number[];
  isComplete: boolean;
  progressPercent: number;
}

const DEFAULT_MAX_CHUNK_SIZE = 280; // Optimal for rapid, high-density phone camera QR scanning

/**
 * Encodes an arbitrary JavaScript object or Yjs state into a sequence of compressed,
 * base64-encoded, sequence-numbered QR chunks.
 */
export function encodeSnapshotToQrChunks(
  data: any,
  options: {
    sessionId?: string;
    maxChunkSize?: number;
  } = {},
): string[] {
  const {
    sessionId = `s${Date.now().toString(36).slice(-4)}`,
    maxChunkSize = DEFAULT_MAX_CHUNK_SIZE,
  } = options;

  const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
  const utf8Bytes = new TextEncoder().encode(jsonString);

  // Compress using DEFLATE
  const compressed = deflate(utf8Bytes);

  // Convert binary Uint8Array to base64
  let binary = '';
  const len = compressed.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(compressed[i]);
  }
  const base64 = btoa(binary);

  // Split into chunks
  const totalChunks = Math.max(1, Math.ceil(base64.length / maxChunkSize));
  const chunks: string[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const seq = i + 1;
    const start = i * maxChunkSize;
    const end = Math.min(base64.length, start + maxChunkSize);
    const slice = base64.slice(start, end);

    // Frame header: RL:<sessionId>:<seq>:<total>:<base64-slice>
    chunks.push(`RL:${sessionId}:${seq}:${totalChunks}:${slice}`);
  }

  return chunks;
}

/**
 * Parses a scanned QR string into its header components.
 * Returns null if the string is not a RahatLink QR chunk.
 */
export function parseQrChunk(rawText: string): QrChunkHeader | null {
  if (!rawText || !rawText.startsWith('RL:')) return null;

  const parts = rawText.split(':');
  if (parts.length < 5) return null;

  const [, sessionId, seqStr, totalStr, ...rest] = parts;
  const seq = parseInt(seqStr, 10);
  const total = parseInt(totalStr, 10);
  const payload = rest.join(':'); // Handle any colons in base64 if present

  if (isNaN(seq) || isNaN(total) || seq < 1 || seq > total) {
    return null;
  }

  return {
    protocol: 'RL',
    sessionId,
    seq,
    total,
    payload,
  };
}

/**
 * Helper class to assemble multi-part QR streams scanned in any order
 */
export class QrChunkAssembler {
  private chunksBySession = new Map<string, Map<number, string>>();
  private totalBySession = new Map<string, number>();

  /**
   * Ingests a scanned chunk string.
   * Returns assembly progress and decoded data if complete.
   */
  public ingestChunk(rawText: string): {
    header: QrChunkHeader | null;
    progress: QrAssemblyProgress | null;
    completedData: any | null;
  } {
    const header = parseQrChunk(rawText);
    if (!header) {
      return { header: null, progress: null, completedData: null };
    }

    const { sessionId, seq, total, payload } = header;

    if (!this.chunksBySession.has(sessionId)) {
      this.chunksBySession.set(sessionId, new Map());
      this.totalBySession.set(sessionId, total);
    }

    const sessionMap = this.chunksBySession.get(sessionId)!;
    sessionMap.set(seq, payload);

    const receivedCount = sessionMap.size;
    const missingSeqs: number[] = [];
    for (let i = 1; i <= total; i++) {
      if (!sessionMap.has(i)) {
        missingSeqs.push(i);
      }
    }

    const isComplete = receivedCount === total;
    const progress: QrAssemblyProgress = {
      sessionId,
      total,
      receivedCount,
      missingSeqs,
      isComplete,
      progressPercent: Math.round((receivedCount / total) * 100),
    };

    let completedData: any = null;
    if (isComplete) {
      try {
        completedData = this.decodeSession(sessionId);
      } catch (err) {
        console.error('Failed to decode completed QR session:', err);
      }
    }

    return { header, progress, completedData };
  }

  /**
   * Reassembles and decompresses all chunks for a completed session
   */
  public decodeSession(sessionId: string): any {
    const sessionMap = this.chunksBySession.get(sessionId);
    const total = this.totalBySession.get(sessionId);
    if (!sessionMap || !total || sessionMap.size !== total) {
      throw new Error(`Incomplete QR session: ${sessionId}`);
    }

    // Assemble in sequence order 1..total
    let fullBase64 = '';
    for (let i = 1; i <= total; i++) {
      const slice = sessionMap.get(i);
      if (!slice) {
        throw new Error(`Missing chunk #${i} for session ${sessionId}`);
      }
      fullBase64 += slice;
    }

    // Decode base64 to binary string
    const binary = atob(fullBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Decompress via DEFLATE (INFLATE)
    const decompressed = inflate(bytes);
    const jsonString = new TextDecoder().decode(decompressed);

    return JSON.parse(jsonString);
  }

  /**
   * Clears in-memory session buffers
   */
  public clearSession(sessionId?: string) {
    if (sessionId) {
      this.chunksBySession.delete(sessionId);
      this.totalBySession.delete(sessionId);
    } else {
      this.chunksBySession.clear();
      this.totalBySession.clear();
    }
  }
}
