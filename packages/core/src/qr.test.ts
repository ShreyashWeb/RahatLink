import { describe, it, expect } from 'vitest';
import {
  encodeSnapshotToQrChunks,
  parseQrChunk,
  QrChunkAssembler,
} from './qr';

describe('QR Snapshot Chunking & DEFLATE Round-Trip (qr.ts)', () => {
  it('1. encodes small payload into a single valid QR chunk', () => {
    const sample = {
      type: 'test-sync',
      message: 'Hello RahatLink',
      timestamp: Date.now(),
    };

    const chunks = encodeSnapshotToQrChunks(sample, { maxChunkSize: 500 });
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toMatch(/^RL:\w+:1:1:/);

    const header = parseQrChunk(chunks[0]);
    expect(header).not.toBeNull();
    expect(header?.seq).toBe(1);
    expect(header?.total).toBe(1);
  });

  it('2. splits large snapshot payload across multiple chunks and reconstructs in sequential order', () => {
    // Generate realistic dispatch snapshot with tasks and households
    const realisticData = {
      snapshotAt: new Date().toISOString(),
      tasks: Array.from({ length: 8 }, (_, i) => ({
        id: `task-${i + 1}`,
        householdIds: [`h-${100 + i}`, `h-${200 + i}`],
        score: 65 + i * 4,
        riskTier: i % 2 === 0 ? 'HIGH' : 'MEDIUM',
        status: 'approved',
        elapsedSilenceHours: 26 + i,
        effectiveGraceHours: 24,
      })),
      flaggedHouseholds: Array.from({ length: 10 }, (_, i) => ({
        id: `h-${100 + i}`,
        name: `Household ${i + 1} Gomti Nagar`,
        lat: 26.846 + i * 0.001,
        lng: 80.946 + i * 0.001,
        address: `House ${i * 4 + 2}, Sector 5`,
        floor: i % 3,
        status: 'flagged',
      })),
    };

    // Use a small chunk size to force multi-chunk splitting (e.g. 150 bytes per QR)
    const chunks = encodeSnapshotToQrChunks(realisticData, { maxChunkSize: 150 });
    expect(chunks.length).toBeGreaterThan(3);

    const assembler = new QrChunkAssembler();
    let finalDecoded: any = null;

    for (const chunk of chunks) {
      const res = assembler.ingestChunk(chunk);
      if (res.completedData) {
        finalDecoded = res.completedData;
      }
    }

    expect(finalDecoded).not.toBeNull();
    expect(finalDecoded.tasks.length).toBe(8);
    expect(finalDecoded.flaggedHouseholds.length).toBe(10);
    expect(finalDecoded).toEqual(realisticData);
  });

  it('3. reconstructs multi-chunk streams when chunks are scanned out of order', () => {
    const data = {
      note: 'Volunteer offline sync results',
      resolvedTasks: ['task-1', 'task-2', 'task-5'],
      seenSafeHouseholds: ['h-101', 'h-103'],
      timestamp: '2026-10-13T20:00:00.000Z',
    };

    const chunks = encodeSnapshotToQrChunks(data, { maxChunkSize: 40 });
    expect(chunks.length).toBeGreaterThan(2);

    // Shuffle chunks into random order
    const shuffled = [...chunks].sort(() => Math.random() - 0.5);

    const assembler = new QrChunkAssembler();
    let finalData: any = null;

    for (const chunk of shuffled) {
      const res = assembler.ingestChunk(chunk);
      if (res.completedData) {
        finalData = res.completedData;
      }
    }

    expect(finalData).not.toBeNull();
    expect(finalData).toEqual(data);
  });

  it('4. rejects malformed or non-RahatLink QR text', () => {
    const assembler = new QrChunkAssembler();

    const result1 = assembler.ingestChunk('https://example.com/not-a-chunk');
    expect(result1.header).toBeNull();
    expect(result1.completedData).toBeNull();

    const result2 = assembler.ingestChunk('RL:invalid:nan:abc');
    expect(result2.header).toBeNull();
  });
});
