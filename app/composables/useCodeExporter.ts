import type { ProviderId } from '~/types/llm'
import { resolveGenerationParams } from '~/lib/generation'

export type ExportLanguage = 'javascript' | 'python' | 'curl' | 'php'

interface ExportOptions {
  provider: ProviderId
  model: string
  systemPrompt: string
  userPrompt: string
  /** Ignored in generated snippets — keys must come from the environment. */
  apiKey?: string
  ollamaUrl?: string
  temperature?: number
  maxTokens?: number
}

export function envVarName(provider: Exclude<ProviderId, 'ollama'>): string {
  switch (provider) {
    case 'openai': return 'OPENAI_API_KEY'
    case 'anthropic': return 'ANTHROPIC_API_KEY'
    case 'gemini': return 'GEMINI_API_KEY'
    case 'groq': return 'GROQ_API_KEY'
  }
}

export function useCodeExporter() {
  function exportCode(language: ExportLanguage, opts: ExportOptions): string {
    switch (language) {
      case 'javascript': return exportJavaScript(opts)
      case 'python': return exportPython(opts)
      case 'curl': return exportCurl(opts)
      case 'php': return exportPhp(opts)
    }
  }

  return { exportCode }
}

function sampling(opts: ExportOptions) {
  return resolveGenerationParams(opts)
}

function exportJavaScript(opts: ExportOptions): string {
  const { temperature, maxTokens } = sampling(opts)

  if (opts.provider === 'ollama') {
    return `const response = await fetch('${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: '${opts.model}',
    messages: [
      { role: 'system', content: ${JSON.stringify(opts.systemPrompt)} },
      { role: 'user', content: ${JSON.stringify(opts.userPrompt)} },
    ],
    options: { temperature: ${temperature}, num_predict: ${maxTokens} },
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();
let result = '';

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const lines = decoder.decode(value).split('\\n').filter(Boolean);
  for (const line of lines) {
    const chunk = JSON.parse(line);
    result += chunk.message?.content ?? '';
    process.stdout.write(chunk.message?.content ?? '');
  }
}`
  }

  if (opts.provider === 'anthropic') {
    const baseUrl = getBaseUrl(opts.provider, opts.model)
    const headers = formatJsHeaders(opts.provider)
    return `const response = await fetch('${baseUrl}', {
  method: 'POST',
  headers: ${headers},
  body: JSON.stringify({
    model: '${opts.model}',
    max_tokens: ${maxTokens},
    temperature: ${temperature},
    system: ${JSON.stringify(opts.systemPrompt)},
    messages: [{ role: 'user', content: ${JSON.stringify(opts.userPrompt)} }],
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE chunks (data: {...})
  console.log(chunk);
}`
  }

  if (opts.provider === 'gemini') {
    const baseUrl = getBaseUrl(opts.provider, opts.model)
    const headers = formatJsHeaders(opts.provider)
    return `const response = await fetch('${baseUrl}', {
  method: 'POST',
  headers: ${headers},
  body: JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: ${JSON.stringify(opts.userPrompt)} }] }],
    systemInstruction: { parts: [{ text: ${JSON.stringify(opts.systemPrompt)} }] },
    generationConfig: { temperature: ${temperature}, maxOutputTokens: ${maxTokens} },
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE chunks (data: {...})
  console.log(chunk);
}`
  }

  const baseUrl = getBaseUrl(opts.provider, opts.model)
  const headers = formatJsHeaders(opts.provider)

  return `const response = await fetch('${baseUrl}', {
  method: 'POST',
  headers: ${headers},
  body: JSON.stringify({
    model: '${opts.model}',
    messages: [
      { role: 'system', content: ${JSON.stringify(opts.systemPrompt)} },
      { role: 'user', content: ${JSON.stringify(opts.userPrompt)} },
    ],
    temperature: ${temperature},
    max_tokens: ${maxTokens},
    stream: true,
  }),
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  const chunk = decoder.decode(value);
  // Parse SSE chunks (data: {...})
  console.log(chunk);
}`
}

