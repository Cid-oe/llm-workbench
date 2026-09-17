import type { ExportOptions } from './types'
import { getBaseUrl, phpHeadersArray, sampling } from './shared'

export function exportPhp(opts: ExportOptions): string {
  const { temperature, maxTokens } = sampling(opts)
  const url = opts.provider === 'ollama'
    ? `${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat`
    : getBaseUrl(opts.provider, opts.model, opts.lmStudioUrl)

  let payload: Record<string, unknown>
  if (opts.provider === 'anthropic') {
    payload = {
      model: opts.model,
      max_tokens: maxTokens,
      temperature,
      system: opts.systemPrompt,
      messages: [{ role: 'user', content: opts.userPrompt }],
      stream: true,
    }
  }
  else if (opts.provider === 'gemini') {
    payload = {
      contents: [{ role: 'user', parts: [{ text: opts.userPrompt }] }],
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }
  }
  else if (opts.provider === 'ollama') {
    payload = {
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      options: { temperature, num_predict: maxTokens },
      stream: true,
    }
  }
  else {
    payload = {
      model: opts.model,
      messages: [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: opts.userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }
  }

  const body = JSON.stringify(payload, null, 2)

  return `<?php

$ch = curl_init('${url}');
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ${phpHeadersArray(opts.provider)},
    CURLOPT_POSTFIELDS => '${body.replace(/'/g, "\\'")}',
    CURLOPT_RETURNTRANSFER => false,
    CURLOPT_WRITEFUNCTION => function ($ch, $data) {
        echo $data;
        return strlen($data);
    },
]);

curl_exec($ch);
curl_close($ch);`
}
