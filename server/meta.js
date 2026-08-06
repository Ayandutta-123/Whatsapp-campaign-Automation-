const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const { getSetting } = require('./whatsapp');
const { mapMetaApiStatus } = require('./utils/metaStatus');
const { graphApiBase, resolveHeadersDir } = require('./utils/paths');

function GRAPH() {
  return graphApiBase();
}

async function getMetaCredentials() {
  const token = await getSetting('whatsapp_token');
  const wabaId = await getSetting('waba_id');
  const appId = await getSetting('meta_app_id');
  const phoneNumberId = await getSetting('phone_number_id');
  const appSecret =
    (await getSetting('meta_app_secret')) || process.env.META_APP_SECRET?.trim() || '';
  return { token, wabaId, appId, phoneNumberId, appSecret };
}

async function getMissingMetaUploadConfig() {
  const { token } = await getMetaCredentials();
  const missing = [];
  if (!token?.trim()) missing.push('WhatsApp Access Token');
  // Meta App ID can be auto-detected from the token — not required upfront
  return missing;
}

function formatMetaUploadWarning(err) {
  const { formatMetaApiError } = require('./utils/userErrors');
  const friendly = formatMetaApiError(err, 'Image saved on server, but Meta upload failed.');
  // Keep leading context so users know the file is local even if Meta rejected it.
  if (friendly.startsWith('[Error')) {
    return `Image saved on server.\n${friendly}`;
  }
  return `Image saved on server. ${friendly}`;
}

async function discoverAppIdFromToken(token, appSecret, configuredAppId) {
  // 1) /app endpoint — returns the Facebook app tied to this access token
  try {
    const res = await axios.get(`${GRAPH()}/app`, {
      params: { access_token: token, fields: 'id,name' },
    });
    if (res.data?.id) return String(res.data.id);
  } catch {
    /* continue */
  }

  // 2) Same token as access_token (works for many Cloud API tokens)
  try {
    const res = await axios.get(`${GRAPH()}/debug_token`, {
      params: { input_token: token, access_token: token },
    });
    const id = res.data?.data?.app_id;
    if (id) return String(id);
  } catch {
    /* continue */
  }

  // 3) App access token appId|secret (needs a correct App ID hint + secret)
  const secret = appSecret?.trim();
  const appIdHint = configuredAppId?.trim();
  if (secret && appIdHint) {
    try {
      const res = await axios.get(`${GRAPH()}/debug_token`, {
        params: {
          input_token: token,
          access_token: `${appIdHint}|${secret}`,
        },
      });
      const id = res.data?.data?.app_id;
      if (id) return String(id);
    } catch {
      /* continue */
    }
  }

  return null;
}

function isInvalidAppIdError(err) {
  const msg = (
    err?.response?.data?.error?.message ||
    err?.message ||
    ''
  ).toLowerCase();
  return (
    msg.includes('does not exist') ||
    msg.includes('unsupported get request') ||
    msg.includes('missing permissions') ||
    msg.includes('object with id') ||
    (msg.includes('app id') && msg.includes('invalid'))
  );
}

