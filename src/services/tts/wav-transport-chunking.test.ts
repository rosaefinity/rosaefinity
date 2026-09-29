// =============================================
// WAV Transport Chunking Regression Test
// Verifies multi-chunk stdout accumulation
// for the Piper worker protocol:
//   [4-byte uint32 LE WAV length][WAV bytes]
// =============================================

import { describe, it, expect } from 'vitest';
import { Readable, PassThrough } from 'stream';
import { Buffer } from 'buffer';

/**
 * Simulate the accumulation logic from local-tts.cjs synthesize().
 * This extracts the core chunking protocol without Electron dependencies.
 */
function accumulateWorkerResponse(stdout: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let responseBuffer = Buffer.alloc(0);
    let wavLength = -1;

    const onData = (chunk: Buffer) => {
      responseBuffer = Buffer.concat([responseBuffer, chunk]);

      // Wait for the 4-byte uint32 LE length header
      if (responseBuffer.length < 4) return;

      // Parse WAV length once from header
      if (wavLength === -1) {
        wavLength = responseBuffer.readUInt32LE(0);

        // Check if this is an error response (JSON)
        if (wavLength < 1000 && wavLength > 2) {
          if (responseBuffer.length >= 4 + wavLength) {
            const jsonStr = responseBuffer.slice(4, 4 + wavLength).toString('utf-8');
            try {
              const errResp = JSON.parse(jsonStr);
              if (errResp.error) {
                stdout.removeListener('data', onData);
                reject(new Error(errResp.error));
                return;
              }
            } catch {
              // Not JSON — treat as WAV
            }
          }
        }
      }

      // Wait for complete payload
      const totalExpected = 4 + wavLength;
      if (responseBuffer.length < totalExpected) return;

      // Full response received
      stdout.removeListener('data', onData);
      const wavData = responseBuffer.slice(4, 4 + wavLength);
      resolve(Buffer.from(wavData));
    };

    stdout.on('data', onData);
  });
}

/** Build a fake WAV payload of the given size */
function fakeWavPayload(size: number): Buffer {
  // Minimal valid-ish WAV: RIFF header (44 bytes) + PCM data
  const buf = Buffer.alloc(size, 0x80); // fill with non-zero
  // RIFF magic
  buf.write('RIFF', 0);
  // WAVE fmt
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); // fmt chunk size
  buf.writeUInt16LE(1, 20);  // PCM format
  buf.writeUInt16LE(1, 22);  // channels
  buf.writeUInt32LE(22050, 24); // sample rate
  buf.writeUInt32LE(44100, 28); // byte rate
  buf.writeUInt16LE(2, 32);  // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write('data', 36);
  buf.writeUInt32LE(size - 44, 40); // data chunk size
  return buf;
}

/** Wrap payload with the 4-byte uint32 LE length prefix */
function wrapWithLengthPrefix(payload: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return Buffer.concat([header, payload]);
}

describe('WAV Transport Chunking (multi-chunk regression)', () => {
  it('should handle single-chunk delivery (small WAV)', async () => {
    const payload = fakeWavPayload(200);
    const fullResponse = wrapWithLengthPrefix(payload);

    // Deliver entire response in one chunk
    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);
    stream.push(fullResponse);
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });

  it('should handle two-chunk delivery (large WAV split at chunk boundary)', async () => {
    const payload = fakeWavPayload(120_000); // ~120 KB, exceeds 64 KB pipe buffer
    const fullResponse = wrapWithLengthPrefix(payload);

    // Split exactly at the 64 KB boundary
    const splitPoint = 65_536;
    const chunk1 = fullResponse.slice(0, splitPoint);
    const chunk2 = fullResponse.slice(splitPoint);

    expect(chunk1.length).toBe(splitPoint);
    expect(chunk2.length).toBe(fullResponse.length - splitPoint);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);

    // Deliver in two separate data events
    stream.push(chunk1);
    stream.push(chunk2);
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });

  it('should handle many small chunks (byte-at-a-time delivery)', async () => {
    const payload = fakeWavPayload(1000);
    const fullResponse = wrapWithLengthPrefix(payload);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);

    // Deliver one byte at a time
    for (let i = 0; i < fullResponse.length; i++) {
      stream.push(fullResponse.slice(i, i + 1));
    }
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });

  it('should handle header arriving in first chunk, payload in second', async () => {
    const payload = fakeWavPayload(80_000);
    const fullResponse = wrapWithLengthPrefix(payload);

    // Chunk 1: only the 4-byte header
    const chunk1 = fullResponse.slice(0, 4);
    // Chunk 2: the entire payload
    const chunk2 = fullResponse.slice(4);

    expect(chunk1.length).toBe(4);
    expect(chunk1.readUInt32LE(0)).toBe(payload.length);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);

    stream.push(chunk1);
    stream.push(chunk2);
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });

  it('should handle typical Piper output size (~110 KB for 2.5s audio)', async () => {
    // Simulate realistic Piper output: 22050 Hz * 1ch * 2 bytes * ~2.5s + 44 header
    const pcmSize = 22050 * 2 * 3; // 3 seconds
    const payload = fakeWavPayload(44 + pcmSize); // ~132 KB total
    const fullResponse = wrapWithLengthPrefix(payload);

    // Split into 3 chunks (realistic pipe behavior)
    const chunk1 = fullResponse.slice(0, 50_000);
    const chunk2 = fullResponse.slice(50_000, 100_000);
    const chunk3 = fullResponse.slice(100_000);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);

    stream.push(chunk1);
    stream.push(chunk2);
    stream.push(chunk3);
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });

  it('should reject on error response from worker', async () => {
    const errorMsg = JSON.stringify({ error: 'Model not found' });
    const errorPayload = Buffer.from(errorMsg, 'utf-8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(errorPayload.length, 0);
    const fullResponse = Buffer.concat([header, errorPayload]);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);
    stream.push(fullResponse);
    stream.push(null);

    await expect(promise).rejects.toThrow('Model not found');
  });

  it('should handle header arriving alone, then full payload', async () => {
    // Edge case: first data event is exactly 4 bytes (just the header)
    const payload = fakeWavPayload(200_000); // 200 KB
    const fullResponse = wrapWithLengthPrefix(payload);

    const stream = new PassThrough();
    const promise = accumulateWorkerResponse(stream);

    // First chunk: just header
    stream.push(fullResponse.slice(0, 4));
    // Second chunk: all payload bytes at once
    stream.push(fullResponse.slice(4));
    stream.push(null);

    const result = await promise;
    expect(result.length).toBe(payload.length);
    expect(result.equals(payload)).toBe(true);
  });
});