function exportPython(opts: ExportOptions): string {
  const { temperature, maxTokens } = sampling(opts)

  if (opts.provider === 'openai') {
    return `import os
from openai import OpenAI

client = OpenAI(api_key=os.environ['OPENAI_API_KEY'])

stream = client.chat.completions.create(
    model="${opts.model}",
    messages=[
        {"role": "system", "content": ${JSON.stringify(opts.systemPrompt)}},
        {"role": "user", "content": ${JSON.stringify(opts.userPrompt)}},
    ],
    temperature=${temperature},
    max_tokens=${maxTokens},
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`
  }

  if (opts.provider === 'anthropic') {
    return `import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])

with client.messages.stream(
    model="${opts.model}",
    max_tokens=${maxTokens},
    temperature=${temperature},
    system=${JSON.stringify(opts.systemPrompt)},
    messages=[{"role": "user", "content": ${JSON.stringify(opts.userPrompt)}}],
) as stream:
    for text in stream.text_stream:
        print(text, end="", flush=True)`
  }

  if (opts.provider === 'groq') {
    return `import os
from openai import OpenAI

client = OpenAI(
    api_key=os.environ['GROQ_API_KEY'],
    base_url="https://api.groq.com/openai/v1",
)

stream = client.chat.completions.create(
    model="${opts.model}",
    messages=[
        {"role": "system", "content": ${JSON.stringify(opts.systemPrompt)}},
        {"role": "user", "content": ${JSON.stringify(opts.userPrompt)}},
    ],
    temperature=${temperature},
    max_tokens=${maxTokens},
    stream=True,
)

for chunk in stream:
    if chunk.choices[0].delta.content:
        print(chunk.choices[0].delta.content, end="", flush=True)`
  }

  if (opts.provider === 'gemini') {
    return `import os
from google import genai

client = genai.Client(api_key=os.environ['GEMINI_API_KEY'])

stream = client.models.generate_content_stream(
    model="${opts.model}",
    contents=${JSON.stringify(opts.userPrompt)},
    config=genai.types.GenerateContentConfig(
        system_instruction=${JSON.stringify(opts.systemPrompt)},
        temperature=${temperature},
        max_output_tokens=${maxTokens},
    ),
)

for chunk in stream:
    if chunk.text:
        print(chunk.text, end="", flush=True)`
  }

  if (opts.provider === 'ollama') {
    const url = `${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat`
    return `import json
import requests

response = requests.post(
    "${url}",
    json={
        "model": "${opts.model}",
        "messages": [
            {"role": "system", "content": ${JSON.stringify(opts.systemPrompt)}},
            {"role": "user", "content": ${JSON.stringify(opts.userPrompt)}},
        ],
        "options": {"temperature": ${temperature}, "num_predict": ${maxTokens}},
        "stream": True,
    },
    stream=True,
)
response.raise_for_status()

for line in response.iter_lines():
    if not line:
        continue
    chunk = json.loads(line)
    content = chunk.get("message", {}).get("content", "")
    if content:
        print(content, end="", flush=True)`
  }

  return `# Provider: ${opts.provider}
# Use the corresponding SDK or REST API
# Model: ${opts.model}
# System: ${JSON.stringify(opts.systemPrompt)}
# User: ${JSON.stringify(opts.userPrompt)}`
}