async function persistMetaAppId(appId) {
  if (!appId) return;
  try {
    await pool.query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('meta_app_id', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
       WHERE settings.value IS DISTINCT FROM EXCLUDED.value`,
      [String(appId)]
    );
  } catch (err) {
    console.warn('Could not persist meta_app_id:', err.message);
  }
}

/**
 * Resolve the Facebook App ID used for resumable uploads.
 * Prefer token introspection over a brittle GET /{appId} check (often fails with WA tokens).
 */
async function resolveMetaAppId(token, configuredAppId, { wabaId, phoneNumberId, appSecret } = {}) {
  const configured = configuredAppId?.trim() || '';

  if (configured && wabaId && configured === String(wabaId).trim()) {
    throw new Error(
      'Meta App ID must be your Facebook App ID, not the WhatsApp Business Account (WABA) ID.'
    );
  }
  if (configured && phoneNumberId && configured === String(phoneNumberId).trim()) {
    throw new Error(
      'Meta App ID must be your Facebook App ID, not the Phone Number ID.'
    );
  }

  const discovered = await discoverAppIdFromToken(token, appSecret, configured);

  if (discovered) {
    if (configured && configured !== discovered) {
      console.warn(
        `Meta App ID in Settings (${configured}) does not match token app (${discovered}). Using ${discovered} for uploads.`
      );
    }
    await persistMetaAppId(discovered);
    return discovered;
  }

  if (configured) {
    // Do not hard-fail on GET /{id} — WhatsApp tokens often cannot read Application nodes.
    // Upload session creation is the real authority.
    return configured;
  }

  throw new Error(
    'Could not detect Meta App ID from your token. Set Meta App ID in Settings (developers.facebook.com → App Settings → Basic), or set META_APP_SECRET / Meta App Secret so we can auto-detect it.'
  );
}

async function createUploadSession(appId, token, buffer, fileType, safeName) {
  return axios.post(
    `${GRAPH()}/${appId}/uploads`,
    {
      file_length: String(buffer.length),
      file_type: fileType,
      file_name: safeName,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

function buildExampleValues(variables) {
  const samples = {
    '1': 'John',
    '2': 'Acme Inc',
    '3': '+1234567890',
    '4': 'john@example.com',
  };
  return variables.map((v) => samples[v] || `Sample${v}`);
}

function buildMetaComponents(template) {
  const components = [];
  const variables = template.variables || [];

  if (template.header_type === 'text' && template.header_value) {
    components.push({
      type: 'HEADER',
      format: 'TEXT',
      text: template.header_value,
    });
  } else if (template.header_type === 'image') {
    if (!template.header_media_handle) {
      throw new Error(
        'Image header is missing a Meta media handle. Re-upload the PNG/JPG header image, then submit to Meta again.'
      );
    }
    components.push({
      type: 'HEADER',
      format: 'IMAGE',
      example: {
        header_handle: [template.header_media_handle],
      },
    });
  }

  const bodyComponent = {
    type: 'BODY',
    text: template.body_text,
  };

  if (variables.length > 0) {
    bodyComponent.example = {
      body_text: [buildExampleValues(variables)],
    };
  }

  components.push(bodyComponent);

  if (template.footer_text) {
    components.push({
      type: 'FOOTER',
      text: template.footer_text,
    });
  }

  const buttons = Array.isArray(template.buttons) && template.buttons.length > 0
    ? template.buttons
    : template.button_text
      ? [{ type: 'QUICK_REPLY', text: template.button_text }]
      : [];

  if (buttons.length > 0) {
    const metaButtons = buttons.slice(0, 3).map((btn) => {
      if (btn.type === 'URL') {
        return { type: 'URL', text: btn.text.slice(0, 25), url: btn.url };
      }
      if (btn.type === 'PHONE_NUMBER') {
        return { type: 'PHONE_NUMBER', text: btn.text.slice(0, 25), phone_number: btn.phone };
      }
      return { type: 'QUICK_REPLY', text: btn.text.slice(0, 25) };
    });
    components.push({ type: 'BUTTONS', buttons: metaButtons });
  }

  return components;
}

async function uploadImageToMeta(buffer, mimeType, fileName = 'header.jpg') {
  const { token, appId, wabaId, phoneNumberId, appSecret } = await getMetaCredentials();

  if (!token) {
    throw new Error('WhatsApp token must be configured in Settings');
  }

  let resolvedAppId = await resolveMetaAppId(token, appId, {
    wabaId,
    phoneNumberId,
    appSecret,
  });
  const fileType = mimeType || 'image/jpeg';
  const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, '_') || 'header.jpg';

  let sessionRes;
  try {
    sessionRes = await createUploadSession(resolvedAppId, token, buffer, fileType, safeName);
  } catch (err) {
    if (!isInvalidAppIdError(err)) throw err;

    // Configured App ID is wrong — rediscover and retry once
    const rediscovered = await discoverAppIdFromToken(token, appSecret, null);
    if (!rediscovered || rediscovered === resolvedAppId) {
      const metaMsg = err.response?.data?.error?.message || err.message;
      throw new Error(
        `Invalid Meta App ID (${resolvedAppId}): ${metaMsg}. Use the App ID from developers.facebook.com → your WhatsApp app → Settings → Basic (not WABA or Phone Number ID).`
      );
    }
    console.warn(
      `Meta upload session failed for App ID ${resolvedAppId}; retrying with discovered ${rediscovered}`
    );
    await persistMetaAppId(rediscovered);
    resolvedAppId = rediscovered;
    sessionRes = await createUploadSession(resolvedAppId, token, buffer, fileType, safeName);
  }

  const uploadSessionId = sessionRes.data.id;
  if (!uploadSessionId) {
    throw new Error('Meta did not return an upload session ID');
  }

  const uploadRes = await axios.post(
    `${GRAPH()}/${uploadSessionId}`,
    buffer,
    {
      headers: {
        Authorization: `OAuth ${token}`,
        file_offset: '0',
        'Content-Type': fileType,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    }
  );

  const handle = uploadRes.data.h;
  if (!handle) {
    throw new Error('Meta upload completed but no media handle was returned');
  }

  return handle;
}

function readHeaderImageFromDisk(headerImagePath) {
  const { safeResolveUnder } = require('./utils/security');
  const uploadDir = resolveHeadersDir();
  const filePath = safeResolveUnder(uploadDir, headerImagePath);
  if (!fs.existsSync(filePath)) {
    throw new Error('Header image file not found on server. Please re-upload the image.');
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return { buffer, mime, fileName: path.basename(filePath) };
}

async function ensureTemplateHeaderHandle(template, { forceReupload = false } = {}) {
  if (template.header_type !== 'image') {
    return { template, uploaded: false };
  }

  if (template.header_media_handle && !forceReupload) {
    return { template, uploaded: false };
  }

  if (!template.header_image_path) {
    throw new Error('Upload a header image before submitting to Meta');
  }

  const { buffer, mime, fileName } = readHeaderImageFromDisk(template.header_image_path);
  const handle = await uploadImageToMeta(buffer, mime, fileName);

  return {
    template: { ...template, header_media_handle: handle },
    uploaded: true,
  };
}

function nextMetaTemplateName(name) {
  const base = String(name || 'template')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 500);
  const match = base.match(/^(.*)_v(\d+)$/);
  if (match) {
    return `${match[1]}_v${parseInt(match[2], 10) + 1}`.slice(0, 512);
  }
  return `${base}_v2`.slice(0, 512);
}

async function postMetaTemplate(token, wabaId, prepared) {
  const payload = {
    name: prepared.whatsapp_template_name,
    language: prepared.language || 'en',
    category: prepared.category || 'MARKETING',
    components: buildMetaComponents(prepared),
  };

  const response = await axios.post(
    `${GRAPH()}/${wabaId}/message_templates`,
    payload,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  return {
    metaTemplateId: response.data.id,
    metaStatus: mapMetaApiStatus(response.data.status || 'PENDING'),
    headerMediaHandle: prepared.header_media_handle || null,
    whatsappTemplateName: prepared.whatsapp_template_name,
  };
}

function isMetaNameConflictError(err) {
  const msg = err.response?.data?.error?.message || err.message || '';
  const code = err.response?.data?.error?.code;
  const subcode = err.response?.data?.error?.error_subcode;
  return (
    /already exists|duplicate|taken|in use|name.*exist/i.test(msg) ||
    subcode === 2388024 ||
    (code === 100 && /name|exist|duplicate/i.test(msg))
  );
}

/**
 * Create a message template on Meta.
 * Meta cannot edit approved templates in place — use forceNewVersion (or automatic
 * name-conflict retry) to submit under name_v2 / name_v3 / …
 */
async function createMetaTemplate(
  template,
  { forceReuploadHeader = false, forceNewVersion = false } = {}
) {
  const { token, wabaId } = await getMetaCredentials();

  if (!token || !wabaId) {
    throw new Error(
      'WhatsApp token and WhatsApp Business Account ID (WABA ID) must be configured in Settings'
    );
  }

  let working = { ...template };
  if (forceNewVersion) {
    working = {
      ...working,
      whatsapp_template_name: nextMetaTemplateName(working.whatsapp_template_name),
      header_media_handle: null,
    };
    forceReuploadHeader = true;
  }

  const { template: prepared } = await ensureTemplateHeaderHandle(working, {
    forceReupload: forceReuploadHeader,
  });

  if (prepared.header_type === 'image' && !prepared.header_media_handle) {
    throw new Error(
      'Template image header could not be uploaded to Meta. Check Meta App ID and token permissions in Settings.'
    );
  }

  try {
    return await postMetaTemplate(token, wabaId, prepared);
  } catch (err) {
    if (!isMetaNameConflictError(err)) throw err;

    // Name already on Meta — bump version and submit as a new template.
    const renamed = {
      ...prepared,
      whatsapp_template_name: nextMetaTemplateName(prepared.whatsapp_template_name),
      header_media_handle: null,
    };
    const { template: prepared2 } = await ensureTemplateHeaderHandle(renamed, {
      forceReupload: true,
    });
    return await postMetaTemplate(token, wabaId, prepared2);
  }
}

async function getMetaTemplateStatus(templateName, language) {
  const { token, wabaId } = await getMetaCredentials();

  if (!token || !wabaId) {
    throw new Error('WhatsApp token and WABA ID must be configured in Settings');
  }

  const response = await axios.get(`${GRAPH()}/${wabaId}/message_templates`, {
    params: {
      name: templateName,
      access_token: token,
    },
  });

  const templates = response.data?.data || [];
  if (templates.length === 0) {
    return {
      notFound: true,
      status: null,
      metaTemplateId: null,
      rejectionReason: null,
      headerFormat: null,
      bodyVarKeys: [],
      metaLanguage: null,
    };
  }

  let match = templates[0];
  if (language) {
    const byLanguage = templates.find((t) => t.language === language);
    if (byLanguage) match = byLanguage;
  }

  const components = match.components || [];
  const header = components.find((c) => String(c.type).toUpperCase() === 'HEADER');
  const body = components.find((c) => String(c.type).toUpperCase() === 'BODY');
  const bodyVarKeys = [
    ...new Set(
      String(body?.text || '')
        .match(/\{\{(\d+)\}\}/g)
        ?.map((m) => m.replace(/[{}]/g, '')) || []
    ),
  ].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  return {
    notFound: false,
    status: mapMetaApiStatus(match.status),
    metaLanguage: match.language || null,
    metaTemplateId: match.id,
    rejectionReason: match.rejected_reason || null,
    headerFormat: header?.format ? String(header.format).toUpperCase() : null,
    bodyVarKeys,
  };
}

async function listMetaTemplates() {
  const { token, wabaId } = await getMetaCredentials();

  if (!token || !wabaId) {
    throw new Error('WhatsApp token and WABA ID must be configured in Settings');
  }

  const all = [];
  let after = null;

  do {
    const params = { access_token: token, limit: 100 };
    if (after) params.after = after;

    const response = await axios.get(`${GRAPH()}/${wabaId}/message_templates`, {
      params,
    });
    const batch = response.data?.data || [];
    all.push(...batch);
    after = response.data?.paging?.cursors?.after || null;
    if (!response.data?.paging?.next) after = null;
  } while (after);

  return all;
}

function parseMetaTemplateToLocal(metaTpl) {
  const components = metaTpl.components || [];
  let header_type = 'none';
  let header_value = null;
  let body_text = '';
  let footer_text = null;
  let button_text = null;
  const buttons = [];

  for (const c of components) {
    const type = String(c.type || '').toUpperCase();
    if (type === 'HEADER') {
      const format = String(c.format || '').toUpperCase();
      if (format === 'TEXT') {
        header_type = 'text';
        header_value = c.text || null;
      } else if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
        header_type = 'image';
      }
    } else if (type === 'BODY') {
      body_text = c.text || '';
    } else if (type === 'FOOTER') {
      footer_text = c.text || null;
    } else if (type === 'BUTTONS' && Array.isArray(c.buttons)) {
      for (const b of c.buttons.slice(0, 3)) {
        const btnType = String(b.type || '').toUpperCase();
        if (btnType === 'URL') {
          buttons.push({ type: 'URL', text: b.text || 'Open', url: b.url || '', phone: '' });
        } else if (btnType === 'PHONE_NUMBER') {
          buttons.push({
            type: 'PHONE_NUMBER',
            text: b.text || 'Call',
            url: '',
            phone: b.phone_number || '',
          });
        } else {
          buttons.push({ type: 'QUICK_REPLY', text: b.text || 'Reply', url: '', phone: '' });
        }
      }
      if (buttons.length === 1 && buttons[0].type === 'QUICK_REPLY') {
        button_text = buttons[0].text;
      }
    }
  }

  const varMatches = body_text.match(/\{\{(\d+)\}\}/g) || [];
  const variables = [
    ...new Set(varMatches.map((m) => m.replace(/[{}]/g, ''))),
  ].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  const displayName = String(metaTpl.name || 'template')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return {
    name: displayName,
    whatsapp_template_name: metaTpl.name,
    language: metaTpl.language || 'en',
    category: String(metaTpl.category || 'MARKETING').toUpperCase(),
    body_text,
    variables,
    header_type,
    header_value,
    footer_text,
    button_text,
    buttons,
    meta_status: mapMetaApiStatus(metaTpl.status || 'PENDING'),
    meta_template_id: metaTpl.id || null,
    meta_rejection_reason: metaTpl.rejected_reason || null,
  };
}

async function importMetaTemplatesToDb(pool) {
  const metaList = await listMetaTemplates();
  const summary = { imported: 0, updated: 0, skipped: 0, total: metaList.length };

  for (const metaTpl of metaList) {
    if (!metaTpl?.name) {
      summary.skipped += 1;
      continue;
    }

    const local = parseMetaTemplateToLocal(metaTpl);
    const existing = await pool.query(
      `SELECT id FROM templates
       WHERE whatsapp_template_name = $1 AND language = $2
       LIMIT 1`,
      [local.whatsapp_template_name, local.language]
    );

    const buttonsJson = JSON.stringify(local.buttons || []);

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE templates SET
           name = $1,
           category = $2,
           body_text = COALESCE(NULLIF($3, ''), body_text),
           variables = $4,
           header_type = $5,
           header_value = COALESCE($6, header_value),
           footer_text = COALESCE($7, footer_text),
           button_text = COALESCE($8, button_text),
           buttons = CASE WHEN $9::jsonb = '[]'::jsonb THEN buttons ELSE $9::jsonb END,
           meta_status = $10,
           meta_template_id = COALESCE($11, meta_template_id),
           meta_rejection_reason = $12,
           updated_at = NOW()
         WHERE id = $13`,
        [
          local.name,
          local.category,
          local.body_text,
          local.variables,
          local.header_type,
          local.header_value,
          local.footer_text,
          local.button_text,
          buttonsJson,
          local.meta_status,
          local.meta_template_id,
          local.meta_rejection_reason,
          existing.rows[0].id,
        ]
      );
      summary.updated += 1;
    } else {
      await pool.query(
        `INSERT INTO templates
         (name, whatsapp_template_name, language, category, body_text, variables,
          header_type, header_value, footer_text, button_text, buttons,
          meta_status, meta_template_id, meta_rejection_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)`,
        [
          local.name,
          local.whatsapp_template_name,
          local.language,
          local.category,
          local.body_text || `(Imported from Meta: ${local.whatsapp_template_name})`,
          local.variables,
          local.header_type,
          local.header_value,
          local.footer_text,
          local.button_text,
          buttonsJson,
          local.meta_status,
          local.meta_template_id,
          local.meta_rejection_reason,
        ]
      );
      summary.imported += 1;
    }
  }

  return { summary, templates: metaList.map(parseMetaTemplateToLocal) };
}

