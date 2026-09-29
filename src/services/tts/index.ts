// =============================================
// RosaeFinity TTS Services - Barrel Export
// =============================================

export { getTTSService, initializeTTS, handleTTSCommentEvent, testTTSSpeak, stopTTS, getCurrentProfileTTSSettings, applyCurrentProfileTTSSettings } from './tts-service';
export { shouldReadComment, getFilterModeLabel, getAvailableFilterModes } from './tts-filters';
export { sanitizeForTTS, getSanitizationPreview } from './tts-sanitize';
export { TTSQueue } from './tts-queue';
export { WebSpeechEngine } from './engines/web-speech-engine';
export { LocalTTSEngine } from './engines/local-tts-engine';
export type {
  TTSSettings, TTSFilterMode, TTSQueueItem, TTSQueueState, TTSVoice,
  TTSServiceStatus, TTSVoiceInfo, TTSLanguage, TTSEngine, TTSSynthesizeOptions,
} from '../../types/tts';
export { DEFAULT_TTS_SETTINGS } from '../../types/tts';