function exportCurl(opts: ExportOptions): string {
  const { temperature, maxTokens } = sampling(opts)

  if (opts.provider === 'ollama') {
    return `curl ${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    options: { temperature, num_predict: maxTokens },
    stream: true,
  })}'`
  }

  if (opts.provider === 'gemini') {
    const url = `${getBaseUrl('gemini', opts.model)}&key=$GEMINI_API_KEY`
    return `curl "${url}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify({
    contents: [{ role: 'user', parts: [{ text: opts.userPrompt }] }],
    systemInstruction: { parts: [{ text: opts.systemPrompt }] },
    generationConfig: { temperature, maxOutputTokens: maxTokens },
  })}'`
  }

  if (opts.provider === 'anthropic') {
    const baseUrl = getBaseUrl(opts.provider, opts.model)
    const headerFlags = formatCurlHeaders(opts.provider)
    return `curl ${baseUrl} \\
  ${headerFlags} \\
  -d '${JSON.stringify({
    model: opts.model,
    max_tokens: maxTokens,
    temperature,
    system: opts.systemPrompt,
    messages: [{ role: 'user', content: opts.userPrompt }],
    stream: true,
  })}'`
  }

  const baseUrl = getBaseUrl(opts.provider, opts.model)
  const headerFlags = formatCurlHeaders(opts.provider)

  return `curl ${baseUrl} \\
  ${headerFlags} \\
  -d '${JSON.stringify({
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ],
    temperature,
    max_tokens: maxTokens,
    stream: true,
  })}'`
}

function exportPhp(opts: ExportOptions): string {
  const { temperature, maxTokens } = sampling(opts)
  const url = opts.provider === 'ollama'
    ? `${opts.ollamaUrl ?? 'http://localhost:11434'}/api/chat`
    : getBaseUrl(opts.provider, opts.model)

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

function getBaseUrl(provider: ProviderId, model?: string): string {
  switch (provider) {
    case 'openai': return 'https://api.openai.com/v1/chat/completions'
    case 'anthropic': return 'https://api.anthropic.com/v1/messages'
    case 'gemini': return `https://generativelanguage.googleapis.com/v1beta/models/${model ?? 'MODEL'}:streamGenerateContent?alt=sse`
    case 'groq': return 'https://api.groq.com/openai/v1/chat/completions'
    default: return ''
  }
}

function formatJsHeaders(provider: Exclude<ProviderId, 'ollama'>): string {
  const env = `process.env.${envVarName(provider)}`
  const lines = [`    'Content-Type': 'application/json'`]

  switch (provider) {
    case 'openai':
    case 'groq':
      lines.push(`    Authorization: 'Bearer ' + ${env}`)
      break
    case 'anthropic':
      lines.push(`    'x-api-key': ${env}`)
      lines.push(`    'anthropic-version': '2023-06-01'`)
      break
    case 'gemini':
      lines.push(`    'x-goog-api-key': ${env}`)
      break
  }

  return `{\n${lines.join(',\n')},\n  }`
}

function formatCurlHeaders(provider: Exclude<ProviderId, 'ollama'>): string {
  const env = `$${envVarName(provider)}`
  const headers: string[] = ['-H "Content-Type: application/json"']

  switch (provider) {
    case 'openai':
    case 'groq':
      headers.push(`-H "Authorization: Bearer ${env}"`)
      break
    case 'anthropic':
      headers.push(`-H "x-api-key: ${env}"`)
      headers.push('-H "anthropic-version: 2023-06-01"')
      break
    case 'gemini':
      headers.push(`-H "x-goog-api-key: ${env}"`)
      break
  }

  return headers.join(' \\\n  ')
}

function phpHeadersArray(provider: ProviderId): string {
  const lines = [`    'Content-Type: application/json'`]

  if (provider !== 'ollama') {
    const env = `getenv('${envVarName(provider)}')`
    switch (provider) {
      case 'openai':
      case 'groq':
        lines.push(`    'Authorization: Bearer ' . ${env}`)
        break
      case 'anthropic':
        lines.push(`    'x-api-key: ' . ${env}`)
        lines.push(`    'anthropic-version: 2023-06-01'`)
        break
      case 'gemini':
        lines.push(`    'x-goog-api-key: ' . ${env}`)
        break
    }
  }

  return '[\n' + lines.join(',\n') + ',\n]'
}
