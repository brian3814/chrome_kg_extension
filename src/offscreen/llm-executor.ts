import type { LLMRequestMessage } from '../shared/messages';

const EXTRACTION_SYSTEM_PROMPT = `You are a knowledge graph extraction assistant. Given text, extract entities (nodes) and relationships (edges) and return them as structured JSON.

Output format:
{
  "nodes": [
    { "label": "Entity Name", "type": "person|organization|location|event|concept|technology|document", "properties": { "key": "value" } }
  ],
  "edges": [
    { "sourceLabel": "Source Entity", "targetLabel": "Target Entity", "label": "relationship_type", "type": "relationship_category" }
  ]
}

Rules:
- Extract the most important entities and relationships
- Use consistent, lowercase relationship labels (e.g., "works_at", "located_in", "created_by")
- Choose the most specific entity type from: person, organization, location, event, concept, technology, document
- Include relevant properties as key-value pairs
- Ensure all edges reference entities that exist in the nodes array
- Return ONLY valid JSON, no other text`;

export async function executeLLMRequest(
  payload: LLMRequestMessage['payload']
): Promise<{ content: string; error?: string }> {
  const { provider, model, apiKey, prompt } = payload;

  try {
    if (provider === 'openai') {
      return await callOpenAI(apiKey, model, prompt);
    } else if (provider === 'anthropic') {
      return await callAnthropic(apiKey, model, prompt);
    } else {
      return { content: '', error: `Unknown provider: ${provider}` };
    }
  } catch (e: any) {
    return { content: '', error: e.message };
  }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  userPrompt: string
): Promise<{ content: string }> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content: `Extract entities and relationships from the following text:\n\n${userPrompt}` },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return { content: data.choices[0]?.message?.content ?? '' };
}

async function callAnthropic(
  apiKey: string,
  model: string,
  userPrompt: string
): Promise<{ content: string }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Extract entities and relationships from the following text:\n\n${userPrompt}` },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  return { content: textBlock?.text ?? '' };
}
