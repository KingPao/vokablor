import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from '../../src/services/ai-providers/anthropic.js';
import { GoogleProvider } from '../../src/services/ai-providers/google.js';
import { createNvidiaFreeProvider } from '../../src/services/ai-providers/nvidia-free.js';
import { OpenAIProvider } from '../../src/services/ai-providers/openai.js';
import { getSharedFreeProvider, resolveProvider } from '../../src/services/ai-providers/index.js';
import { AIProviderError } from '../../src/services/ai-providers/types.js';

const CONTEXT = { languageCode: 'fr', level: 'A1' as const };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return new Response(JSON.stringify(body), { status, statusText: ok ? 'OK' : 'Error' });
}

describe('OpenAI-compatible base (via NvidiaFreeProvider)', () => {
  const provider = createNvidiaFreeProvider();
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generateText returns the chat completion content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'bonjour' } }] }));
    const result = await provider.generateText({ prompt: 'say hi', context: CONTEXT });
    expect(result).toBe('bonjour');
  });

  it('generateText throws AIProviderError on a non-OK HTTP response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    await expect(provider.generateText({ prompt: 'say hi', context: CONTEXT })).rejects.toThrow(AIProviderError);
  });

  it('generateText throws AIProviderError when the response has no content', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [] }));
    await expect(provider.generateText({ prompt: 'say hi', context: CONTEXT })).rejects.toThrow(AIProviderError);
  });

  it('converseTurn parses a well-formed JSON reply', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({ reply: 'Salut !', flaggedNewVocabulary: ['salut'], correctionDetail: null }),
            },
          },
        ],
      }),
    );
    const result = await provider.converseTurn({
      history: [],
      learnerMessage: 'bonjour',
      knownVocabulary: ['bonjour'],
      context: CONTEXT,
    });
    expect(result).toEqual({ reply: 'Salut !', flaggedNewVocabulary: ['salut'], correctionDetail: null });
  });

  it('converseTurn falls back to the raw reply when the model breaks the JSON contract (Principle III: no fabricated structure)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ choices: [{ message: { content: 'not json at all' } }] }));
    const result = await provider.converseTurn({
      history: [{ speaker: 'ai', content: 'Bonjour' }],
      learnerMessage: 'ça va',
      knownVocabulary: [],
      context: CONTEXT,
    });
    expect(result).toEqual({ reply: 'not json at all', flaggedNewVocabulary: [], correctionDetail: null });
  });

  it('NvidiaFreeProvider.evaluateSpeech always reports could_not_evaluate (no ASR capability)', async () => {
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result).toEqual({ transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null });
  });
});

describe('OpenAIProvider.evaluateSpeech', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('transcribes then judges the attempt as correct', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ text: 'bonjour' })) // transcription
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: JSON.stringify({ result: 'correct', correctionDetail: null, confidence: 0.95 }) } }],
        }),
      );
    const provider = new OpenAIProvider('sk-test', 'gpt-4o');
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1, 2, 3]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result.transcript).toBe('bonjour');
    expect(result.result).toBe('correct');
  });

  it('reports could_not_evaluate when transcription returns no usable text', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: '' }));
    const provider = new OpenAIProvider('sk-test', 'gpt-4o');
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result).toEqual({ transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null });
  });

  it('throws AIProviderError when the transcription request itself fails', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false));
    const provider = new OpenAIProvider('sk-test', 'gpt-4o');
    await expect(
      provider.evaluateSpeech({
        audio: Buffer.from([1]),
        mimeType: 'audio/webm',
        targetTerm: 'bonjour',
        targetTranslation: 'hello',
        context: CONTEXT,
      }),
    ).rejects.toThrow(AIProviderError);
  });
});

describe('AnthropicProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generateText extracts the text content block', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: 'text', text: 'bonjour' }] }));
    const provider = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');
    const result = await provider.generateText({ prompt: 'say hi', context: CONTEXT });
    expect(result).toBe('bonjour');
  });

  it('converseTurn parses structured JSON', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        content: [{ type: 'text', text: JSON.stringify({ reply: 'Salut', flaggedNewVocabulary: [], correctionDetail: 'x' }) }],
      }),
    );
    const provider = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');
    const result = await provider.converseTurn({ history: [], learnerMessage: 'bonjour', knownVocabulary: [], context: CONTEXT });
    expect(result.reply).toBe('Salut');
    expect(result.correctionDetail).toBe('x');
  });

  it('evaluateSpeech always reports could_not_evaluate (no audio-input capability)', async () => {
    const provider = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result.result).toBe('could_not_evaluate');
  });

  it('generateText throws AIProviderError on a non-OK response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, false));
    const provider = new AnthropicProvider('sk-ant-test', 'claude-3-5-sonnet');
    await expect(provider.generateText({ prompt: 'hi', context: CONTEXT })).rejects.toThrow(AIProviderError);
  });
});

describe('GoogleProvider', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => vi.unstubAllGlobals());

  it('generateText extracts the candidate text', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'bonjour' }] } }] }));
    const provider = new GoogleProvider('key', 'gemini-1.5-flash');
    const result = await provider.generateText({ prompt: 'say hi', context: CONTEXT });
    expect(result).toBe('bonjour');
  });

  it('evaluateSpeech sends inline audio data and parses the structured judgment', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify({ transcript: 'bonjour', result: 'correct', correctionDetail: null, confidence: 0.9 }) }],
            },
          },
        ],
      }),
    );
    const provider = new GoogleProvider('key', 'gemini-1.5-flash');
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1, 2, 3]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result.result).toBe('correct');
    expect(result.transcript).toBe('bonjour');
  });

  it('evaluateSpeech falls back to could_not_evaluate on a malformed judgment', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }));
    const provider = new GoogleProvider('key', 'gemini-1.5-flash');
    const result = await provider.evaluateSpeech({
      audio: Buffer.from([1]),
      mimeType: 'audio/webm',
      targetTerm: 'bonjour',
      targetTranslation: 'hello',
      context: CONTEXT,
    });
    expect(result.result).toBe('could_not_evaluate');
  });

  it('throws AIProviderError when the response has no candidate text', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ candidates: [] }));
    const provider = new GoogleProvider('key', 'gemini-1.5-flash');
    await expect(provider.generateText({ prompt: 'hi', context: CONTEXT })).rejects.toThrow(AIProviderError);
  });
});

describe('provider registry', () => {
  it('getSharedFreeProvider returns the same singleton instance', () => {
    expect(getSharedFreeProvider()).toBe(getSharedFreeProvider());
  });

  it('resolveProvider falls back to the shared provider when no API key is given', () => {
    expect(resolveProvider('openai', 'gpt-4o', null)).toBe(getSharedFreeProvider());
  });

  it('resolveProvider constructs the matching adapter for each BYO provider', () => {
    expect(resolveProvider('openai', 'gpt-4o', 'key')).toBeInstanceOf(OpenAIProvider);
    expect(resolveProvider('anthropic', 'claude-3-5-sonnet', 'key')).toBeInstanceOf(AnthropicProvider);
    expect(resolveProvider('google', 'gemini-1.5-flash', 'key')).toBeInstanceOf(GoogleProvider);
  });

  it('throws for an unsupported provider name', () => {
    expect(() => resolveProvider('other', 'model', 'key')).toThrow();
  });
});
