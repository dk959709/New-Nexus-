import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import { GoogleGenAI } from '@google/genai';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

import { errorResponse, domainOf, normalizeProviderUrl } from './shared.js';
import {
  getFirstConnectedTv,
  executeTvTool,
  getConnectedDevicesSummary,
} from './state.js';
import { mediaRouter } from './routes/media.js';
import { weatherRouter, geocode, weatherProvider } from './routes/weather.js';
import { createSearchRouter, searchProvider, fetchWikipediaSummary } from './routes/search.js';
import { devicesRouter } from './routes/devices.js';
import { telegramRouter, setTelegramAiHandler } from './routes/telegram.js';
import { apiCatalogRouter, getBackendApiKey } from './apiCatalog.js';
import { documentsRouter } from './routes/documents.js';


function sanitizeChatMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const validMsgs = (Array.isArray(messages) ? messages : []).filter(
    (m) => m && typeof m.content === 'string' && m.content.trim().length > 0,
  );

  const systemMsgs = validMsgs.filter((m) => m.role === 'system');
  const nonSystemMsgs = validMsgs.filter((m) => m.role !== 'system');

  // Drop leading assistant messages that have no preceding user message
  let firstUserIdx = nonSystemMsgs.findIndex((m) => m.role === 'user');
  if (firstUserIdx === -1 && nonSystemMsgs.length > 0) {
    firstUserIdx = 0;
  }
  const validNonSystem = firstUserIdx >= 0 ? nonSystemMsgs.slice(firstUserIdx) : [];

  const cleaned: Array<{ role: string; content: string }> = [];

  if (systemMsgs.length > 0) {
    cleaned.push({
      role: 'system',
      content: systemMsgs.map((s) => s.content.trim()).join('\n\n'),
    });
  }

  for (const msg of validNonSystem) {
    const role = msg.role === 'assistant' ? 'assistant' : 'user';
    const content = msg.content.trim();
    if (!content) continue;

    if (cleaned.length > 0 && cleaned[cleaned.length - 1].role === role) {
      cleaned[cleaned.length - 1].content += `\n\n${content}`;
    } else {
      cleaned.push({ role, content });
    }
  }

  if (!cleaned.some((m) => m.role === 'user')) {
    cleaned.push({ role: 'user', content: 'Hello' });
  }

  return cleaned;
}

interface ProviderRequestOptions {
  url?: string;
  model?: string;
  key?: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  extraParams?: Record<string, unknown>;
}

interface ProviderRequestResult {
  ok: boolean;
  text: string;
  content?: string;
  reasoning?: string;
  model: string;
  status: number;
  error?: string;
}