async function testMetaAppId() {
  const { token, appId, wabaId, phoneNumberId, appSecret } = await getMetaCredentials();

  if (!token) {
    return { valid: false, error: 'WhatsApp token is not configured' };
  }

  try {
    const resolved = await resolveMetaAppId(token, appId, {
      wabaId,
      phoneNumberId,
      appSecret,
    });

    let appName = null;
    try {
      const appRes = await axios.get(`${GRAPH()}/app`, {
        params: { access_token: token, fields: 'id,name' },
      });
      appName = appRes.data?.name || null;
    } catch {
      /* name is optional — WA tokens often cannot read Application nodes */
    }

    // Prove uploads work without requiring GET /{appId} (often denied)
    const probe = Buffer.from([0xff, 0xd8, 0xff, 0xd9]); // minimal JPEG
    try {
      const session = await createUploadSession(resolved, token, probe, 'image/jpeg', 'probe.jpg');
      if (!session.data?.id) {
        return { valid: false, error: `Meta App ID ${resolved} rejected upload session creation` };
      }
    } catch (err) {
      const metaMsg = err.response?.data?.error?.message || err.message;
      return {
        valid: false,
        error: `Meta App ID (${resolved}) cannot create uploads: ${metaMsg}`,
      };
    }

    return {
      valid: true,
      appId: resolved,
      appName,
      autoDetected: !appId?.trim() || String(appId).trim() !== resolved,
    };
  } catch (err) {
    return {
      valid: false,
      error: err.message,
    };
  }
}

module.exports = {
  uploadImageToMeta,
  ensureTemplateHeaderHandle,
  createMetaTemplate,
  nextMetaTemplateName,
  getMetaTemplateStatus,
  listMetaTemplates,
  parseMetaTemplateToLocal,
  importMetaTemplatesToDb,
  buildMetaComponents,
  testMetaAppId,
  getMissingMetaUploadConfig,
  formatMetaUploadWarning,
};
