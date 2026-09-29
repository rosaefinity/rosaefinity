#!/usr/bin/env python3
"""
RosaeFinity Piper TTS Worker

Persistent process that accepts synthesis requests via stdin (JSON)
and returns WAV audio via stdout (length-prefixed binary).

Protocol:
  stdin:  newline-delimited JSON requests
  stdout: 4 bytes uint32 LE WAV length + N bytes WAV data
  stderr: diagnostic logs (never mixed with stdout)

Request format:
  {"model": "/path/to/model.onnx", "text": "hello", "rate": 1.0, "pitch": 1.0}

Response on success:
  [4 bytes WAV length][WAV data]

Response on error (JSON to stdout instead of WAV):
  {"error": "description"}

Exit: receives {"exit": true} on stdin or EOF.
"""

import sys
import json
import struct
import io
import os
import traceback

# Ensure stdout is binary
if hasattr(sys.stdout, 'buffer'):
    _stdout = sys.stdout.buffer
else:
    _stdout = sys.stdout

def log(msg):
    """Write diagnostic info to stderr (never stdout)."""
    sys.stderr.write(f"[PIPER-WORKER] {msg}\n")
    sys.stderr.flush()

def send_error(msg):
    """Send a JSON error response via stdout."""
    resp = json.dumps({"error": msg})
    data = resp.encode('utf-8')
    _stdout.write(struct.pack('<I', len(data)))
    _stdout.write(data)
    _stdout.flush()

def send_wav(wav_bytes):
    """Send WAV audio via stdout with length prefix."""
    _stdout.write(struct.pack('<I', len(wav_bytes)))
    _stdout.write(wav_bytes)
    _stdout.flush()

def load_model(model_path):
    """Load a Piper voice model."""
    try:
        from piper import PiperVoice
        log(f"Loading model: {model_path}")
        voice = PiperVoice.load(model_path)
        log(f"Model loaded: samplerate={voice.config.sample_rate}")
        return voice
    except ImportError:
        raise RuntimeError("piper-tts is not installed. Run: pip install piper-tts")
    except Exception as e:
        raise RuntimeError(f"Failed to load model {model_path}: {e}")

def synthesize(voice, text, rate=1.0, pitch=1.0, speaker_id=None):
    """Synthesize text to WAV bytes using piper-tts 1.8+ API."""
    try:
        import wave
        from piper.config import SynthesisConfig

        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, 'wb') as wav_file:
            # Build SynthesisConfig for multi-speaker models and rate control
            syn_config = None
            if speaker_id is not None or rate != 1.0:
                syn_config = SynthesisConfig(
                    speaker_id=speaker_id,
                    length_scale=1.0 / rate if rate != 1.0 else None,
                )

            if syn_config is not None:
                voice.synthesize_wav(text, wav_file, syn_config=syn_config)
            else:
                voice.synthesize_wav(text, wav_file)

        wav_bytes = wav_buffer.getvalue()
        return wav_bytes
    except Exception as e:
        raise RuntimeError(f"Synthesis failed: {e}")

def main():
    log("Worker started, waiting for requests on stdin...")
    current_model = None
    current_model_path = None

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError as e:
            log(f"Invalid JSON: {e}")
            send_error(f"Invalid JSON: {e}")
            continue

        # Exit command
        if request.get('exit'):
            log("Exit requested, shutting down.")
            break

        text = request.get('text', '').strip()
        model_path = request.get('model', '')
        rate = request.get('rate', 1.0)
        pitch = request.get('pitch', 1.0)
        speaker_id = request.get('speaker_id')

        if not text:
            send_error("Empty text")
            continue

        if not model_path:
            send_error("No model path specified")
            continue

        # Load model if needed (or if path changed)
        if current_model is None or current_model_path != model_path:
            try:
                current_model = load_model(model_path)
                current_model_path = model_path
            except RuntimeError as e:
                log(f"Model load error: {e}")
                send_error(str(e))
                current_model = None
                current_model_path = None
                continue

        # Synthesize
        try:
            wav_bytes = synthesize(current_model, text, rate, pitch, speaker_id)
            send_wav(wav_bytes)
        except RuntimeError as e:
            log(f"Synthesis error: {e}")
            send_error(str(e))

    log("Worker exiting cleanly.")
    sys.exit(0)

if __name__ == '__main__':
    main()
