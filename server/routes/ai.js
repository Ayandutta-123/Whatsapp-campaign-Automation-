const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const pool = require('../db');
const { publicError } = require('../utils/security');

const router = express.Router();

const SYSTEM_PROMPT = `You are a WhatsApp Business template expert assistant for "WhatsApp Campaign Automation".
Help users draft Meta-compliant WhatsApp message templates.

Rules for templates:
- Body max 1024 characters
- Variables must be {{1}}, {{2}}, etc. (numbered, sequential)
- Category: MARKETING, UTILITY, or AUTHENTICATION
- Language codes like en, en_US, hi
- Header: none, text, or image (for image just set header_type)
- Footer max 60 chars
- Up to 3 buttons: URL, QUICK_REPLY, or PHONE_NUMBER
- whatsapp_template_name: lowercase, underscores only (a-z0-9_)
- Do NOT invent illegal Meta template patterns

When you propose a ready-to-use template, ALWAYS include a fenced JSON block exactly like:
\`\`\`json
{
  "name": "Friendly display name",
  "whatsapp_template_name": "meta_safe_name",
  "language": "en",
  "category": "MARKETING",
  "body_text": "Hello {{1}}, ...",
  "header_type": "none",
  "header_value": "",
  "footer_text": "",
  "buttons": []
}
\`\`\`

buttons example:
[{"type":"URL","text":"Shop Now","url":"https://example.com"},{"type":"QUICK_REPLY","text":"Stop"}]

Be concise, professional, and ask clarifying questions when the user's goal is vague.
Never mention HyperThink. Brand the product as WhatsApp Campaign Automation.`;

async function getAnthropicKey() {
  const fromEnv = process.env.ANTHROPIC_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  const res = await pool.query(
    "SELECT value FROM settings WHERE key = 'anthropic_api_key'"
  );
  return res.rows[0]?.value?.trim() || '';
}

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = await getAnthropicKey();
    if (!apiKey) {
      return res.status(400).json({
        error:
          'Anthropic API key not configured. Add ANTHROPIC_API_KEY in .env or Settings → AI Assistant.',
      });
    }

    const cleaned = messages
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
      .slice(-20)
      .map((m) => ({
        role: m.role,
        content: String(m.content).slice(0, 8000),
      }));

    if (cleaned.length === 0 || cleaned[cleaned.length - 1].role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from the user' });
    }

    const client = new Anthropic({ apiKey });
    const modelCandidates = [
      process.env.ANTHROPIC_MODEL,
      'claude-sonnet-4-5-20250929',
      'claude-sonnet-4-5',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ].filter(Boolean);

    let response;
    let lastErr;
    for (const model of [...new Set(modelCandidates)]) {
      try {
        response = await client.messages.create({
          model,
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          messages: cleaned,
        });
        break;
      } catch (err) {
        lastErr = err;
        const msg = err?.error?.message || err?.message || '';
        const notFound =
          err?.status === 404 ||
          err?.error?.type === 'not_found_error' ||
          /model:/i.test(msg);
        if (!notFound) throw err;
      }
    }
    if (!response) throw lastErr;

    const text = (response.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    let template = null;
    const jsonMatch = text.match(/```json\s*([\s\S]*?)```/i);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed?.body_text && parsed?.whatsapp_template_name) {
          template = {
            name: parsed.name || parsed.whatsapp_template_name,
            whatsapp_template_name: String(parsed.whatsapp_template_name)
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_]/g, '')
              .slice(0, 512),
            language: parsed.language || 'en',
            category: ['MARKETING', 'UTILITY', 'AUTHENTICATION'].includes(
              String(parsed.category || '').toUpperCase()
            )
              ? String(parsed.category).toUpperCase()
              : 'MARKETING',
            body_text: String(parsed.body_text).slice(0, 1024),
            header_type: ['none', 'text', 'image'].includes(parsed.header_type)
              ? parsed.header_type
              : 'none',
            header_value: parsed.header_value || '',
            footer_text: (parsed.footer_text || '').slice(0, 60),
            buttons: Array.isArray(parsed.buttons) ? parsed.buttons.slice(0, 3) : [],
            submit_to_meta: false,
          };
        }
      } catch {
        /* ignore parse errors */
      }
    }

    res.json({
      reply: text,
      template,
      model: response.model,
      usage: response.usage || null,
    });
  } catch (err) {
    console.error('AI chat error:', err);
    const apiMsg = err?.error?.message || err?.message || '';
    let msg = 'Claude request failed';
    if (/model:/i.test(apiMsg) || err?.error?.type === 'not_found_error') {
      msg = 'Claude model not available for this API key. Set ANTHROPIC_MODEL in .env (e.g. claude-sonnet-4-5-20250929).';
    } else if (err?.status === 401 || /invalid.*api.?key/i.test(apiMsg)) {
      msg = 'Invalid Anthropic API key. Update it in Settings → AI Assistant.';
    } else if (err?.status === 429) {
      msg = 'Anthropic rate limit hit — try again in a moment.';
    } else if (apiMsg) {
      msg = apiMsg.slice(0, 200);
    }
    res.status(500).json({ error: msg });
  }
});

module.exports = router;