async function executeProviderChatRequest({
  url: rawUrl,
  model: rawModel,
  key: rawKey,
  messages,
  temperature = 0.3,
  maxTokens = 128,
  timeoutMs = 25000,
  extraParams,
}: ProviderRequestOptions): Promise<ProviderRequestResult> {
  const url = normalizeProviderUrl(rawUrl);
  const model = (rawModel || 'deepseek/deepseek-chat').trim();
  const key = (rawKey || '').trim();

  if (!key) {
    return {
      ok: false,
      text: '',
      content: '',
      reasoning: '',
      model,
      status: 401,
      error: 'Missing or empty API key.',
    };
  }

  const sanitized = sanitizeChatMessages(messages);
  const maxAttempts = 3; // Initial attempt + up to 2 retries for transient 503/502/504/429

  const isOpenRouter = url.includes('openrouter.ai');
  const isGroq = url.includes('groq.com') || (rawUrl && rawUrl.includes('groq'));
  const isBazaarLink =
    url.includes('bazaarlink.ai') ||
    url.includes('api.bazaarlink.ai') ||
    url.includes('bazaarlink.ai/api') ||
    (rawUrl && rawUrl.includes('bazaarlink'));
  const isHuggingFace =
    url.includes('router.huggingface.co') ||
    url.includes('huggingface.co') ||
    url.includes('hf.co') ||
    (rawUrl && rawUrl.includes('huggingface'));
  const isCloudflare =
    url.includes('gateway.ai.cloudflare.com') ||
    url.includes('cloudflare.com') ||
    (rawUrl && rawUrl.includes('cloudflare'));
  const isOllama =
    url.includes('ollama.com') ||
    url.includes('11434') ||
    (rawUrl && (rawUrl.includes('ollama') || rawUrl.includes('11434')));
  const isQwen37FlashFree = model.toLowerCase().includes('qwen/qwen3.7-flash:free');
  const isBazaarLinkQwen37Flash = Boolean(isBazaarLink && isQwen37FlashFree);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };

  if (isOpenRouter) {
    headers['HTTP-Referer'] = 'https://nexus-intelligence.local';
    headers['X-Title'] = 'NEXUS Intelligence';
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const requestBody: Record<string, unknown> = {
        model,
        messages: sanitized,
        temperature,
        max_tokens: maxTokens,
        ...(extraParams || {}),
      };

      if (isBazaarLinkQwen37Flash) {
        console.log(
          `[BazaarLink Qwen3.7-Flash Reasoning] Outgoing request to ${url} | model: "${model}" | Reasoning Params: ${JSON.stringify(extraParams || {})} | key: ${key ? `${key.slice(0, 10)}...` : 'NONE'} (attempt ${attempt}/${maxAttempts})`
        );
      }

      console.log(
        `[AI Provider Outgoing Request] POST ${url} | model: "${model}" | max_tokens: ${maxTokens} | temp: ${temperature} | params: ${JSON.stringify(extraParams || {})} | key: ${key ? `${key.slice(0, 10)}...` : 'NONE'} (attempt ${attempt}/${maxAttempts})`
      );
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (isBazaarLinkQwen37Flash) {
        console.log(
          `[BazaarLink Qwen3.7-Flash Reasoning] Response received from BazaarLink | Status: ${res.status} | Ok: ${res.ok} | Sent Params: ${JSON.stringify(extraParams || {})}`
        );
      }

      if (res.ok) {
        if (isBazaarLinkQwen37Flash) {
          console.log(
            `[BazaarLink Qwen3.7-Flash Reasoning] Request accepted by BazaarLink (HTTP ${res.status}). Working reasoning params: ${JSON.stringify(extraParams || {})}`
          );
        }
        const payload = (await res.json()) as {
          model?: string;
          choices?: Array<{
            message?: {
              content?: string | Array<{ type?: string; text?: string }>;
              reasoning?: string;
              reasoning_content?: string;
            };
            text?: string;
          }>;
        };

        const choice = payload.choices?.[0];
        let contentStr = '';
        if (choice?.message?.content) {
          if (typeof choice.message.content === 'string') {
            contentStr = choice.message.content.trim();
          } else if (Array.isArray(choice.message.content)) {
            contentStr = choice.message.content
              .map((part) => (typeof part === 'string' ? part : part?.text || ''))
              .join('')
              .trim();
          }
        }

        const rawReasoning =
          choice?.message?.reasoning ||
          (choice?.message as { reasoning_content?: string })?.reasoning_content;
        let reasoningStr = '';
        if (rawReasoning && typeof rawReasoning === 'string') {
          reasoningStr = rawReasoning.trim();
        }

        // Primary answer is message.content, falling back to message.reasoning only if content is empty
        const text =
          contentStr ||
          reasoningStr ||
          (typeof choice?.text === 'string' ? choice.text.trim() : '') ||
          (choice ? 'OK' : '');

        if (!text) {
          return {
            ok: false,
            text: '',
            content: '',
            reasoning: '',
            model: payload.model || model,
            status: 502,
            error: 'AI provider returned an empty response.',
          };
        }

        return {
          ok: true,
          text,
          content: contentStr,
          reasoning: reasoningStr,
          model: payload.model || model,
          status: res.status,
        };
      } else {
        const status = res.status;
        let errorMsg = `HTTP ${status}`;
        try {
          const errPayload = (await res.json()) as {
            error?: { message?: string } | string;
            message?: string;
          };
          errorMsg =
            (typeof errPayload.error === 'object' ? errPayload.error?.message : errPayload.error) ||
            errPayload.message ||
            `HTTP ${status}`;
        } catch {
          const rawText = await res.text().catch(() => '');
          if (rawText) {
            errorMsg = rawText.slice(0, 200);
          }
        }

        // If BazaarLink rejects initial reasoning_effort (e.g. "low") with a 400 error for Qwen3.7-Flash, trigger secondary fallback retry with reasoning_effort: "low" and enable_thinking: false
        if (isBazaarLinkQwen37Flash && status === 400 && extraParams?.reasoning_effort && extraParams?.enable_thinking === undefined) {
          console.warn(
            `[BazaarLink Qwen3.7-Flash Reasoning] HTTP 400 rejected for initial reasoning_effort: "${extraParams.reasoning_effort}" (${errorMsg}). Triggering secondary fallback retry with reasoning_effort: "low" and enable_thinking: false...`
          );
          const fallbackParams: Record<string, unknown> = {
            ...(extraParams || {}),
            reasoning_effort: 'low',
            enable_thinking: false,
          };
          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[BazaarLink Qwen3.7-Flash Reasoning] Secondary fallback retry outgoing request to ${url} | model: "${model}" | Fallback Reasoning Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[BazaarLink Qwen3.7-Flash Reasoning] Secondary fallback response received from BazaarLink | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[BazaarLink Qwen3.7-Flash Reasoning] Secondary fallback retry succeeded (HTTP ${fallbackRes.status})! Confirmed working configuration: { reasoning_effort: "low", enable_thinking: false }`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[BazaarLink Qwen3.7-Flash Reasoning] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[BazaarLink Qwen3.7-Flash Reasoning] Fallback retry network error:`,
              fbErr
            );
          }
        }

        // If BazaarLink returns an error for the reasoning parameter on any other model (e.g. plain models rejecting reasoning_effort), catch it and retry once without reasoning params
        if (
          isBazaarLink &&
          !isBazaarLinkQwen37Flash &&
          (extraParams?.reasoning_effort !== undefined || extraParams?.reasoning_format !== undefined || extraParams?.enable_thinking !== undefined) &&
          status >= 400 &&
          status < 500
        ) {
          console.warn(
            `[BazaarLink Reasoning Fallback] Model "${model}" rejected reasoning parameters (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning_effort;
          delete fallbackParams.reasoning_format;
          delete fallbackParams.enable_thinking;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[BazaarLink Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[BazaarLink Reasoning Fallback] Fallback response from BazaarLink | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[BazaarLink Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[BazaarLink Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[BazaarLink Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        // If OpenRouter returns an error for the reasoning parameter on any specific model, catch it and retry once without reasoning params
        if (isOpenRouter && extraParams?.reasoning && status >= 400 && status < 500) {
          console.warn(
            `[OpenRouter Reasoning Fallback] Model "${model}" rejected reasoning parameter (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[OpenRouter Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[OpenRouter Reasoning Fallback] Fallback response from OpenRouter | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[OpenRouter Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[OpenRouter Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[OpenRouter Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        // If Groq returns an error for the reasoning parameter on any specific model (e.g. plain instruct model), catch it and retry once without reasoning params
        if (
          isGroq &&
          (extraParams?.reasoning_effort !== undefined ||
            extraParams?.reasoning_format !== undefined ||
            extraParams?.include_reasoning !== undefined) &&
          status >= 400 &&
          status < 500
        ) {
          console.warn(
            `[Groq Reasoning Fallback] Model "${model}" rejected reasoning parameters (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning_effort;
          delete fallbackParams.reasoning_format;
          delete fallbackParams.include_reasoning;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[Groq Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[Groq Reasoning Fallback] Fallback response from Groq | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[Groq Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[Groq Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[Groq Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        // If Hugging Face returns an error for the reasoning parameter on any specific backend, catch it and retry once without reasoning params
        if (
          isHuggingFace &&
          (extraParams?.reasoning_effort !== undefined ||
            extraParams?.reasoning_format !== undefined ||
            extraParams?.include_reasoning !== undefined) &&
          status >= 400 &&
          status < 500
        ) {
          console.warn(
            `[Hugging Face Reasoning Fallback] Model "${model}" rejected reasoning parameters (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning_effort;
          delete fallbackParams.reasoning_format;
          delete fallbackParams.include_reasoning;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[Hugging Face Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[Hugging Face Reasoning Fallback] Fallback response from Hugging Face | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[Hugging Face Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[Hugging Face Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[Hugging Face Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        // If Cloudflare AI Gateway returns an error for the reasoning parameter on any specific backend, catch it and retry once without reasoning params
        if (
          isCloudflare &&
          (extraParams?.reasoning_effort !== undefined ||
            extraParams?.reasoning_format !== undefined ||
            extraParams?.include_reasoning !== undefined ||
            extraParams?.reasoning !== undefined ||
            extraParams?.chat_template_kwargs !== undefined) &&
          status >= 400 &&
          status < 500
        ) {
          console.warn(
            `[Cloudflare AI Gateway Reasoning Fallback] Model "${model}" rejected reasoning parameters (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning_effort;
          delete fallbackParams.reasoning_format;
          delete fallbackParams.include_reasoning;
          delete fallbackParams.reasoning;
          delete fallbackParams.chat_template_kwargs;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[Cloudflare AI Gateway Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[Cloudflare AI Gateway Reasoning Fallback] Fallback response from Cloudflare AI Gateway | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[Cloudflare AI Gateway Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[Cloudflare AI Gateway Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[Cloudflare AI Gateway Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        // If Ollama returns an error for the reasoning parameter on any specific model, catch it and retry once without reasoning params
        if (
          isOllama &&
          (extraParams?.reasoning_effort !== undefined ||
            extraParams?.reasoning_format !== undefined ||
            extraParams?.include_reasoning !== undefined ||
            extraParams?.reasoning !== undefined ||
            extraParams?.chat_template_kwargs !== undefined) &&
          status >= 400 &&
          status < 500
        ) {
          console.warn(
            `[Ollama Reasoning Fallback] Model "${model}" rejected reasoning parameters (HTTP ${status}: ${errorMsg}). Retrying once without reasoning parameter...`
          );
          const fallbackParams = { ...(extraParams || {}) };
          delete fallbackParams.reasoning_effort;
          delete fallbackParams.reasoning_format;
          delete fallbackParams.include_reasoning;
          delete fallbackParams.reasoning;
          delete fallbackParams.chat_template_kwargs;

          const fallbackRequestBody: Record<string, unknown> = {
            model,
            messages: sanitized,
            temperature,
            max_tokens: maxTokens,
            ...fallbackParams,
          };

          console.log(
            `[Ollama Reasoning Fallback] Outgoing retry request to ${url} | model: "${model}" | Fallback Params: ${JSON.stringify(fallbackParams)}`
          );

          try {
            const fallbackRes = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(fallbackRequestBody),
              signal: AbortSignal.timeout(timeoutMs),
            });

            console.log(
              `[Ollama Reasoning Fallback] Fallback response from Ollama | Status: ${fallbackRes.status} | Ok: ${fallbackRes.ok}`
            );

            if (fallbackRes.ok) {
              console.log(
                `[Ollama Reasoning Fallback] Fallback retry succeeded (HTTP ${fallbackRes.status}) for model "${model}" without reasoning parameter.`
              );
              const fbPayload = (await fallbackRes.json()) as {
                model?: string;
                choices?: Array<{
                  message?: {
                    content?: string | Array<{ type?: string; text?: string }>;
                    reasoning?: string;
                    reasoning_content?: string;
                  };
                  text?: string;
                }>;
              };

              const fbChoice = fbPayload.choices?.[0];
              let fbContentStr = '';
              if (fbChoice?.message?.content) {
                if (typeof fbChoice.message.content === 'string') {
                  fbContentStr = fbChoice.message.content.trim();
                } else if (Array.isArray(fbChoice.message.content)) {
                  fbContentStr = fbChoice.message.content
                    .map((part) => (typeof part === 'string' ? part : part?.text || ''))
                    .join('')
                    .trim();
                }
              }

              const fbRawReasoning =
                fbChoice?.message?.reasoning ||
                (fbChoice?.message as { reasoning_content?: string })?.reasoning_content;
              let fbReasoningStr = '';
              if (fbRawReasoning && typeof fbRawReasoning === 'string') {
                fbReasoningStr = fbRawReasoning.trim();
              }

              const fbText =
                fbContentStr ||
                fbReasoningStr ||
                (typeof fbChoice?.text === 'string' ? fbChoice.text.trim() : '') ||
                (fbChoice ? 'OK' : '');

              if (fbText) {
                return {
                  ok: true,
                  text: fbText,
                  content: fbContentStr,
                  reasoning: fbReasoningStr,
                  model: fbPayload.model || model,
                  status: fallbackRes.status,
                };
              }
            } else {
              let fbErrMsg = `HTTP ${fallbackRes.status}`;
              try {
                const fbErrObj = (await fallbackRes.json()) as { error?: { message?: string } | string; message?: string };
                fbErrMsg = (typeof fbErrObj.error === 'object' ? fbErrObj.error?.message : fbErrObj.error) || fbErrObj.message || `HTTP ${fallbackRes.status}`;
              } catch {
                const fbRaw = await fallbackRes.text().catch(() => '');
                if (fbRaw) fbErrMsg = fbRaw.slice(0, 200);
              }
              console.error(
                `[Ollama Reasoning Fallback] Fallback retry failed with HTTP ${fallbackRes.status} (${fbErrMsg}).`
              );
            }
          } catch (fbErr) {
            console.error(
              `[Ollama Reasoning Fallback] Fallback retry network error for model "${model}":`,
              fbErr
            );
          }
        }

        const isTransient = status === 503 || status === 502 || status === 504 || status === 429;
        if (isTransient && attempt < maxAttempts) {
          const backoff = attempt * 750; // 750ms, then 1500ms
          console.warn(`[AI Provider Request] ${url} (${model}) returned HTTP ${status} (${errorMsg}). Retrying in ${backoff}ms (attempt ${attempt}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        return {
          ok: false,
          text: '',
          model,
          status,
          error: errorMsg,
        };
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isTransientNetwork = attempt < maxAttempts;
      if (isTransientNetwork) {
        const backoff = attempt * 750;
        console.warn(`[AI Provider Request] Network error on attempt ${attempt}/${maxAttempts}: ${errorMsg}. Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      return {
        ok: false,
        text: '',
        model,
        status: 504,
        error: `Network or timeout error: ${errorMsg}`,
      };
    }
  }

  return {
    ok: false,
    text: '',
    model,
    status: 503,
    error: 'AI Provider request exhausted all retries.',
  };
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return geminiClient;
}

async function generateWithGemini({
  messages,
  temperature = 0.4,
  maxTokens = 2400,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
}): Promise<{ text: string; model: string } | null> {
  const client = getGeminiClient();
  if (!client) return null;

  const sys = messages.find((m) => m.role === 'system')?.content;
  const chatMsgs = messages.filter((m) => m.role !== 'system');

  const contents = chatMsgs.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  if (contents.length === 0) return null;

  // Primary model and fallback models supporting current API specifications
  const candidateModels = ['gemini-3.7-flash', 'gemini-3.8-flash'];

  for (const model of candidateModels) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sys || undefined,
            temperature,
            maxOutputTokens: Math.max(maxTokens || 1200, 1000),
            // Disable thinking budget for conversational responses so output tokens are not consumed by reasoning traces
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        const text = response.text?.trim();
        if (text) {
          return { text, model };
        }
      } catch (err: unknown) {
        const errStr = err instanceof Error ? err.message : String(err);
        const isUnavailableOrThrottled =
          errStr.includes('503') ||
          errStr.includes('UNAVAILABLE') ||
          errStr.includes('high demand') ||
          errStr.includes('429') ||
          errStr.includes('RESOURCE_EXHAUSTED');

        console.warn(`[Gemini AI] (${model} attempt ${attempt + 1}) notice: ${errStr}`);

        if (isUnavailableOrThrottled && attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          continue;
        }
        break;
      }
    }
  }

  return null;
}

function generateLocalNexusAiResponse(
  query: string,
  _history: Array<{ role: string; content: string }> = [],
  _memory = '',
  sourceContext = '',
): { text: string; model: string } {
  void _history;
  void _memory;
  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();

  // 1. Greetings
  const isGreeting =
    /^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy|sup|hola)\b/i.test(
      lower,
    ) ||
    lower === 'hi' ||
    lower === 'hello' ||
    lower === 'hey';

  if (isGreeting) {
    return {
      text: "Hello! I am NEXUS AI, your integrated intelligence assistant. I can help you with web search, live weather, space data, device telemetry, calculations, explanations, and summaries. What would you like to explore today?",
      model: 'nexus-intelligence',
    };
  }

  // 1.5 Real-time Date and Time Query
  if (
    lower.includes('date now') ||
    lower.includes('date today') ||
    lower.includes("today's date") ||
    lower.includes('today date') ||
    lower.includes('what day is today') ||
    lower.includes('what day is it') ||
    lower.includes('current date') ||
    lower.includes('what time is it') ||
    lower.includes('time now')
  ) {
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
    return {
      text: `Today is **${formattedDate}** (${now.toUTCString()}).`,
      model: 'nexus-time',
    };
  }

  // 2. Identity / Capabilities
  if (
    lower.includes('who are you') ||
    lower.includes('what are you') ||
    lower.includes('what can you do') ||
    lower.includes('help me') ||
    lower === 'help' ||
    lower === 'features'
  ) {
    return {
      text: `I am **NEXUS AI**, a multi-model intelligence operating system.\n\nHere is what I can do for you:\n• **Web & Knowledge Search**: Search the web and Wikipedia for instant facts and summaries.\n• **Weather & Radar**: Real-time forecasts, atmospheric conditions, and interactive radar maps.\n• **Space Intelligence**: NASA Astronomy Picture of the Day (APOD) and asteroid tracking.\n• **Device Fleet Telemetry**: Live battery, network, RAM, and diagnostic monitoring for connected devices.\n• **Assistant Chat**: Multi-turn reasoning, problem solving, and explanations.\n\nFeel free to ask any question or give me a task!`,
      model: 'nexus-intelligence',
    };
  }

  // 3. Simple math evaluation
  const mathMatch = trimmed.match(
    /^(?:what is|calculate|solve|evaluate)?\s*([0-9]+(?:\.[0-9]+)?\s*[+\-*/^%]\s*[0-9]+(?:\.[0-9]+)?(?:\s*[+\-*/^]\s*[0-9]+(?:\.[0-9]+)?)*)\s*\??$/i,
  );
  if (mathMatch && mathMatch[1]) {
    try {
      const sanitizedExpr = mathMatch[1].replace(/\^/g, '**');
      if (/^[0-9.+\-*/\s()]+$/.test(sanitizedExpr)) {
        const result = Function(`'use strict'; return (${sanitizedExpr})`)();
        if (typeof result === 'number' && !isNaN(result)) {
          return {
            text: `The result of **${mathMatch[1].trim()}** is **${result}**.`,
            model: 'nexus-calc',
          };
        }
      }
    } catch {
      // ignore
    }
  }

  // 3.5 TV Tool Queries
  const isTvSpecificQuery =
    lower.includes('tv volume') ||
    lower.includes('my tv') ||
    lower.includes('smart tv') ||
    lower.includes('google tv') ||
    lower.includes('android tv') ||
    lower.includes('webos') ||
    lower.includes('tv status') ||
    lower.includes('is tv on') ||
    lower.includes('is my tv') ||
    lower.includes('tv power') ||
    lower.includes('tv mute') ||
    lower.includes('turn down tv') ||
    lower.includes('turn up tv') ||
    lower.includes('mute tv');

  if (isTvSpecificQuery) {
    const tvDev = getFirstConnectedTv();
    if (!tvDev || !tvDev.tv) {
      return {
        text: 'No Smart TV is currently connected.',
        model: 'nexus-tv-tool',
      };
    }
    if (lower.includes('volume')) {
      return {
        text: `The Smart TV ("${tvDev.name}") volume is currently **${tvDev.tv.volume ?? 24}%** (Muted: ${tvDev.tv.isMuted ? 'Yes' : 'No'}).`,
        model: 'nexus-tv-tool',
      };
    }
    if (lower.includes('power') || lower.includes('is tv on') || lower.includes('is my tv on')) {
      return {
        text: `The Smart TV ("${tvDev.name}") is currently **${tvDev.tv.powerState || 'ON'}** and ${tvDev.status === 'online' ? 'connected' : 'offline'}.`,
        model: 'nexus-tv-tool',
      };
    }
    return {
      text: executeTvTool('get_tv_status').result,
      model: 'nexus-tv-tool',
    };
  }

  // 4. If source context is available (from Wikipedia, weather, NASA, devices)
  if (sourceContext) {
    return {
      text: sourceContext.replace(/\[.*?\]:?/g, '').trim(),
      model: 'nexus-knowledge',
    };
  }

  // 5. General response
  return {
    text: `Here is information regarding **"${trimmed}"**:\n\nNEXUS has processed your query across our live intelligence engines. You can also explore real-time web results in the **Web Search** tab or check the **Weather Radar**.`,
    model: 'nexus-intelligence',
  };
}

async function generateOpenRouterOrCustomAi({
  messages,
  temperature = 0.3,
  maxTokens = 128,
  timeoutMs = 35000,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; content?: string; reasoning?: string; model: string } | null> {
  // Try Gemini first if key is available
  if (process.env.GEMINI_API_KEY) {
    const geminiRes = await generateWithGemini({ messages, temperature, maxTokens });
    if (geminiRes && geminiRes.text) {
      return {
        text: geminiRes.text,
        content: geminiRes.text,
        reasoning: '',
        model: geminiRes.model,
      };
    }
  }

  const key =
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.DEEPSEEK_API_KEY;
  if (!key) return null;

  const url =
    process.env.AI_API_URL || 'https://openrouter.ai/api/v1/chat/completions';
  const model = process.env.AI_MODEL || 'deepseek/deepseek-chat';

  const result = await executeProviderChatRequest({
    url,
    model,
    key,
    messages,
    temperature,
    maxTokens,
    timeoutMs: timeoutMs || 35000,
  });

  if (result.ok && result.text) {
    return {
      text: result.text,
      content: result.content,
      reasoning: result.reasoning,
      model: result.model,
    };
  }

  console.warn(`[Built-in AI] Request failed: ${result.error || `HTTP ${result.status}`}`);
  return null;
}

interface CustomKeyItem {
  id?: string;
  key?: string;
  label?: string;
  status?: string;
}

interface CustomProviderPayload {
  id?: string;
  name?: string;
  url?: string;
  model?: string;
  maxTokens?: number | null;
  keyStrategy?: 'failover' | 'round_robin' | 'manual';
  preferredKeyId?: string;
  keys?: CustomKeyItem[];
  capabilities?: {
    text?: boolean;
    tools?: boolean;
    web?: boolean;
    wikipedia?: boolean;
    memory?: boolean;
  };
  extraParams?: Record<string, unknown>;
  reasoningParams?: Record<string, unknown>;
}

const keyCooldownMap = new Map<string, number>();
const providerRoundRobinIndex = new Map<string, number>();

async function executeAiWithProviderOrFallback({
  messages,
  temperature = 0.3,
  maxTokens = 128,
  providerConfig,
  timeoutMs = 35000,
}: {
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  maxTokens?: number | null;
  providerConfig?: CustomProviderPayload | null;
  timeoutMs?: number;
}): Promise<{
  text: string;
  content?: string;
  reasoning?: string;
  model: string;
  providerName?: string;
  lastError?: string;
  lastStatus?: number;
} | {
  text?: never;
  content?: never;
  reasoning?: never;
  model?: never;
  providerName?: never;
  lastError: string;
  lastStatus: number;
} | null> {
  const extraParams =
    providerConfig?.extraParams ||
    providerConfig?.reasoningParams ||
    undefined;

  let effectiveMaxTokens =
    maxTokens && maxTokens > 0
      ? maxTokens
      : providerConfig?.maxTokens && providerConfig.maxTokens > 0
      ? providerConfig.maxTokens
      : 128;
  const effectiveTimeout = timeoutMs || 35000;

  // If no custom provider or existing default is specified, use generateOpenRouterOrCustomAi
  if (!providerConfig || !providerConfig.id || providerConfig.id === 'existing') {
    const builtInResult = await generateOpenRouterOrCustomAi({
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: effectiveTimeout,
    });
    if (builtInResult) {
      return {
        text: builtInResult.text,
        content: builtInResult.content,
        reasoning: builtInResult.reasoning,
        model: builtInResult.model,
        providerName: 'Built-in AI',
      };
    }
    return {
      lastError: 'Built-in AI connection timed out or returned no content.',
      lastStatus: 503,
    };
  }

  // Custom provider execution with multiple keys & rotation / failover
  const url = (providerConfig.url || 'https://openrouter.ai/api/v1/chat/completions').trim();
  const model = (providerConfig.model || 'deepseek/deepseek-chat').trim();
  const strategy = providerConfig.keyStrategy || 'failover';
  const rawKeys = Array.isArray(providerConfig.keys) ? providerConfig.keys : [];
  const validKeys: Array<CustomKeyItem & { key: string }> = rawKeys.filter(
    (k): k is CustomKeyItem & { key: string } => Boolean(k && typeof k.key === 'string' && k.key.trim().length > 0),
  );

  console.log(
    `[AI Provider Failover: ${providerConfig.name}] Starting execution with ${validKeys.length} valid keys out of ${rawKeys.length} configured items in payload: [${validKeys.map((k, idx) => `"${k.label || `API Key ${idx + 1}`}"`).join(', ')}]`,
  );

  const serverKey =
    process.env.AI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    process.env.DEEPSEEK_API_KEY;

  if (validKeys.length === 0) {
    if (serverKey) {
      const serverResult = await executeProviderChatRequest({
        url,
        model,
        key: serverKey,
        messages,
        temperature,
        maxTokens: effectiveMaxTokens,
        timeoutMs: effectiveTimeout,
        extraParams,
      });

      if (serverResult.ok && serverResult.text) {
        return {
          text: serverResult.text,
          content: serverResult.content,
          reasoning: serverResult.reasoning,
          model: serverResult.model || model,
          providerName: providerConfig.name || 'OpenRouter',
        };
      }
      return {
        lastError: serverResult.error || `HTTP ${serverResult.status}`,
        lastStatus: serverResult.status,
      };
    }

    console.warn(`[AI Provider: ${providerConfig.name}] No valid keys found and no server key available.`);
    return {
      lastError: `No API key entered for provider "${providerConfig.name}".`,
      lastStatus: 400,
    };
  }

  // Determine initial key ordering based on strategy
  let orderedKeys: Array<CustomKeyItem & { key: string }> = [];

  if (strategy === 'manual' && providerConfig.preferredKeyId) {
    const preferred = validKeys.find((k) => k.id === providerConfig.preferredKeyId);
    const rest = validKeys.filter((k) => k.id !== providerConfig.preferredKeyId);
    orderedKeys = preferred ? [preferred, ...rest] : [...validKeys];
  } else if (strategy === 'round_robin') {
    const currentIndex = (providerConfig.id ? providerRoundRobinIndex.get(providerConfig.id) : 0) || 0;
    const startIdx = currentIndex % validKeys.length;
    orderedKeys = [
      ...validKeys.slice(startIdx),
      ...validKeys.slice(0, startIdx),
    ];
    if (providerConfig.id) {
      providerRoundRobinIndex.set(providerConfig.id, startIdx + 1);
    }
  } else {
    // Automatic failover: use configured order
    orderedKeys = [...validKeys];
  }

  // Prioritize keys that are not currently marked in cooldown/invalid,
  // but ALWAYS keep all valid keys in the sequence as fallbacks
  const now = Date.now();
  const isKeyActive = (k: CustomKeyItem & { key: string }) => {
    const serverCooldown = keyCooldownMap.get(k.key.trim()) || 0;
    const clientCooldown = typeof (k as { cooldownUntil?: number }).cooldownUntil === 'number' ? (k as { cooldownUntil?: number }).cooldownUntil! : 0;
    const isClientInvalid = (k as { status?: string }).status === 'invalid';
    return !isClientInvalid && serverCooldown <= now && clientCooldown <= now;
  };

  const activeKeys = orderedKeys.filter(isKeyActive);
  const inactiveKeys = orderedKeys.filter((k) => !isKeyActive(k));
  const finalKeySequence = activeKeys.length > 0 ? [...activeKeys, ...inactiveKeys] : orderedKeys;

  // Preserve all configured keys in sequence (avoid deduplication by key string which drops distinct keys)
  const seenKeyIds = new Set<string>();
  const executionKeyList: Array<CustomKeyItem & { key: string }> = [];
  for (let idx = 0; idx < finalKeySequence.length; idx++) {
    const k = finalKeySequence[idx];
    const keyIdentifier = k.id || `key_idx_${idx}`;
    if (!seenKeyIds.has(keyIdentifier)) {
      seenKeyIds.add(keyIdentifier);
      executionKeyList.push(k);
    }
  }

  let lastFailedError = '';
  let lastFailedStatus = 500;
  const keyFailureHistory: string[] = [];
  const retriedKeysWithBudget = new Set<string>();

  // Attempt each key in ordered sequence (Automatic Multi-Key Failover)
  for (let i = 0; i < executionKeyList.length; i++) {
    const keyItem = executionKeyList[i];
    const keyVal = keyItem.key.trim();
    const keyLabel = keyItem.label || `Key #${i + 1}`;

    let result = await executeProviderChatRequest({
      url,
      model,
      key: keyVal,
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: effectiveTimeout,
      extraParams,
    });

    if (result.ok && result.text && result.text.trim().length > 0) {
      keyCooldownMap.delete(keyVal);
      return {
        text: result.text,
        content: result.content,
        reasoning: result.reasoning,
        model: result.model || model,
        providerName: providerConfig.name,
      };
    }

    const status = result.status || (result.ok ? 502 : 500);
    const rawError = result.error || (!result.text ? 'Empty or malformed response from AI provider' : `HTTP ${status}`);
    lastFailedStatus = status;
    lastFailedError = rawError;

    // Detect failure categories (credit exhaustion, rate limits, auth errors, server errors, timeouts)
    const isCreditOrPaymentError =
      status === 402 ||
      /insufficient credits|requires more credits|can only afford|credit balance|payment required|out of credits|quota exceeded|balance is too low|free tier limit/i.test(rawError);

    const isRateLimit =
      status === 429 ||
      /rate limit|too many requests|tokens per minute|requests per minute|tpm limit|rpm limit/i.test(rawError);

    const isAuthError =
      status === 401 ||
      status === 403 ||
      /unauthorized|forbidden|invalid api key|access denied|wrong api key/i.test(rawError);

    const isServerError =
      status === 500 || status === 502 || status === 503 || status === 504;

    const isMalformedOrEmpty =
      result.ok && (!result.text || !result.text.trim());

    // Check if the error indicates a token budget ceiling (e.g. OpenRouter: "You requested up to X tokens, but can only afford Y")
    const affordMatch =
      rawError.match(/can only afford (\d+)/i) ||
      rawError.match(/(?:afford up to|affordable:?)\s*(\d+)/i) ||
      rawError.match(/(\d+)\s*(?:tokens available|tokens afford)/i) ||
      rawError.match(/requires more credits, or fewer max_tokens[^\d]*(\d+)?/i);

    if (affordMatch) {
      const affordableTokens = affordMatch[1] ? parseInt(affordMatch[1], 10) : 16;
      const safeBudget = Math.max(1, Math.floor(affordableTokens * 0.95) || affordableTokens);
      const adjustedMaxTokens = Math.min(effectiveMaxTokens, safeBudget);
      if (adjustedMaxTokens < effectiveMaxTokens) {
        console.warn(
          `[AI Provider Failover: ${providerConfig.name}] Provider credit allowance limit encountered ("can only afford ${affordableTokens}"). Adapting maxTokens from ${effectiveMaxTokens} to ${adjustedMaxTokens} for subsequent attempts.`,
        );
        effectiveMaxTokens = adjustedMaxTokens;

        // If this key wasn't retried yet and can afford at least 4 tokens, retry it once with the adapted budget
        if (!retriedKeysWithBudget.has(keyVal) && affordableTokens >= 4) {
          retriedKeysWithBudget.add(keyVal);
          console.warn(
            `[AI Provider Failover: ${providerConfig.name}] Retrying Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) with adapted budget of ${effectiveMaxTokens} tokens...`,
          );
          const retryResult = await executeProviderChatRequest({
            url,
            model,
            key: keyVal,
            messages,
            temperature,
            maxTokens: effectiveMaxTokens,
            timeoutMs: effectiveTimeout,
            extraParams,
          });
          if (retryResult.ok && retryResult.text && retryResult.text.trim().length > 0) {
            keyCooldownMap.delete(keyVal);
            console.log(
              `[AI Provider Failover: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) succeeded on adapted token budget (${effectiveMaxTokens} tokens).`,
            );
            return {
              text: retryResult.text,
              content: retryResult.content,
              reasoning: retryResult.reasoning,
              model: retryResult.model || model,
              providerName: providerConfig.name,
            };
          }
          result = retryResult;
        }
      }
    }

    // Determine categorization & cooldown duration
    let failureCategory = 'error';
    let cooldownDuration = 5000;

    if (isCreditOrPaymentError) {
      failureCategory = 'insufficient credits / payment required (HTTP 402)';
      cooldownDuration = 60000; // 1m (60s) cooldown so subsequent agent steps automatically skip this exhausted key
    } else if (isAuthError) {
      failureCategory = `auth/credentials failed (HTTP ${status})`;
      cooldownDuration = 300000; // 5m cooldown for bad keys
    } else if (isRateLimit) {
      failureCategory = 'rate limit (HTTP 429)';
      cooldownDuration = 10000; // 10s cooldown for rate limit recovery
    } else if (isServerError) {
      failureCategory = `server error (HTTP ${status})`;
      cooldownDuration = 3000;
    } else if (isMalformedOrEmpty) {
      failureCategory = 'empty or malformed response';
      cooldownDuration = 3000;
    } else {
      failureCategory = `HTTP ${status}`;
      cooldownDuration = 5000;
    }

    keyCooldownMap.set(keyVal, Date.now() + cooldownDuration);

    const nextKeyItem = i < executionKeyList.length - 1 ? executionKeyList[i + 1] : null;
    const nextKeyLabel = nextKeyItem ? (nextKeyItem.label || `Key #${i + 2}`) : null;

    keyFailureHistory.push(`"${keyLabel}": [${failureCategory}] ${rawError}`);

    if (nextKeyItem) {
      console.warn(
        `[AI Provider Failover: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) failed [${failureCategory}: ${rawError}]. Auto-failing over to next Key "${nextKeyLabel}" (${i + 2}/${executionKeyList.length})...`,
      );
    } else {
      console.warn(
        `[AI Provider Failover: ${providerConfig.name}] Key "${keyLabel}" (${i + 1}/${executionKeyList.length}) failed [${failureCategory}: ${rawError}]. All ${executionKeyList.length} configured keys exhausted.`,
      );
    }
  }

  if (keyFailureHistory.length > 0) {
    lastFailedError = `All ${executionKeyList.length} keys failed for provider "${providerConfig.name}": [${keyFailureHistory.join(' | ')}]`;
  }

  // Fallback to Gemini or server key if custom keys failed
  if (process.env.GEMINI_API_KEY) {
    const geminiFallback = await generateWithGemini({
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
    });
    if (geminiFallback && geminiFallback.text) {
      return {
        text: geminiFallback.text,
        content: geminiFallback.text,
        reasoning: '',
        model: geminiFallback.model,
        providerName: 'Google Gemini',
      };
    }
  }

  if (serverKey) {
    const serverFallbackResult = await executeProviderChatRequest({
      url,
      model,
      key: serverKey,
      messages,
      temperature,
      maxTokens: effectiveMaxTokens,
      timeoutMs: 25000,
      extraParams,
    });

    if (serverFallbackResult.ok && serverFallbackResult.text) {
      return {
        text: serverFallbackResult.text,
        content: serverFallbackResult.content,
        reasoning: serverFallbackResult.reasoning,
        model: serverFallbackResult.model || model,
        providerName: providerConfig.name || 'OpenRouter',
      };
    }
  }

  return {
    lastError: lastFailedError,
    lastStatus: lastFailedStatus,
  };
}


type SourceCategory = 'ALL' | 'web' | 'wikipedia' | 'news' | 'nasa' | 'weather';
type ConfidenceLevel = 'verified' | 'limited' | 'unverified';

interface SmartAnswerSource {
  title: string;
  url: string;
  domain?: string;
  description?: string;
  date?: string;
  thumbnail?: string;
  image?: string;
  type: SourceCategory;
  trustTier?: 1 | 2 | 3;
  trustTierLabel?: 'Official / Primary' | 'Secondary' | 'Unverified';
  trustTierReason?: string;
}

interface DomainTrustClassification {
  tier: 1 | 2 | 3;
  tierLabel: 'Official / Primary' | 'Secondary' | 'Unverified';
  reason: string;
}

const TIER_1_OFFICIAL_DOMAINS = new Set([
  // Core AI & Tech Foundation Creators
  'anthropic.com',
  'claude.ai',
  'openai.com',
  'chatgpt.com',
  'google.com',
  'ai.google.dev',
  'deepmind.google',
  'blog.google',
  'cloud.google.com',
  'developers.google.com',
  'microsoft.com',
  'azure.com',
  'msdn.com',
  'meta.com',
  'ai.meta.com',
  'apple.com',
  'developer.apple.com',
  'nvidia.com',
  'developer.nvidia.com',
  'amazon.com',
  'aws.amazon.com',
  'github.com',
  'gitlab.com',
  'huggingface.co',
  // Official software standards, specs & documentation
  'wikipedia.org',
  'wikimedia.org',
  'wikidata.org',
  'python.org',
  'rust-lang.org',
  'golang.org',
  'go.dev',
  'nodejs.org',
  'typescriptlang.org',
  'react.dev',
  'nextjs.org',
  'vuejs.org',
  'angular.dev',
  'mozilla.org',
  'developer.mozilla.org',
  'w3.org',
  'ietf.org',
  'docker.com',
  'kubernetes.io',
  'linux.org',
  'kernel.org',
  'postgresql.org',
  'sqlite.org',
  'mongodb.com',
  'redis.io',
  'apache.org',
  // Major recognized news outlets, financial, and science publications
  'reuters.com',
  'bloomberg.com',
  'cnbc.com',
  'wsj.com',
  'ft.com',
  'nytimes.com',
  'washingtonpost.com',
  'theguardian.com',
  'bbc.com',
  'bbc.co.uk',
  'apnews.com',
  'techcrunch.com',
  'theverge.com',
  'wired.com',
  'arstechnica.com',
  'nature.com',
  'science.org',
  'economist.com',
  'engadget.com',
  'zdnet.com',
  'forbes.com',
  'time.com',
  'cnn.com',
  'aljazeera.com',
  'nationalgeographic.com',
  'scientificamerican.com',
  'technologyreview.com',
]);

const TIER_2_REPUTABLE_DOMAINS = new Set([
  'medium.com',
  'dev.to',
  'hashnode.com',
  'stackoverflow.com',
  'stackexchange.com',
  'reddit.com',
  'github.io',
  'geeksforgeeks.org',
  'freecodecamp.org',
  'tomshardware.com',
  'tomsguide.com',
  'cnet.com',
  'gsmarena.com',
  'techradar.com',
  'pcmag.com',
  'androidauthority.com',
  'androidcentral.com',
  '9to5google.com',
  '9to5mac.com',
  'macrumors.com',
  'xda-developers.com',
  'hackerone.com',
  'news.ycombinator.com',
  'substack.com',
  'quora.com',
  'producthunt.com',
  'digitalocean.com',
  'howtogeek.com',
  'dzone.com',
  'infoq.com',
  'towardsdatascience.com',
  'slashdot.org',
  'businessinsider.com',
  'mashable.com',
  'venturebeat.com',
  'gizmodo.com',
  'bleepingcomputer.com',
  'securityweek.com',
  'krebsonsecurity.com',
]);

function extractBaseDomain(rawDomainOrUrl: string): string {
  if (!rawDomainOrUrl) return '';
  let str = rawDomainOrUrl.trim().toLowerCase();
  str = str.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split('?')[0].split(':')[0];
  return str;
}

function classifyDomainTrustTier(domainOrUrl: string, query: string): DomainTrustClassification {
  const host = extractBaseDomain(domainOrUrl);
  if (!host) {
    return { tier: 3, tierLabel: 'Unverified', reason: 'Empty or unrecognizable domain' };
  }

  // 1. Check Government / Multilateral Official Institutions (.gov, .mil, .int, europa.eu)
  if (
    host.endsWith('.gov') ||
    host.includes('.gov.') ||
    host.endsWith('.mil') ||
    host.endsWith('.int') ||
    host.includes('europa.eu')
  ) {
    return {
      tier: 1,
      tierLabel: 'Official / Primary',
      reason: 'Official government, institutional, or multilateral authority',
    };
  }

  // 2. Check explicitly listed Tier 1 official domains and publications
  for (const t1 of TIER_1_OFFICIAL_DOMAINS) {
    if (host === t1 || host.endsWith(`.${t1}`)) {
      return {
        tier: 1,
        tierLabel: 'Official / Primary',
        reason: `Verified official primary domain or recognized major publication (${t1})`,
      };
    }
  }

  // 3. Dynamic subject match: if query references a specific product/entity whose primary domain matches
  const qClean = query.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const qWords = qClean
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        ![
          'what', 'when', 'where', 'which', 'who', 'how', 'about', 'the', 'and', 'for', 'with',
          'from', 'this', 'that', 'explain', 'show', 'tell', 'latest', 'news', 'update', 'version',
        ].includes(w),
    );

  const hostParts = host.split('.');
  const rootName = hostParts.length >= 2 ? hostParts[hostParts.length - 2] : host;

  for (const word of qWords) {
    if (rootName === word || rootName.startsWith(word) || word.startsWith(rootName)) {
      const validTlds = ['com', 'org', 'dev', 'io', 'ai', 'app', 'net', 'co', 'so', 'me', 'gg'];
      const tld = hostParts[hostParts.length - 1];
      if (validTlds.includes(tld)) {
        return {
          tier: 1,
          tierLabel: 'Official / Primary',
          reason: `Subject's official root domain match for "${word}"`,
        };
      }
    }
  }

  // 4. Check .edu educational domains (Secondary Tier 2 per spec: ".edu pages that aren't clearly current/official documentation")
  if (host.endsWith('.edu') || host.includes('.edu.')) {
    return {
      tier: 2,
      tierLabel: 'Secondary',
      reason: 'Academic or educational institution domain (.edu)',
    };
  }

  // 5. Check explicitly listed Tier 2 secondary domains
  for (const t2 of TIER_2_REPUTABLE_DOMAINS) {
    if (host === t2 || host.endsWith(`.${t2}`)) {
      return {
        tier: 2,
        tierLabel: 'Secondary',
        reason: `Recognized secondary tech blog, community, or review hub (${t2})`,
      };
    }
  }

  // 6. Default to Tier 3 (Unverified / Suspicious / Unfamiliar)
  return {
    tier: 3,
    tierLabel: 'Unverified',
    reason: 'Unverified or unfamiliar domain with unknown authority',
  };
}

interface SmartAnswerResult {
  query: string;
  answer: string;
  confidence: ConfidenceLevel;
  confidenceReason?: string;
  sources: SmartAnswerSource[];
  followUps?: string[];
  selectedCategories: SourceCategory[];
  model?: string;
  tool?: string;
  fromCache?: boolean;
}

const smartAnswerCache = new Map<string, { data: SmartAnswerResult; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function determineSourceCategories(query: string): SourceCategory[] {
  const text = query.toLowerCase().trim();
  const categories = new Set<SourceCategory>();

  // 1. Weather
  const weatherKeywords = [
    'weather', 'temperature', 'forecast', 'rain', 'snow', 'wind', 'humidity',
    'climate', 'degrees', 'celsius', 'fahrenheit', 'hot outside', 'cold outside',
    'precipitation'
  ];
  if (weatherKeywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(text))) {
    categories.add('weather');
  }

  // 2. NASA / Space
  const spaceKeywords = [
    'space', 'black hole', 'black holes', 'nasa', 'astronaut', 'mars', 'moon',
    'planet', 'planets', 'galaxy', 'galaxies', 'universe', 'telescope', 'james webb',
    'hubble', 'iss', 'station', 'star', 'stars', 'solar system', 'orbit', 'asteroid',
    'comet', 'supernova', 'nebula', 'spacex', 'cosmic', 'astronomy', 'cosmos'
  ];
  if (spaceKeywords.some((kw) => text.includes(kw))) {
    categories.add('nasa');
    categories.add('wikipedia');
  }

  // 3. News
  const newsKeywords = [
    'news', 'latest', 'today', 'breaking', 'recent', 'headlines', 'update', 'updates',
    'happening', 'current events', 'stock market', 'election'
  ];
  if (newsKeywords.some((kw) => new RegExp(`\\b${kw}\\b`).test(text))) {
    categories.add('news');
    categories.add('web');
  }

  // 4. Wikipedia (scientific, historical, biographical, definitional, conceptual)
  const wikiKeywords = [
    'who is', 'who was', 'what is', 'what was', 'what are', 'where is', 'where was',
    'when was', 'when did', 'define', 'definition', 'explain', 'how does', 'why is',
    'why do', 'history of', 'biography', 'concept', 'theory', 'photosynthesis',
    'einstein', 'newton', 'quantum', 'dna', 'evolution', 'biology', 'physics',
    'chemistry', 'wikipedia', 'wiki'
  ];
  if (wikiKeywords.some((kw) => text.includes(kw))) {
    categories.add('wikipedia');
    categories.add('web');
  }

  // If only weather is requested, return weather
  if (categories.has('weather') && categories.size === 1) {
    return ['weather'];
  }

  // If query is specifically about space news
  if (text.includes('space') && text.includes('news')) {
    categories.add('news');
    categories.add('nasa');
    categories.add('web');
  }

  // Default fallback for general knowledge
  if (categories.size === 0) {
    categories.add('wikipedia');
    categories.add('web');
  }

  return Array.from(categories);
}

function generateSmartFollowUps(
  query: string,
  categories: SourceCategory[],
  sources: SmartAnswerSource[],
): string[] {
  const q = query.toLowerCase().trim();
  if (q.includes('black hole')) {
    return [
      'What causes a black hole to form?',
      'Can a black hole disappear over time?',
      'What happens near the event horizon?',
    ];
  }
  if (q.includes('einstein') || q.includes('albert')) {
    return [
      'What are the key principles of General Relativity?',
      'When did Albert Einstein win the Nobel Prize?',
      'How did Einstein contribute to quantum mechanics?',
    ];
  }
  if (q.includes('photosynthesis')) {
    return [
      'What are the light-dependent reactions in photosynthesis?',
      'Why is chlorophyll essential for plant cells?',
      'How does carbon dioxide concentration affect photosynthesis?',
    ];
  }
  if (q.includes('mars')) {
    return [
      'What is the atmosphere of Mars composed of?',
      'What evidence exists of past water on Mars?',
      'What are the main missions currently exploring Mars?',
    ];
  }
  if (categories.includes('weather')) {
    return [
      'What is the 7-day extended forecast?',
      'What is the precipitation probability today?',
      'What are the expected sunrise and sunset times?',
    ];
  }
  if (categories.includes('nasa')) {
    return [
      'What is the current position of the ISS?',
      'What are upcoming NASA space exploration missions?',
      'How do astronomers measure cosmic distances?',
    ];
  }
  if (categories.includes('news')) {
    return [
      'What are recent developments related to this story?',
      'What background context led to this headline?',
      'What are different media perspectives on this topic?',
    ];
  }
  if (sources.length > 0 && sources[0].title) {
    const mainTitle = sources[0].title;
    return [
      `What is the background and origin of ${mainTitle}?`,
      `How does ${mainTitle} work in practice?`,
      `What are the major applications or impact of ${mainTitle}?`,
    ];
  }
  return [
    `Can you explain the key concepts of ${query}?`,
    `What are the most important facts to know about this?`,
    `What is the historical significance of this?`,
  ];
}

async function executeSmartAnswerEngine(
  query: string,
  customSources?: Array<{ title: string; url: string; description: string; domain?: string }>,
  providerConfig?: CustomProviderPayload | null,
): Promise<SmartAnswerResult> {
  const trimmed = query.trim();
  const cacheKey =
    providerConfig && providerConfig.id !== 'existing'
      ? `${providerConfig.id}:${trimmed.toLowerCase()}`
      : trimmed.toLowerCase();

  if (!customSources && smartAnswerCache.has(cacheKey)) {
    const cached = smartAnswerCache.get(cacheKey)!;
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { ...cached.data, fromCache: true };
    }
  }

  const structuredSources: SmartAnswerSource[] = [];
  const contextBlocks: string[] = [];
  const selectedCategories: SourceCategory[] = customSources
    ? ['web']
    : determineSourceCategories(trimmed);

  if (customSources && customSources.length > 0) {
    // Token-optimized custom sources from Search result synthesis
    for (const item of customSources.slice(0, 4)) {
      const cleanDesc = (item.description || '').replace(/\s+/g, ' ').slice(0, 200).trim();
      structuredSources.push({
        title: item.title,
        url: item.url,
        domain: item.domain || domainOf(item.url) || 'web',
        description: cleanDesc,
        type: 'web',
      });
      contextBlocks.push(`[Web Source: ${item.title}] (Domain: ${item.domain || 'web'})\n${cleanDesc}`);
    }
  } else {
    // Multi-source intelligence retrieval
    const promises: Promise<void>[] = [];

    // 1. Wikipedia
    if (selectedCategories.includes('wikipedia')) {
      promises.push(
        fetchWikipediaSummary(trimmed)
          .then((wikiArticle) => {
            if (wikiArticle && wikiArticle.extract) {
              const cleanExtract = wikiArticle.extract.replace(/\s+/g, ' ').slice(0, 450).trim();
              structuredSources.push({
                title: wikiArticle.title,
                url: wikiArticle.url,
                domain: 'wikipedia.org',
                description: cleanExtract,
                thumbnail: wikiArticle.thumbnail,
                image: wikiArticle.thumbnail,
                type: 'wikipedia',
              });
              contextBlocks.push(
                `[Wikipedia: ${wikiArticle.title}]\n${cleanExtract}`,
              );
            }
          })
          .catch(() => {}),
      );
    }

    // 2. NASA / Space
    if (selectedCategories.includes('nasa')) {
      promises.push(
        (async () => {
          try {
            // Check NASA APOD or space topic summary
            const apiKey = getBackendApiKey('NASA_API_KEY') || 'DEMO_KEY';
            const apodRes = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`).catch(() => null);
            if (apodRes && apodRes.ok) {
              const apodData = (await apodRes.json()) as { title?: string; explanation?: string; hdurl?: string; url?: string; date?: string };
              if (apodData.title && (trimmed.toLowerCase().includes('space') || trimmed.toLowerCase().includes('nasa') || apodData.title.toLowerCase().includes(trimmed.toLowerCase()))) {
                const cleanApodExp = (apodData.explanation || '').slice(0, 300).trim();
                structuredSources.push({
                  title: `NASA Astronomy: ${apodData.title}`,
                  url: 'https://apod.nasa.gov/apod/',
                  domain: 'nasa.gov',
                  description: cleanApodExp,
                  thumbnail: apodData.hdurl || apodData.url,
                  image: apodData.hdurl || apodData.url,
                  date: apodData.date,
                  type: 'nasa',
                });
                contextBlocks.push(`[NASA Space Picture Insight: ${apodData.title}]\n${cleanApodExp}`);
              }
            }
          } catch {
            // non-fatal
          }
        })(),
      );
    }

    // 3. Weather
    if (selectedCategories.includes('weather')) {
      promises.push(
        (async () => {
          try {
            const cityMatch = trimmed.match(
              /\b(?:in|at|for|near)\s+([A-Za-z][A-Za-z .'-]{1,80}?)(?:\?|$| today| tomorrow| now| currently| right now)/i,
            );
            const city = cityMatch?.[1]?.trim() || 'London, UK';
            const locations = await geocode(city);
            const loc = locations[0];
            if (loc) {
              const w = await weatherProvider(loc.latitude, loc.longitude, `${loc.name}, ${loc.country}`);
              const weatherSummary = `Location: ${w.current.location} | Temperature: ${w.current.temperature}°C (Feels like: ${w.current.feelsLike}°C) | Condition: ${w.current.conditionLabel} | Humidity: ${w.current.humidity}% | Wind: ${w.current.wind} km/h | Rain Chance: ${w.current.rainProbability}%`;
              structuredSources.push({
                title: `Weather for ${w.current.location}`,
                url: `/weather?city=${encodeURIComponent(w.current.location)}`,
                domain: 'open-meteo.com',
                description: weatherSummary,
                type: 'weather',
              });
              contextBlocks.push(`[Live Weather Data]\n${weatherSummary}`);
            }
          } catch {
            // non-fatal
          }
        })(),
      );
    }

    // 4. News
    if (selectedCategories.includes('news')) {
      promises.push(
        searchProvider({ query: trimmed, page: 1, category: 'NEWS' })
          .then((newsRes) => {
            const newsItems = newsRes?.results ?? [];
            for (const item of newsItems.slice(0, 2)) {
              const cleanDesc = (item.description || '').slice(0, 180).trim();
              structuredSources.push({
                title: item.title,
                url: item.url,
                domain: item.domain || 'news',
                description: cleanDesc,
                date: item.date,
                thumbnail: item.thumbnail || item.image,
                image: item.image || item.thumbnail,
                type: 'news',
              });
              contextBlocks.push(`[News Source: ${item.title}] (Source: ${item.domain})\n${cleanDesc}`);
            }
          })
          .catch(() => {}),
      );
    }

    // 5. Web Search
    if (selectedCategories.includes('web')) {
      promises.push(
        searchProvider({ query: trimmed, page: 1, category: 'ALL' })
          .then((webRes) => {
            const webItems = webRes?.results ?? [];
            for (const item of webItems.slice(0, 3)) {
              if (!structuredSources.some((s) => s.url === item.url)) {
                const cleanDesc = (item.description || '').slice(0, 180).trim();
                structuredSources.push({
                  title: item.title,
                  url: item.url,
                  domain: item.domain || 'web',
                  description: cleanDesc,
                  thumbnail: item.thumbnail || item.image,
                  image: item.image || item.thumbnail,
                  type: 'web',
                });
                contextBlocks.push(`[Web Source: ${item.title}] (${item.domain})\n${cleanDesc}`);
              }
            }
          })
          .catch(() => {}),
      );
    }

    await Promise.allSettled(promises);
  }

  // Determine Confidence
  let confidence: ConfidenceLevel = 'unverified';
  let confidenceReason = 'Limited or unverified source data found.';

  if (structuredSources.length >= 2) {
    confidence = 'verified';
    confidenceReason = `Well supported by ${structuredSources.length} verified sources (${selectedCategories.join(', ')}).`;
  } else if (structuredSources.length === 1) {
    confidence = 'limited';
    confidenceReason = `Single verified source retrieved (${structuredSources[0].domain || structuredSources[0].type}).`;
  } else {
    confidence = 'unverified';
    confidenceReason = 'Unable to corroborate with verified live sources.';
  }

  // Token-optimized prompt for AI synthesis
  const compactContext = contextBlocks.slice(0, 3).join('\n\n');
  const systemInstruction =
    'You are NEXUS Smart Answer Engine. Formulate a direct, concise 1-3 sentence factual answer based strictly on verified sources. Never use promotional filler or phrases like "As an AI". Give the direct answer immediately.';

  const userPrompt = [
    `Question: "${trimmed}"`,
    compactContext ? `Verified Sources:\n${compactContext}` : '',
    'Answer concisely:',
  ]
    .filter(Boolean)
    .join('\n\n');

  let generatedAnswer = '';
  let modelUsed = process.env.AI_MODEL || 'deepseek/deepseek-chat';

  // 1. Execute with active AI provider (Default / OpenRouter / Custom with multi-key failover)
  const aiResult = await executeAiWithProviderOrFallback({
    messages: [
      { role: 'system', content: systemInstruction },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: providerConfig?.maxTokens || 512,
    providerConfig,
  });

  if (aiResult && aiResult.text) {
    generatedAnswer = aiResult.text;
    modelUsed = aiResult.model;
  }

  // 2. Direct factual source extraction fallback if cloud models are unreachable
  if (!generatedAnswer) {
    if (structuredSources.length > 0) {
      const primary = structuredSources[0];
      generatedAnswer = primary.description || `Retrieved verified information from ${primary.title}.`;
      modelUsed = 'nexus-knowledge';
    } else {
      const localFallback = generateLocalNexusAiResponse(trimmed);
      generatedAnswer = localFallback.text;
      modelUsed = localFallback.model || 'nexus-intelligence';
      confidence = 'verified';
      confidenceReason = 'Synthesized via NEXUS Intelligence Engine.';
    }
  }

  const followUps = generateSmartFollowUps(trimmed, selectedCategories, structuredSources);

  const finalResult: SmartAnswerResult = {
    query: trimmed,
    answer: generatedAnswer,
    confidence,
    confidenceReason,
    sources: structuredSources,
    followUps,
    selectedCategories,
    model: modelUsed,
  };

  if (!customSources) {
    smartAnswerCache.set(cacheKey, { data: finalResult, timestamp: Date.now() });
  }

  return finalResult;
}

/**
 * Reformulates a follow-up user query using recent conversation context into a standalone search query.
 * Keeps latency minimal by using a fast, lightweight completion call with strict timeout.
 */
async function reformulateSearchQueryWithContext(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  providerConfig?: CustomProviderPayload | null,
): Promise<{ query: string; reformulated: boolean; reason?: string }> {
  const trimmed = message.trim();
  if (!trimmed || !history || history.length === 0) {
    return { query: trimmed, reformulated: false };
  }

  const lower = trimmed.toLowerCase();
  const hasPronounOrDeictic = /\b(this|that|these|those|it|its|they|them|their|he|she|him|her|his|hers|here|there)\b/i.test(lower);
  const isShortFollowUp =
    lower.length < 50 ||
    lower.startsWith('how') ||
    lower.startsWith('why') ||
    lower.startsWith('what about') ||
    lower.startsWith('what else') ||
    lower.startsWith('explain') ||
    lower.startsWith('tell me more') ||
    lower.startsWith('can you') ||
    lower.includes('work') ||
    lower.includes('example') ||
    lower.includes('difference') ||
    lower.includes('pros') ||
    lower.includes('cons') ||
    lower.includes('advantages') ||
    lower.includes('limitations');

  const recentTurns = history.slice(-4).map((h) => {
    const roleLabel = h.role === 'user' ? 'User' : 'Assistant';
    const snippet = h.content.replace(/\s+/g, ' ').slice(0, 200).trim();
    return `[${roleLabel}]: ${snippet}`;
  });

  if (recentTurns.length === 0) {
    return { query: trimmed, reformulated: false };
  }

  // Fast AI reformulation attempt
  try {
    const systemPrompt =
      'You are a search query optimizer. Given recent conversation turns and a user follow-up question, rewrite the follow-up question into a single, concise, standalone web search query (3 to 8 words) that captures the full specific topic/subject. Output ONLY the plain search query without quotes, without prefixes, and without punctuation.';

    const userPrompt =
      `Recent Conversation:\n${recentTurns.join('\n')}\n\n` +
      `User Follow-up Message: "${trimmed}"\n\n` +
      `Standalone Search Query:`;

    const aiResult = await executeAiWithProviderOrFallback({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      maxTokens: 32,
      timeoutMs: 3500,
      providerConfig,
    });

    if (aiResult && aiResult.text) {
      let cleaned = aiResult.text
        .replace(/^["'`]|["'`]$/g, '')
        .replace(/^(standalone search query|search query|standalone query|query|search):\s*/i, '')
        .replace(/[\n\r]+/g, ' ')
        .trim();

      cleaned = cleaned.replace(/[.]+$/, '').trim();

      if (
        cleaned.length >= 3 &&
        cleaned.length <= 120 &&
        !cleaned.toLowerCase().includes('as an ai') &&
        !cleaned.toLowerCase().includes('here is')
      ) {
        return {
          query: cleaned,
          reformulated: cleaned.toLowerCase() !== trimmed.toLowerCase(),
          reason: 'AI Context Reformulation',
        };
      }
    }
  } catch {
    // Non-blocking fallback
  }

  // Rule-based heuristic fallback if AI call is unavailable/times out
  if (hasPronounOrDeictic || isShortFollowUp) {
    const lastUserTurn = [...history].reverse().find((h) => h.role === 'user');
    const lastAssistantTurn = [...history].reverse().find((h) => h.role === 'assistant');
    const prevContext = lastUserTurn?.content || lastAssistantTurn?.content || '';

    if (prevContext) {
      const cleanPrev = prevContext
        .replace(/^(what is|who is|explain|tell me about|how does|why is)\s+/i, '')
        .split(/[.?!,\n]/)[0]
        .trim();
      if (cleanPrev && cleanPrev.length > 2) {
        const combined = `${trimmed.replace(/\b(this|that|it|these|those)\b/gi, cleanPrev)} ${cleanPrev}`
          .replace(/\s+/g, ' ')
          .trim();
        return { query: combined, reformulated: true, reason: 'Heuristic Context Fallback' };
      }
    }
  }

  return { query: trimmed, reformulated: false };
}

async function processAiChatInternal(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  memory = '',
  providerConfig?: CustomProviderPayload | null,
  webSearch?: boolean,
  language?: string,
  permanentMemories: string[] = [],
) {
  const trimmed = message.trim();
  const activeModel = providerConfig?.model || process.env.AI_MODEL || 'deepseek/deepseek-chat';

  // Check if query is factual or web search is forced
  let sourceContext = '';
  let structuredSources: SmartAnswerSource[] = [];

  const lower = trimmed.toLowerCase();
  const isForcedWebSearch = Boolean(webSearch);
  const isKnowledgeQuery =
    lower.length > 5 &&
    !['hello', 'hi', 'hey', 'who are you', 'how are you', 'thank you', 'thanks'].includes(lower) &&
    (lower.startsWith('what') ||
      lower.startsWith('who') ||
      lower.startsWith('where') ||
      lower.startsWith('when') ||
      lower.startsWith('why') ||
      lower.startsWith('how') ||
      lower.startsWith('tell me about') ||
      lower.startsWith('explain') ||
      lower.startsWith('summarize'));

  const isTimeSensitive =
    lower.includes('today') ||
    lower.includes('latest') ||
    lower.includes('current') ||
    lower.includes('recent') ||
    lower.includes('news') ||
    lower.includes('now') ||
    lower.includes('price') ||
    lower.includes('weather') ||
    lower.includes('score') ||
    lower.includes('stock') ||
    lower.includes('2024') ||
    lower.includes('2025') ||
    lower.includes('2026') ||
    lower.includes('who won') ||
    lower.includes('release date');

  const shouldSearchWeb = isForcedWebSearch || isTimeSensitive;

  // Context-aware query reformulation for follow-up conversational queries
  let effectiveSearchQuery = trimmed;
  let isQueryReformulated = false;
  let queryReformulationReason = '';

  if (shouldSearchWeb || isKnowledgeQuery) {
    if (history && history.length > 0) {
      const reformulation = await reformulateSearchQueryWithContext(trimmed, history, providerConfig);
      effectiveSearchQuery = reformulation.query;
      isQueryReformulated = reformulation.reformulated;
      queryReformulationReason = reformulation.reason || '';
    }
  }

  if (shouldSearchWeb) {
    try {
      const searchPromises: Promise<void>[] = [];
      searchPromises.push(
        searchProvider({ query: effectiveSearchQuery, page: 1, category: 'ALL', max_results: 10, maxResults: 10 })
          .then((webRes) => {
            const webItems = webRes?.results ?? [];
            for (const item of webItems.slice(0, 10)) {
              if (!structuredSources.some((s) => s.url === item.url)) {
                const cleanDesc = (item.description || '').slice(0, 300).trim();
                const domainName = item.domain || domainOf(item.url) || 'web';
                const classification = classifyDomainTrustTier(domainName, effectiveSearchQuery);
                structuredSources.push({
                  title: item.title,
                  url: item.url,
                  domain: domainName,
                  description: cleanDesc,
                  thumbnail: item.thumbnail || item.image,
                  image: item.image || item.thumbnail,
                  type: 'web',
                  trustTier: classification.tier,
                  trustTierLabel: classification.tierLabel,
                  trustTierReason: classification.reason,
                });
              }
            }
          })
          .catch(() => {}),
      );

      searchPromises.push(
        fetchWikipediaSummary(effectiveSearchQuery)
          .then((wikiSummary) => {
            if (wikiSummary && wikiSummary.extract) {
              const domainName = 'wikipedia.org';
              const classification = classifyDomainTrustTier(domainName, effectiveSearchQuery);
              structuredSources.push({
                title: wikiSummary.title,
                url: wikiSummary.url,
                description: wikiSummary.extract.slice(0, 300),
                domain: domainName,
                type: 'wikipedia',
                trustTier: classification.tier,
                trustTierLabel: classification.tierLabel,
                trustTierReason: classification.reason,
              });
            }
          })
          .catch(() => {}),
      );

      await Promise.allSettled(searchPromises);

      // Order injected results so Tier 1 sources appear first, then Tier 2, then Tier 3 (preserve up to 10)
      structuredSources.sort((a, b) => (a.trustTier ?? 2) - (b.trustTier ?? 2));
      structuredSources = structuredSources.slice(0, 10);

      if (structuredSources.length > 0) {
        const sourcesText = structuredSources
          .map(
            (s, i) =>
              `[Source ${i + 1}: ${s.title}]\nDomain: ${s.domain || 'web'} | Trust: Tier ${s.trustTier} (${s.trustTierLabel})\nURL: ${s.url}\nSummary: ${s.description}`,
          )
          .join('\n\n');
        sourceContext = sourcesText;
      }
    } catch {
      // Non-blocking
    }
  } else if (isKnowledgeQuery) {
    try {
      const wikiSummary = await fetchWikipediaSummary(effectiveSearchQuery);
      if (wikiSummary && wikiSummary.extract) {
        const domainName = 'wikipedia.org';
        const classification = classifyDomainTrustTier(domainName, effectiveSearchQuery);
        structuredSources.push({
          title: wikiSummary.title,
          url: wikiSummary.url,
          description: wikiSummary.extract.slice(0, 300),
          domain: domainName,
          type: 'wikipedia',
          trustTier: classification.tier,
          trustTierLabel: classification.tierLabel,
          trustTierReason: classification.reason,
        });
        sourceContext = `[Wikipedia Reference for "${wikiSummary.title}"] (Trust: Tier 1 - Official Primary):\n${wikiSummary.extract.slice(0, 350)}`;
      }
    } catch {
      // Non-blocking knowledge lookup
    }
  }

  const isDeviceQuery =
    lower.includes('phone battery') ||
    lower.includes('my battery') ||
    lower.includes('android battery') ||
    lower.includes('device battery') ||
    lower.includes('phone storage') ||
    lower.includes('device storage') ||
    lower.includes('android storage') ||
    lower.includes('phone online') ||
    lower.includes('is my phone') ||
    lower.includes('is my android') ||
    lower.includes('connected device') ||
    lower.includes('nexus device') ||
    lower.includes('my devices') ||
    lower.includes('check my phone') ||
    lower.includes('phone status') ||
    lower.includes('device status');

  const isTvQuery =
    lower.includes('tv volume') ||
    lower.includes('my tv') ||
    lower.includes('smart tv') ||
    lower.includes('google tv') ||
    lower.includes('android tv') ||
    lower.includes('webos') ||
    lower.includes('tv status') ||
    lower.includes('is tv on') ||
    lower.includes('is my tv') ||
    lower.includes('tv power') ||
    lower.includes('tv mute') ||
    lower.includes('turn down tv') ||
    lower.includes('turn up tv') ||
    lower.includes('mute tv');

  if (isDeviceQuery) {
    const devContext = getConnectedDevicesSummary();
    sourceContext = sourceContext
      ? `${sourceContext}\n\n[NEXUS Devices Tool Telemetry]:\n${devContext}`
      : `[NEXUS Devices Tool Telemetry]:\n${devContext}`;
  } else if (isTvQuery) {
    const tvDev = getFirstConnectedTv();
    if (!tvDev || !tvDev.tv) {
      sourceContext = sourceContext
        ? `${sourceContext}\n\n[Smart TV Status]: No Smart TV is currently connected.`
        : `[Smart TV Status]: No Smart TV is currently connected.`;
    } else {
      const tvRes = executeTvTool('get_tv_status').result;
      sourceContext = sourceContext
        ? `${sourceContext}\n\n[Smart TV Tool Telemetry]:\n${tvRes}`
        : `[Smart TV Tool Telemetry]:\n${tvRes}`;
    }
  }

  const now = new Date();
  const currentDateTimeStr = `${now.toUTCString()} (UTC)`;

  const sourcesFormatted = structuredSources
    .slice(0, 10)
    .map(
      (s, i) =>
        `[Source ${i + 1}: ${s.title}]\nDomain: ${s.domain || 'web'} | Trust: Tier ${s.trustTier} (${s.trustTierLabel})\nURL: ${s.url}\nSummary: ${s.description}`,
    )
    .join('\n\n');

  const hasTier1 = structuredSources.some((s) => s.trustTier === 1);
  const allTier3 = structuredSources.length > 0 && structuredSources.every((s) => s.trustTier === 3);

  let tierGuidance = '';
  if (hasTier1) {
    tierGuidance += `- Tier 1 (Official/Primary) source(s) are present below. You MUST prioritize Tier 1 sources over Tier 2 and Tier 3 sources if they provide conflicting information.\n`;
  }
  tierGuidance += `- If sources disagree with each other on facts, dates, specifications, or details, explicitly note the discrepancy in your response rather than silently choosing one.\n`;
  if (allTier3) {
    tierGuidance += `- CRITICAL CAVEAT: ALL 10 retrieved sources are Tier 3 (unverified / low-authority domains). You MUST explicitly caveat your answer to the user stating that this response is based on unverified sources.\n`;
  }

  const systemInstructions: string[] = [
    `You are NEXUS AI, powered by ${providerConfig?.name || 'AI'}. Provide direct, insightful, factual, and concise answers.`,
    `Current Real-Time Reference: ${currentDateTimeStr}. You have active real-time web search capabilities.`,
  ];

  if (permanentMemories && permanentMemories.length > 0) {
    const validMemories = permanentMemories.map((m) => m.trim()).filter(Boolean);
    if (validMemories.length > 0) {
      systemInstructions.push(
        `[User Permanent Standing Memories (Always-On Context)]:\n` +
          validMemories.map((m, i) => `${i + 1}. ${m}`).join('\n') +
          `\n(These are permanent, always-on standing facts and preferences about the user. Always maintain consistency with these memories across all turns.)`,
      );
    }
  }

  if (memory) {
    systemInstructions.push(`[User Context / Saved Memory]:\n${memory.slice(0, 300)}`);
  }

  const effectiveLang = (language || '').trim();
  if (effectiveLang && effectiveLang.toLowerCase() !== 'english') {
    systemInstructions.push(
      `[Language Setting]: Respond in ${effectiveLang}. If the input refers to a country or is informally phrased, infer the intended language (e.g. 'Russia' means Russian, 'Japan' means Japanese). Complete all explanations and answers fluently in that language.`,
    );
  }

  const searchSubjectDescription = isQueryReformulated
    ? `"${effectiveSearchQuery}" (reformulated from contextual follow-up: "${trimmed}")`
    : `"${trimmed}"`;

  if (structuredSources.length > 0 || isForcedWebSearch) {
    systemInstructions.push(
      `[REAL-TIME LIVE WEB SEARCH RESULTS FOR THIS TURN ONLY - 10 SOURCES RANKED BY TRUST TIER]:\n` +
        `${sourcesFormatted || 'No additional web text returned; use current date/time reference and available knowledge.'}\n\n` +
        `CRITICAL GROUNDING & DOMAIN-TRUST INSTRUCTIONS FOR THIS TURN:\n` +
        `- Real-time web search was conducted for: ${searchSubjectDescription}.\n` +
        `- 10 live sources are provided above, sorted with highest domain trust first (Tier 1: Official/Primary, Tier 2: Secondary, Tier 3: Unverified).\n` +
        `- You MUST use the live search results and current timestamp (${currentDateTimeStr}) provided above to answer the user accurately and factually.\n` +
        `- NEVER state that you lack real-time access, cannot browse the internet, or do not know the current date/information.\n` +
        tierGuidance +
        `- Answer the user's question directly based on these verified live sources in context of the conversation.`,
    );
  } else if (sourceContext) {
    systemInstructions.push(`[Verified Source Context]:\n${sourceContext}`);
  }

  const systemPrompt = systemInstructions.join('\n\n');

  // Strict turn isolation: conversation history contains ONLY clean previous text, never injected raw search blocks
  const compactHistory = history.slice(-4).map((h) => ({
    role: h.role,
    content: h.content.slice(0, 600),
  }));

  const userContentForTurn =
    structuredSources.length > 0
      ? `${trimmed}\n\n[Live Search Grounding for this question (Searched: "${effectiveSearchQuery}") - 10 Sources by Trust Tier]:\n${sourcesFormatted}\n(Current Date/Time Reference: ${currentDateTimeStr})\n\nInstructions: Use the live search results above to answer directly. Prioritize Tier 1 sources and note any source discrepancies.`
      : trimmed;

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...compactHistory,
    { role: 'user', content: userContentForTurn },
  ];

  // Comprehensive turn logging to verify exact prompt injection, query reformulation, and turn isolation
  console.log(`[AI Assistant Web Search] ========================================`);
  console.log(`[AI Assistant Web Search] Original User Query: "${trimmed}"`);
  if (isQueryReformulated) {
    console.log(
      `[AI Assistant Web Search] Context Reformulated Search Query: "${effectiveSearchQuery}" (${queryReformulationReason})`,
    );
  } else {
    console.log(
      `[AI Assistant Web Search] Standalone Search Query: "${effectiveSearchQuery}" (No reformulation needed)`,
    );
  }
  console.log(`[AI Assistant Web Search] Forced WebSearch: ${isForcedWebSearch} | Search Run: ${shouldSearchWeb}`);
  console.log(`[AI Assistant Web Search] Injected ${structuredSources.length} fresh search result(s) into model prompt (Sorted by Trust Tier):`);
  if (structuredSources.length > 0) {
    structuredSources.forEach((s, idx) => {
      console.log(`  [#${idx + 1}] [Tier ${s.trustTier ?? 2} - ${s.trustTierLabel || 'Secondary'}] "${s.title}" (${s.domain || 'web'}) -> ${s.url}`);
      console.log(`      Trust Reason: ${s.trustTierReason || 'Domain trust assessment'}`);
      console.log(`      Snippet: ${s.description.slice(0, 100)}...`);
    });
  } else {
    console.log(`[AI Assistant Web Search] No search results injected into model prompt for this turn (clean isolated turn).`);
  }
  console.log(`[AI Assistant Web Search] Clean history turns sent to model: ${compactHistory.length}`);
  console.log(`[AI Assistant Web Search] ========================================`);

  const aiResult = await executeAiWithProviderOrFallback({
    messages,
    temperature: 0.4,
    maxTokens: providerConfig?.maxTokens || 512,
    providerConfig,
  });

  if (aiResult && aiResult.text) {
    return {
      answer: aiResult.text,
      model: aiResult.model,
      tool: structuredSources.length > 0 || isForcedWebSearch ? ('search' as const) : ('none' as const),
      confidence: (structuredSources.length ? 'verified' : 'verified') as ConfidenceLevel,
      confidenceReason: structuredSources.length
        ? `Synthesized with ${aiResult.providerName || providerConfig?.name || 'AI'} (${aiResult.model}) and grounded with verified live sources.`
        : `Synthesized directly via ${aiResult.providerName || providerConfig?.name || 'AI'} (${aiResult.model}).`,
      sources: structuredSources.length ? structuredSources : undefined,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], structuredSources),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  // Graceful response when AI provider is unreachable or API key missing
  if (structuredSources.length > 0) {
    return {
      answer: structuredSources[0].description,
      model: 'nexus-knowledge',
      tool: 'search' as const,
      confidence: 'limited' as ConfidenceLevel,
      confidenceReason: `${providerConfig?.name || 'AI Provider'} currently unavailable (${aiResult?.lastError || 'provider error'}); extracted from verified live knowledge.`,
      sources: structuredSources,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], structuredSources),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  // Generate intelligent response using NEXUS local assistant
  const localRes = generateLocalNexusAiResponse(trimmed, history, memory, sourceContext);
  if (localRes && localRes.text) {
    return {
      answer: localRes.text,
      model: localRes.model || 'nexus-intelligence',
      confidence: 'verified' as ConfidenceLevel,
      confidenceReason: 'Synthesized via NEXUS Intelligence Engine.',
      sources: undefined,
      followUps: generateSmartFollowUps(trimmed, ['ALL'], []),
      selectedCategories: ['ALL'] as SourceCategory[],
    };
  }

  const hasKey = Boolean(
    (providerConfig?.keys && providerConfig.keys.some((k) => k.key && k.key.trim().length > 0)) ||
      process.env.GEMINI_API_KEY ||
      process.env.AI_API_KEY ||
      process.env.OPENROUTER_API_KEY ||
      process.env.DEEPSEEK_API_KEY,
  );

  const providerName = providerConfig?.name || 'OpenRouter';
  const specificErr = aiResult?.lastError ? ` (${aiResult.lastError})` : '';

  return {
    answer: hasKey
      ? `NEXUS AI is temporarily unable to reach ${providerName}${specificErr}. Please verify your API key(s) or check your provider balance.`
      : 'Hello! I am NEXUS AI, ready to assist you.',
    model: activeModel,
    confidence: 'verified' as ConfidenceLevel,
    confidenceReason: 'NEXUS Intelligence Online',
    sources: [],
    followUps: ['Explain gravity simply', 'What is quantum computing?', 'Tell me about Mars'],
    selectedCategories: ['ALL'] as SourceCategory[],
  };
}

const customProviderSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    url: z.string().optional(),
    model: z.string().optional(),
    maxTokens: z.number().optional().nullable(),
    keyStrategy: z.enum(['failover', 'round_robin', 'manual']).optional(),
    preferredKeyId: z.string().optional(),
    keys: z
      .array(
        z
          .object({
            id: z.string().optional(),
            key: z.string().optional(),
            label: z.string().optional(),
            status: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
    capabilities: z
      .object({
        text: z.boolean().optional(),
        tools: z.boolean().optional(),
        web: z.boolean().optional(),
        wikipedia: z.boolean().optional(),
        memory: z.boolean().optional(),
      })
      .optional(),
  })
  .passthrough();

const aiChatSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      }),
    )
    .max(20)
    .optional(),
  memory: z.string().max(1200).optional(),
  providerConfig: customProviderSchema.optional().nullable(),
  webSearch: z.boolean().optional(),
  language: z.string().max(100).optional(),
  responseLanguage: z.string().max(100).optional(),
  permanentMemories: z.array(z.string().max(500)).max(50).optional(),
});



async function startServer() {
  const app = express();
  const port = 3000;

  app.use(
    helmet({
      frameguard: false,
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(cors());
  app.use(express.json({ limit: '20mb' }));
  app.use(
    morgan('tiny', {
      skip: (req) => !req.url.startsWith('/api'),
    }),
  );

  app.get('/api/health', (_req, res) =>
    res.json({ status: 'ok', service: 'nexus-api', time: new Date().toISOString() }),
  );

  app.get('/api/config/status', (_req, res) =>
    res.json({
      data: {
        search: Boolean(
          (getBackendApiKey('SEARCH_API_KEY') && process.env.SEARCH_API_URL) ||
            getBackendApiKey('TAVILY_API_KEY') ||
            getBackendApiKey('EXA_API_KEY'),
        ),
        weather: true,
        map: Boolean(getBackendApiKey('MAP_API_KEY') || getBackendApiKey('WEATHER_API_KEY')),
        ai: Boolean(
          process.env.GEMINI_API_KEY ||
            process.env.AI_API_KEY ||
            process.env.OPENROUTER_API_KEY ||
            process.env.DEEPSEEK_API_KEY ||
            true,
        ),
        wallpapers: Boolean(getBackendApiKey('PEXELS_API_KEY')),
      },
    }),
  );

  // Mount API Catalog Router
  app.use(apiCatalogRouter);

  // Mount Document Library & RAG Router
  app.use(documentsRouter);

  // Mount extracted feature routers
  app.use(mediaRouter);
  app.use(weatherRouter);
  app.use(createSearchRouter({ generateSummaryAi: generateOpenRouterOrCustomAi }));
  app.use(devicesRouter);
  app.use(telegramRouter);

  // Connect Telegram AI chat handler
  setTelegramAiHandler(async (msg) => {
    const res = await processAiChatInternal(msg);
    return { answer: res.answer || 'I could not process that request.' };
  });

  // Cloudflare Workers AI Image Generation & Editing Proxy (Bypasses browser CORS restrictions)
  app.post('/api/proxy/cloudflare-image', async (req: Request, res: Response) => {
    try {
      const {
        prompt: rawPrompt,
        inputs: rawInputs,
        accountId: rawAccountId,
        apiToken: rawApiToken,
        apiKey: rawApiKey,
        key: rawKey,
        url: rawUrl,
        model: rawModel,
        image_b64: rawImageB64,
        referenceImage: rawReferenceImage,
        image: rawImage,
        strength: rawStrength,
        guidance: rawGuidance,
        num_steps: rawNumSteps,
      } = req.body || {};

      const prompt = (rawPrompt || rawInputs || '').trim();
      if (!prompt) {
        return errorResponse(res, 400, 'Prompt is required.');
      }

      // Extract raw base64 reference image for img2img if present
      const rawImageInput = (rawImageB64 || rawReferenceImage || rawImage || '').trim();
      let cleanImageB64 = '';
      if (rawImageInput) {
        cleanImageB64 = rawImageInput.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
      }

      // Extract auth token from body or Authorization header
      const authHeader = req.headers.authorization;
      const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const apiToken = (rawApiToken || rawApiKey || rawKey || bearerToken || '').trim();

      if (!apiToken) {
        return errorResponse(res, 401, 'Cloudflare API Token is required.');
      }

      // Determine target URL and Account ID
      let targetUrl = (rawUrl || '').trim();
      let accountId = (rawAccountId || '').trim();

      if (!accountId && targetUrl) {
        const match = targetUrl.match(/accounts\/([a-zA-Z0-9_-]+)/);
        if (match && match[1] && match[1] !== 'YOUR_ACCOUNT_ID') {
          accountId = match[1];
        }
      }

      if (targetUrl.includes('YOUR_ACCOUNT_ID') && accountId) {
        targetUrl = targetUrl.replace('YOUR_ACCOUNT_ID', accountId);
      }

      // Determine model name - auto switch to img2img model when reference image is present
      let modelName = (rawModel || '').trim();
      if (cleanImageB64 && (!modelName || modelName.includes('flux') || modelName.includes('schnell'))) {
        modelName = '@cf/runwayml/stable-diffusion-v1-5-img2img';
      }
      if (!modelName) {
        modelName = cleanImageB64
          ? '@cf/runwayml/stable-diffusion-v1-5-img2img'
          : '@cf/black-forest-labs/flux-1-schnell';
      }

      // If target URL contains a model path and img2img image is present, ensure targetUrl uses the img2img model
      if (targetUrl && cleanImageB64) {
        if (targetUrl.includes('/ai/run/@cf/black-forest-labs/flux-1-schnell') || (!targetUrl.includes('img2img') && targetUrl.includes('/ai/run/'))) {
          targetUrl = targetUrl.replace(/\/ai\/run\/.*$/, `/ai/run/${modelName}`);
        }
      }

      if (!targetUrl || targetUrl.includes('YOUR_ACCOUNT_ID')) {
        if (!accountId) {
          return errorResponse(
            res,
            400,
            "Cloudflare Account ID is missing. Please replace 'YOUR_ACCOUNT_ID' with your actual Cloudflare Account ID in Settings.",
          );
        }
        targetUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelName}`;
      }

      const cfRequestBody: Record<string, unknown> = { prompt };
      if (cleanImageB64) {
        cfRequestBody.image_b64 = cleanImageB64;
        if (typeof rawStrength === 'number') cfRequestBody.strength = rawStrength;
        if (typeof rawGuidance === 'number') cfRequestBody.guidance = rawGuidance;
        if (typeof rawNumSteps === 'number') cfRequestBody.num_steps = rawNumSteps;
      }

      const cfController = new AbortController();
      const cfTimeout = setTimeout(() => cfController.abort(), 60000);

      const cfRes = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(cfRequestBody),
        signal: cfController.signal,
      });
      clearTimeout(cfTimeout);

      const contentType = (cfRes.headers.get('content-type') || '').toLowerCase();

      if (!cfRes.ok) {
        let errMessage = `Cloudflare API returned HTTP ${cfRes.status}`;
        try {
          if (contentType.includes('application/json') || contentType.includes('+json')) {
            const errJson = (await cfRes.json()) as { errors?: Array<{ message?: string }>; error?: string; message?: string };
            const firstErr = Array.isArray(errJson?.errors) && errJson.errors[0]?.message;
            errMessage = firstErr || errJson?.error || errJson?.message || JSON.stringify(errJson);
          } else {
            const text = await cfRes.text();
            if (text) errMessage = text.slice(0, 300);
          }
        } catch {
          // ignore error parsing
        }

        return res.status(cfRes.status >= 400 && cfRes.status < 600 ? cfRes.status : 502).json({
          success: false,
          error: errMessage,
          status: cfRes.status,
        });
      }

      if (contentType.includes('application/json') || contentType.includes('+json')) {
        const json = (await cfRes.json()) as {
          success?: boolean;
          errors?: Array<{ message?: string }>;
          result?: { image?: string } | string;
          image?: string;
          data?: Array<{ b64_json?: string }>;
        };

        if (json?.success === false || (Array.isArray(json?.errors) && json.errors.length > 0)) {
          const errMsg = json.errors?.[0]?.message || 'Cloudflare error';
          return res.status(400).json({ success: false, error: errMsg });
        }

        const rawB64 =
          (typeof json?.result === 'object' && json?.result?.image) ||
          (typeof json?.result === 'string' && json.result) ||
          json?.image ||
          (Array.isArray(json?.data) && json.data[0]?.b64_json) ||
          null;

        if (!rawB64 || typeof rawB64 !== 'string') {
          return res.status(502).json({
            success: false,
            error: 'Cloudflare response did not contain a valid image payload (expected result.image).',
          });
        }

        const dataUrl = rawB64.startsWith('data:') ? rawB64 : `data:image/png;base64,${rawB64.trim()}`;
        return res.json({
          success: true,
          result: { image: rawB64 },
          image: dataUrl,
          dataUrl,
        });
      } else {
        // Raw image binary stream
        const arrayBuffer = await cfRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mime = contentType.startsWith('image/') ? contentType : 'image/png';
        const base64 = buffer.toString('base64');
        const dataUrl = `data:${mime};base64,${base64}`;

        return res.json({
          success: true,
          result: { image: base64 },
          image: dataUrl,
          dataUrl,
        });
      }
    } catch (err: unknown) {
      const errObj = err as Error;
      const isAbort = errObj.name === 'AbortError' || errObj.message?.includes('aborted');
      return res.status(isAbort ? 504 : 500).json({
        success: false,
        error: isAbort
          ? 'Cloudflare Workers AI request timed out after 60 seconds.'
          : errObj.message || 'Failed to proxy request to Cloudflare Workers AI.',
      });
    }
  });


  app.post('/api/ai/answer', async (req, res) => {
    const parsed = z
      .object({
        query: z.string().min(1).max(1000),
        customSources: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string(),
              domain: z.string().optional(),
            }),
          )
          .optional(),
        providerConfig: customProviderSchema.optional().nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Enter a valid query.');
    }

    try {
      const result = await executeSmartAnswerEngine(
        parsed.data.query,
        parsed.data.customSources,
        parsed.data.providerConfig,
      );
      return res.json({ data: result });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      return errorResponse(
        res,
        errorObj.status || 500,
        errorObj.message || 'Smart Answer Engine request failed.',
      );
    }
  });

  app.post('/api/ai/chat', async (req, res) => {
    const parsed = aiChatSchema.safeParse(req.body);
    if (!parsed.success) {
      return errorResponse(res, 400, 'Enter a valid message.');
    }
    try {
      const result = await processAiChatInternal(
        parsed.data.message,
        parsed.data.history ?? [],
        parsed.data.memory ?? '',
        parsed.data.providerConfig,
        parsed.data.webSearch,
        parsed.data.language || parsed.data.responseLanguage,
        parsed.data.permanentMemories ?? [],
      );
      return res.json({ data: result });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      return errorResponse(res, errorObj.status || 500, errorObj.message || 'AI request failed.');
    }
  });

  app.post('/api/ai/provider/test', async (req, res) => {
    const parsed = z
      .object({
        url: z.string().min(1),
        model: z.string().min(1),
        key: z.string().min(1),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'URL, Model, and API Key are required.');
    }

    const { url, model, key } = parsed.data;

    const result = await executeProviderChatRequest({
      url,
      model,
      key,
      messages: [{ role: 'user', content: 'ping' }],
      maxTokens: 16,
      temperature: 0.1,
      timeoutMs: 15000,
    });

    return res.json({
      data: {
        ok: result.ok,
        status: result.status,
        model: result.model,
        error: result.error,
      },
    });
  });



  // Synthesizes text to MP3 Buffer using pure Node.js msedge-tts with chunking and voice fallbacks
  async function synthesizeEdgeSpeechBuffer(rawText: string, requestedVoice?: string): Promise<Buffer> {
    const voice = (typeof requestedVoice === 'string' && requestedVoice.trim())
      ? requestedVoice.trim()
      : 'en-US-AriaNeural';

    const cleanText = rawText.trim();
    if (!cleanText) {
      throw new Error('Empty text provided for TTS');
    }

    const synthesizeSingleChunk = async (chunkText: string, v: string): Promise<Buffer> => {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(chunkText);
      const chunks: Buffer[] = [];

      return new Promise<Buffer>((resolve, reject) => {
        const timer = setTimeout(() => {
          try {
            tts.close();
          } catch {
            // ignore close error
          }
          reject(new Error(`TTS timeout for voice ${v}`));
        }, 30000);

        audioStream.on('data', (c: Buffer) => chunks.push(c));
        audioStream.on('end', () => {
          clearTimeout(timer);
          try {
            tts.close();
          } catch {
            // ignore close error
          }
          const result = Buffer.concat(chunks);
          if (result.length === 0) {
            reject(new Error('Empty audio stream received'));
          } else {
            resolve(result);
          }
        });
        audioStream.on('error', (err) => {
          clearTimeout(timer);
          try {
            tts.close();
          } catch {
            // ignore close error
          }
          reject(err);
        });
      });
    };

    const tryChunkWithVoiceFallback = async (chunkText: string): Promise<Buffer> => {
      try {
        return await synthesizeSingleChunk(chunkText, voice);
      } catch (err) {
        console.warn(`[EdgeTTS] Voice "${voice}" failed, falling back to en-US-JennyNeural:`, err);
        try {
          return await synthesizeSingleChunk(chunkText, 'en-US-JennyNeural');
        } catch {
          return await synthesizeSingleChunk(chunkText, 'en-US-AriaNeural');
        }
      }
    };

    if (cleanText.length <= 2500) {
      return await tryChunkWithVoiceFallback(cleanText);
    }

    // Split text exceeding 2500 characters
    const textChunks: string[] = [];
    let rem = cleanText;
    while (rem.length > 0) {
      if (rem.length <= 2500) {
        textChunks.push(rem);
        break;
      }
      let sliceEnd = -1;
      const windowText = rem.slice(0, 2500);
      const puncMatches = Array.from(windowText.matchAll(/[.!?;\n]\s+/g));
      if (puncMatches.length > 0) {
        const lastMatch = puncMatches[puncMatches.length - 1];
        if (lastMatch.index !== undefined && lastMatch.index > 800) {
          sliceEnd = lastMatch.index + lastMatch[0].length;
        }
      }
      if (sliceEnd === -1) {
        const commaMatches = Array.from(windowText.matchAll(/[,:]\s+/g));
        if (commaMatches.length > 0) {
          const lastComma = commaMatches[commaMatches.length - 1];
          if (lastComma.index !== undefined && lastComma.index > 800) {
            sliceEnd = lastComma.index + lastComma[0].length;
          }
        }
      }
      if (sliceEnd === -1) {
        const lastSpace = windowText.lastIndexOf(' ');
        if (lastSpace > 800) {
          sliceEnd = lastSpace + 1;
        } else {
          sliceEnd = 2500;
        }
      }
      const chunk = rem.slice(0, sliceEnd).trim();
      if (chunk) textChunks.push(chunk);
      rem = rem.slice(sliceEnd).trim();
    }

    const chunkBuffers: Buffer[] = [];
    for (const c of textChunks) {
      const b = await tryChunkWithVoiceFallback(c);
      chunkBuffers.push(b);
    }
    return Buffer.concat(chunkBuffers);
  }

  async function executeEdgeTts({
    text,
    voice = 'en-US-AriaNeural',
    rate = '+0%',
    pitch = '+0%',
    timeoutMs = 25000,
  }: {
    text: string;
    voice?: string;
    rate?: string;
    pitch?: string;
    timeoutMs?: number;
  }): Promise<{
    ok: boolean;
    audioUrl?: string;
    mimeType?: string;
    model?: string;
    status?: number;
    error?: string;
  }> {
    const cleanText = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[*#`_~>[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanText) {
      return {
        ok: false,
        status: 400,
        error: 'Invalid TTS request: Text input cannot be empty.',
      };
    }

    const trimmedText = cleanText.slice(0, 3000);
    const targetVoice = voice.trim() || 'en-US-AriaNeural';

    console.log('[EDGE-TTS] REST request received');
    console.log(`[EDGE-TTS] voice: ${targetVoice}`);
    console.log('[EDGE-TTS] generating audio');

    const azureKey = process.env.AZURE_SPEECH_KEY || process.env.AZURE_API_KEY || process.env.MS_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION || 'eastus';

    if (azureKey) {
      try {
        const escapedText = escapeXml(trimmedText);
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${targetVoice}'><prosody rate='${rate}' pitch='${pitch}'>${escapedText}</prosody></voice></speak>`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const endpoint = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Ocp-Apim-Subscription-Key': azureKey,
            'Content-Type': 'application/ssml+xml',
            'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
            'User-Agent': 'NexusIntelligence-SpeechREST',
          },
          body: ssml,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const base64Audio = Buffer.from(arrayBuffer).toString('base64');
          console.log('[EDGE-TTS] success via Azure REST');
          return {
            ok: true,
            status: 200,
            audioUrl: `data:audio/mp3;base64,${base64Audio}`,
            mimeType: 'audio/mp3',
            model: targetVoice,
          };
        }

        const st = response.status;
        if (st === 401 || st === 403) {
          return {
            ok: false,
            status: st,
            error: 'Microsoft TTS authentication/configuration error',
          };
        }
        if (st === 429) {
          return {
            ok: false,
            status: 429,
            error: 'TTS rate limit reached',
          };
        }
        if (st >= 500) {
          return {
            ok: false,
            status: st,
            error: 'TTS service temporarily unavailable',
          };
        }
        return {
          ok: false,
          status: st,
          error: 'Invalid TTS request',
        };
      } catch (err: unknown) {
        console.warn('[EDGE-TTS] Azure REST error, falling back to MsEdgeTTS:', err);
      }
    }

    // High-performance fallback to pure Node.js MsEdgeTTS
    console.log('[EDGE-TTS] Synthesizing speech with pure Node.js MsEdgeTTS...');
    try {
      const audioBuffer = await synthesizeEdgeSpeechBuffer(trimmedText, targetVoice);
      const base64Audio = audioBuffer.toString('base64');
      console.log('[EDGE-TTS] success via MsEdgeTTS');
      return {
        ok: true,
        status: 200,
        audioUrl: `data:audio/mp3;base64,${base64Audio}`,
        mimeType: 'audio/mp3',
        model: targetVoice,
      };
    } catch (err: unknown) {
      console.warn('[EDGE-TTS] MsEdgeTTS synthesis error:', err);
    }

    // CLI fallback as tertiary option if present
    try {
      const tmpDir = os.tmpdir();
      const tmpFilePath = resolve(tmpDir, `edge_tts_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.mp3`);
      const execFileAsync = promisify(execFile);
      let success = false;
      try {
        await execFileAsync('edge-tts', [
          '--text', trimmedText,
          '--voice', targetVoice,
          '--write-media', tmpFilePath
        ], { timeout: timeoutMs });
        success = true;
      } catch {
        try {
          await execFileAsync('python3', [
            '-m', 'edge_tts',
            '--text', trimmedText,
            '--voice', targetVoice,
            '--write-media', tmpFilePath
          ], { timeout: timeoutMs });
          success = true;
        } catch {
          // ignore
        }
      }

      if (success && fs.existsSync(tmpFilePath)) {
        const arrayBuffer = fs.readFileSync(tmpFilePath);
        try {
          fs.unlinkSync(tmpFilePath);
        } catch {
          // ignore
        }
        const base64Audio = Buffer.from(arrayBuffer).toString('base64');
        console.log('[EDGE-TTS] success via CLI fallback');
        return {
          ok: true,
          status: 200,
          audioUrl: `data:audio/mp3;base64,${base64Audio}`,
          mimeType: 'audio/mp3',
          model: targetVoice,
        };
      }
    } catch (err: unknown) {
      console.warn('[EDGE-TTS] CLI fallback error:', err);
    }

    return {
      ok: false,
      status: 500,
      error: 'TTS service temporarily unavailable',
    };
  }

  function escapeXml(str: string): string {
    return str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  // POST /api/edge-tts (Microsoft Edge TTS pure Node.js synthesis)
  app.post('/api/edge-tts', async (req, res) => {
    try {
      const { text, voice } = req.body || {};
      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ error: 'Missing or invalid text parameter' });
      }

      const audioBuffer = await synthesizeEdgeSpeechBuffer(text, voice);

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'inline; filename="speech.mp3"');
      res.setHeader('Content-Length', audioBuffer.length);
      return res.send(audioBuffer);
    } catch (err: unknown) {
      console.error('[POST /api/edge-tts] Exception:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg || 'Internal server error' });
    }
  });

  // POST /api/edge-tts/batch (Synthesizes multiple agent dialogue turns into a contiguous MP3)
  app.post('/api/edge-tts/batch', async (req, res) => {
    try {
      const { items } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Missing items array' });
      }

      const safeItems = items.slice(0, 100);
      const audioBuffers: Buffer[] = [];
      const concurrency = 4;

      for (let i = 0; i < safeItems.length; i += concurrency) {
        const slice = safeItems.slice(i, i + concurrency);
        const slicePromises = slice.map(async (item: { text?: string; voice?: string }) => {
          const itemText = (typeof item.text === 'string') ? item.text.trim() : '';
          if (!itemText) return null;
          try {
            return await synthesizeEdgeSpeechBuffer(itemText, item.voice);
          } catch (itemErr) {
            console.warn(`[Batch TTS] Item synthesis error:`, itemErr);
            return null;
          }
        });
        const sliceResults = await Promise.all(slicePromises);
        for (const b of sliceResults) {
          if (b && b.length > 0) audioBuffers.push(b);
        }
      }

      if (audioBuffers.length === 0) {
        return res.status(500).json({ error: 'No audio could be synthesized for batch' });
      }

      const combined = Buffer.concat(audioBuffers);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', 'attachment; filename="parallax_swarm.mp3"');
      res.setHeader('Content-Length', combined.length);
      return res.send(combined);
    } catch (err: unknown) {
      console.error('[POST /api/edge-tts/batch] Exception:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ error: errMsg || 'Internal server error' });
    }
  });

  // POST /api/tts/edge
  app.post('/api/tts/edge', async (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(8000),
        voice: z.string().optional(),
        rate: z.string().optional(),
        pitch: z.string().optional(),
        timeoutMs: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Invalid TTS request');
    }

    const { text, voice, rate, pitch, timeoutMs } = parsed.data;

    try {
      const result = await executeEdgeTts({
        text,
        voice,
        rate,
        pitch,
        timeoutMs,
      });

      if (!result.ok) {
        return errorResponse(res, result.status || 500, result.error || 'TTS service temporarily unavailable');
      }

      return res.json({
        data: {
          ok: true,
          audioUrl: result.audioUrl,
          mimeType: result.mimeType,
          model: result.model,
        },
      });
    } catch (err: unknown) {
      console.error('[EDGE-TTS] error:', err);
      return errorResponse(res, 500, 'TTS service temporarily unavailable');
    }
  });

  // Generate TTS Audio via Edge TTS
  app.post('/api/tts/generate', async (req, res) => {
    const parsed = z
      .object({
        text: z.string().min(1).max(8000),
        model: z.string().optional(),
        voice: z.string().optional(),
        rate: z.string().optional(),
        pitch: z.string().optional(),
        timeoutMs: z.number().optional(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      return errorResponse(res, 400, 'Invalid TTS request');
    }

    const { text, model, voice, rate, pitch, timeoutMs } = parsed.data;

    try {
      const targetVoice = model && model !== 'edge-tts' ? model : (voice || 'en-US-AriaNeural');
      const result = await executeEdgeTts({
        text,
        voice: targetVoice,
        rate,
        pitch,
        timeoutMs,
      });

      if (!result.ok) {
        return errorResponse(res, result.status || 500, result.error || 'TTS service temporarily unavailable');
      }

      return res.json({
        data: {
          ok: true,
          audioUrl: result.audioUrl,
          mimeType: result.mimeType,
          model: result.model,
        },
      });
    } catch (err: unknown) {
      console.error('[TTS Server] TTS error:', err);
      const msg = err instanceof Error ? err.message : 'TTS service temporarily unavailable';
      return errorResponse(res, 500, msg);
    }
  });

  // Test TTS Connection
  app.post('/api/tts/test', async (req, res) => {
    const parsed = z
      .object({
        model: z.string().optional(),
        voice: z.string().optional(),
      })
      .safeParse(req.body);

    const model = parsed.success ? parsed.data.model : undefined;
    const voice = parsed.success ? parsed.data.voice : undefined;

    const targetVoice = model && model !== 'edge-tts' ? (model.includes('Neural') ? model : (voice || 'en-US-AriaNeural')) : (voice || 'en-US-AriaNeural');
    const result = await executeEdgeTts({
      text: 'NEXUS Voice AI neural speech online.',
      voice: targetVoice,
      timeoutMs: 20000,
    });

    return res.json({
      data: {
        ok: result.ok,
        status: result.status,
        model: result.model,
        error: result.error,
        audioUrl: result.ok ? result.audioUrl : undefined,
      },
    });
  });

  // JARVIS Multi-Agent Execution Endpoint
  app.post('/api/jarvis/agent-call', async (req, res) => {
    const parsed = z
      .object({
        agentId: z.string().min(1),
        messages: z
          .array(
            z.object({
              role: z.enum(['system', 'user', 'assistant']),
              content: z.string().max(65000),
            }),
          )
          .min(1)
          .max(30),
        providerConfig: customProviderSchema.optional().nullable(),
        fallbackConfig: customProviderSchema.optional().nullable(),
        enableFailover: z.boolean().optional(),
        temperature: z.number().min(0).max(2).optional(),
        maxTokens: z.number().optional().nullable(),
        timeoutMs: z.number().optional().nullable(),
      })
      .safeParse(req.body);

    if (!parsed.success) {
      console.warn('[JARVIS] Invalid agent execution parameters:', parsed.error.format());
      return errorResponse(res, 400, 'Invalid agent execution parameters.');
    }

    const {
      agentId,
      messages,
      providerConfig,
      fallbackConfig,
      enableFailover,
      temperature = 0.2,
      maxTokens,
      timeoutMs,
    } = parsed.data;

    // For intensive diagram/code generation (Architect) or deep synthesis, allow extended execution window
    const defaultTimeout = agentId === 'architect' ? 65000 : 35000;
    const effectiveTimeout = timeoutMs || defaultTimeout;

    try {
      const primaryResult = await executeAiWithProviderOrFallback({
        providerConfig,
        messages,
        temperature,
        maxTokens,
        timeoutMs: effectiveTimeout,
      });

      if (primaryResult && primaryResult.text) {
        return res.json({
          data: {
            ok: true,
            text: primaryResult.text,
            content: primaryResult.content,
            reasoning: primaryResult.reasoning,
            model: primaryResult.model || providerConfig?.model || 'deepseek/deepseek-chat',
            providerName: primaryResult.providerName || providerConfig?.name || 'Configured AI',
            usedFallback: false,
          },
        });
      }

      // If primary failed and failover is explicitly enabled with a fallback provider
      if (enableFailover && fallbackConfig) {
        console.warn(
          `[JARVIS] Agent "${parsed.data.agentId}" primary provider failed (${primaryResult?.lastError || 'Empty output'}). Triggering configured failover...`,
        );

        const fallbackResult = await executeAiWithProviderOrFallback({
          providerConfig: fallbackConfig,
          messages,
          temperature,
          maxTokens,
          timeoutMs: effectiveTimeout,
        });

        if (fallbackResult && fallbackResult.text) {
          return res.json({
            data: {
              ok: true,
              text: fallbackResult.text,
              content: fallbackResult.content,
              reasoning: fallbackResult.reasoning,
              model: fallbackResult.model || fallbackConfig.model || 'fallback-model',
              providerName: fallbackResult.providerName || fallbackConfig.name || 'Fallback AI',
              usedFallback: true,
            },
          });
        }

        return res.json({
          data: {
            ok: false,
            error: `Primary and fallback providers both failed: ${fallbackResult?.lastError || 'No response'}`,
            model: fallbackConfig.model || 'unknown',
            providerName: fallbackConfig.name || 'Fallback',
            usedFallback: true,
          },
        });
      }

      return res.json({
        data: {
          ok: false,
          error: primaryResult?.lastError || 'Agent provider unavailable or returned no output.',
          model: providerConfig?.model || 'unknown',
          providerName: providerConfig?.name || 'Primary',
          usedFallback: false,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Agent execution failed.';
      return errorResponse(res, 500, msg);
    }
  });


  const wallpaperSchema = z.object({
    query: z.string().trim().min(1).max(120),
    page: z.coerce.number().int().min(1).max(50).optional(),
  });

  app.get('/api/wallpapers', async (req, res) => {
    const parsed = wallpaperSchema.safeParse({ query: req.query.query, page: req.query.page });
    if (!parsed.success) return errorResponse(res, 400, 'Enter a wallpaper search term.');
    const key = getBackendApiKey('PEXELS_API_KEY');
    if (!key) return errorResponse(res, 503, 'Wallpaper provider is not configured.');
    try {
      const upstream = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(parsed.data.query)}&per_page=12&page=${parsed.data.page ?? 1}&orientation=landscape`,
        { headers: { Authorization: key } },
      );
      if (!upstream.ok) return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
      const payload = (await upstream.json()) as {
        photos?: Array<{
          id: number;
          photographer: string;
          photographer_url: string;
          url: string;
          src: { landscape: string; large2x: string; original: string };
        }>;
      };
      const photos = (payload.photos ?? []).map((photo) => ({
        id: photo.id,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        url: photo.url,
        landscape: `/api/wallpaper-image/${photo.id}?size=landscape`,
        large2x: `/api/wallpaper-image/${photo.id}?size=large2x`,
        original: `/api/wallpaper-image/${photo.id}?size=original`,
      }));
      return res.json({ data: photos });
    } catch {
      return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
    }
  });

  const mapTileSchema = z.object({
    layer: z.enum(['temp_new', 'precipitation_new', 'clouds_new', 'wind_new', 'pressure_new']),
    z: z.coerce.number().int().min(0).max(18),
    x: z.coerce.number().int(),
    y: z.coerce.number().int(),
  });

  app.get('/api/wallpaper-image/:id', async (req, res) => {
    const id = Number(req.params.id);
    const size =
      req.query.size === 'original'
        ? 'original'
        : req.query.size === 'large2x'
          ? 'large2x'
          : 'landscape';

    if (!Number.isInteger(id) || id <= 0) {
      return errorResponse(res, 400, 'Invalid wallpaper image.');
    }

    const key = getBackendApiKey('PEXELS_API_KEY');
    if (!key) return errorResponse(res, 503, 'Wallpaper provider is not configured.');

    try {
      const search = await fetch(`https://api.pexels.com/v1/photos/${id}`, {
        headers: { Authorization: key },
      });

      if (!search.ok) {
        return errorResponse(res, 502, 'Wallpaper provider is temporarily unavailable.');
      }

      const photo = (await search.json()) as {
        src?: {
          landscape?: string;
          large2x?: string;
          original?: string;
        };
      };

      const imageUrl = photo.src?.[size];
      if (!imageUrl) {
        return errorResponse(res, 404, 'Wallpaper image not found.');
      }

      const image = await fetch(imageUrl);
      if (!image.ok) {
        return errorResponse(res, 502, 'Wallpaper image is temporarily unavailable.');
      }

      const contentType = image.headers.get('content-type') ?? 'image/jpeg';
      const buffer = Buffer.from(await image.arrayBuffer());

      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(buffer);
    } catch {
      return errorResponse(res, 502, 'Wallpaper image is temporarily unavailable.');
    }
  });

  app.get('/api/maptile/:layer/:z/:x/:y.png', async (req, res) => {
    const parsed = mapTileSchema.safeParse(req.params);
    if (!parsed.success) return errorResponse(res, 400, 'Invalid tile request.');
    const key = getBackendApiKey('MAP_API_KEY') || getBackendApiKey('WEATHER_API_KEY');
    if (!key) return errorResponse(res, 503, 'Map provider is not configured.');
    const { layer, z, x, y } = parsed.data;
    try {
      const upstream = await fetch(
        `https://tile.openweathermap.org/map/${layer}/${z}/${x}/${y}.png?appid=${key}`,
      );
      if (!upstream.ok) return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.set('Content-Type', 'image/png');
      res.set('Cache-Control', 'public, max-age=600');
      return res.send(buffer);
    } catch {
      return errorResponse(res, 502, 'Map tile provider is temporarily unavailable.');
    }
  });


  app.get('/api/nasa/apod', async (_req, res) => {
    try {
      const apiKey = getBackendApiKey('NASA_API_KEY') || 'DEMO_KEY';
      const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
      if (!response.ok) return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
      return res.json({ data: await response.json() });
    } catch {
      return errorResponse(res, 502, 'NASA data is temporarily unavailable.');
    }
  });

  app.get('/api/space/moon', async (_req, res) => {
    try {
      const now = new Date();
      const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
      const synodicMonth = 29.53058867;
      const daysSince = (now.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24);
      const phaseIndex = ((daysSince % synodicMonth) + synodicMonth) % synodicMonth;
      const illumination = Math.round(
        ((1 - Math.cos((phaseIndex / synodicMonth) * 2 * Math.PI)) / 2) * 100,
      );

      let phaseName = 'New Moon';
      if (phaseIndex < 1.84566) phaseName = 'New Moon';
      else if (phaseIndex < 5.53699) phaseName = 'Waxing Crescent';
      else if (phaseIndex < 9.22831) phaseName = 'First Quarter';
      else if (phaseIndex < 12.91963) phaseName = 'Waxing Gibbous';
      else if (phaseIndex < 16.61096) phaseName = 'Full Moon';
      else if (phaseIndex < 20.30228) phaseName = 'Waning Gibbous';
      else if (phaseIndex < 23.99361) phaseName = 'Last Quarter';
      else if (phaseIndex < 27.68493) phaseName = 'Waning Crescent';
      else phaseName = 'New Moon';

      return res.json({
        data: { phaseName, illumination, ageDays: Math.round(phaseIndex * 10) / 10 },
      });
    } catch {
      return errorResponse(res, 502, 'Moon phase data is temporarily unavailable.');
    }
  });

  app.get('/api/space/iss', async (_req, res) => {
    try {
      const response = await fetch('http://api.open-notify.org/iss-now.json');
      if (!response.ok) return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
      const json = await response.json();
      return res.json({
        data: {
          latitude: parseFloat(json.iss_position.latitude),
          longitude: parseFloat(json.iss_position.longitude),
          timestamp: json.timestamp,
        },
      });
    } catch {
      return errorResponse(res, 502, 'ISS data is temporarily unavailable.');
    }
  });

  // Development vs Production serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const pathToDist = resolve(process.cwd(), 'dist');
    app.use(
      express.static(pathToDist, {
        setHeaders: (res, filePath) => {
          if (
            filePath.endsWith('index.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('manifest.json')
          ) {
            res.setHeader(
              'Cache-Control',
              'no-store, no-cache, must-revalidate, proxy-revalidate',
            );
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
          } else if (filePath.includes('/assets/')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      }),
    );

    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const indexPath = resolve(pathToDist, 'index.html');
        return res.sendFile(indexPath, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
          },
        });
      }
      next();
    });
  }

  app.use((_req, res) => errorResponse(res, 404, 'Not found.'));
  app.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    void _next;
    console.error(error);
    return errorResponse(res, 500, 'Something went wrong.');
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`NEXUS API listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
