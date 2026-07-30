const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../db');
const {
  uploadImageToMeta,
  createMetaTemplate,
  getMetaTemplateStatus,
  listMetaTemplates,
  importMetaTemplatesToDb,
  getMissingMetaUploadConfig,
  formatMetaUploadWarning,
} = require('../meta');
const { resolvePublicBaseUrl } = require('../utils/publicUrl');
const { resolveHeadersDir } = require('../utils/paths');
const { uploadLimiter } = require('../middleware/rateLimit');
const { publicError } = require('../utils/security');

const router = express.Router();

// WhatsApp template headers only accept JPEG and PNG, and the stored extension is
// what later tells Meta the media type — so anything else must be rejected here.
const HEADER_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (HEADER_IMAGE_TYPES.has(file.mimetype)) cb(null, true);
    else cb(new Error('Only PNG or JPG images are allowed'));
  },
});

/** Translates multer rejections into JSON the UI can display. */
function receiveHeaderImage(req, res, next) {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();
    res.status(400).json({
      error:
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image is larger than 5MB. Upload a smaller PNG or JPG.'
          : err.message || 'Image upload failed',
    });
  });
}

function detectVariables(bodyText) {
  if (!bodyText) return [];
  const matches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  const nums = [...new Set(matches.map((m) => m.replace(/[{}]/g, '')))];
  return nums.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

function replaceVariables(text, contact) {
  if (!text) return '';
  const fieldMap = {
    '1': contact.name || '[Name]',
    '2': contact.company || '[Company]',
    '3': contact.phone || '[Phone]',
    '4': contact.email || '[Email]',
  };
  return text.replace(/\{\{(\d+)\}\}/g, (_, num) => fieldMap[num] || `[Var ${num}]`);
}

function sanitizeTemplateName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 512);
}

async function syncTemplateMetaStatus(template) {
  const metaInfo = await getMetaTemplateStatus(
    template.whatsapp_template_name,
    template.language
  );

  if (metaInfo.notFound) {
    return {
      template,
      synced: false,
      warning: `"${template.whatsapp_template_name}" not found on Meta — may have been deleted or submitted under a different account`,
    };
  }

  // Build update: also fix language if Meta returned a different one
  const updateRes = await pool.query(
    `UPDATE templates
       SET meta_status = $1,
           meta_template_id = COALESCE($2, meta_template_id),
           meta_rejection_reason = $3,
           language = COALESCE($4, language),
           updated_at = NOW()
     WHERE id = $5 RETURNING *`,
    [
      metaInfo.status,
      metaInfo.metaTemplateId,
      metaInfo.rejectionReason,
      metaInfo.metaLanguage,
      template.id,
    ]
  );

  return {
    template: updateRes.rows[0],
    synced: true,
    warning: null,
  };
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/meta/list', async (req, res) => {
  try {
    const templates = await listMetaTemplates();
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/upload-header', uploadLimiter, receiveHeaderImage, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const ext = HEADER_IMAGE_TYPES.get(req.file.mimetype);
    const filename = `${crypto.randomUUID()}.${ext}`;
    const uploadDir = resolveHeadersDir();
    fs.mkdirSync(uploadDir, { recursive: true });
    fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

    const preview = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    const baseRes = await pool.query(
      "SELECT value FROM settings WHERE key = 'public_base_url'"
    );
    const publicBase = resolvePublicBaseUrl(baseRes.rows[0]?.value, req);
    const header_image_url = publicBase
      ? `${publicBase}/uploads/headers/${filename}`
      : null;

    let handle = null;
    let meta_warning = null;
    const missingConfig = await getMissingMetaUploadConfig();
    if (missingConfig.length > 0) {
      meta_warning = `Image saved on server. Configure ${missingConfig.join(' and ')} in Settings → WhatsApp API, click Save, then upload again.`;
    } else {
      try {
        handle = await uploadImageToMeta(req.file.buffer, req.file.mimetype);
      } catch (metaErr) {
        meta_warning = formatMetaUploadWarning(metaErr);
      }
    }

    res.json({
      header_media_handle: handle,
      header_image_preview: preview,
      header_image_path: filename,
      header_image_url,
      meta_warning,
    });
  } catch (err) {
    console.error('Header image upload failed:', err.message);
    if (err.code === 'EACCES' || err.code === 'EPERM') {
      return res.status(500).json({
        error:
          'Server cannot write to the uploads folder. Check that the uploads volume is writable by the app user, then try again.',
      });
    }
    res.status(500).json({ error: publicError(err, 'Image upload failed') });
  }
});

router.post('/', async (req, res) => {
  try {
    const {
      name,
      whatsapp_template_name,
      language,
      category,
      body_text,
      variables,
      header_type,
      header_value,
      header_media_handle,
      header_image_preview,
      header_image_path,
      header_image_url,
      footer_text,
      button_text,
      buttons,
      submit_to_meta = true,
    } = req.body;

    const templateName = sanitizeTemplateName(
      whatsapp_template_name || name || 'template'
    );
    const detectedVars = variables || detectVariables(body_text);

    if (!body_text?.trim()) {
      return res.status(400).json({ error: 'Body text is required' });
    }

    const buttonsJson = Array.isArray(buttons) && buttons.length > 0
      ? JSON.stringify(buttons)
      : '[]';

    const safeImagePath = header_image_path
      ? path.basename(String(header_image_path))
      : null;
    if (safeImagePath && !/^[a-f0-9-]+\.(jpg|jpeg|png)$/i.test(safeImagePath)) {
      return res.status(400).json({ error: 'Invalid header image path' });
    }

    const insertRes = await pool.query(
      `INSERT INTO templates
       (name, whatsapp_template_name, language, category, body_text, variables,
        header_type, header_value, header_media_handle, header_image_preview,
        header_image_path, header_image_url, footer_text, button_text, buttons, meta_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'draft') RETURNING *`,
      [
        name,
        templateName,
        language || 'en',
        category || 'MARKETING',
        body_text,
        detectedVars,
        header_type || 'none',
        header_value || null,
        header_media_handle || null,
        header_image_preview || null,
        safeImagePath,
        header_image_url || null,
        footer_text || null,
        button_text || null,
        buttonsJson,
      ]
    );

    let template = insertRes.rows[0];
    let metaError = null;

    if (submit_to_meta) {
      try {
        const metaResult = await createMetaTemplate(template);
        const updateRes = await pool.query(
          `UPDATE templates SET meta_status = $1, meta_template_id = $2,
           header_media_handle = COALESCE($4, header_media_handle), updated_at = NOW()
           WHERE id = $3 RETURNING *`,
          [
            metaResult.metaStatus,
            metaResult.metaTemplateId,
            template.id,
            metaResult.headerMediaHandle,
          ]
        );
        template = updateRes.rows[0];
      } catch (err) {
        metaError =
          err.response?.data?.error?.message || err.message || 'Meta submission failed';
        await pool.query(
          `UPDATE templates SET meta_status = 'failed', meta_rejection_reason = $1, updated_at = NOW()
           WHERE id = $2`,
          [metaError, template.id]
        );
        template.meta_status = 'failed';
        template.meta_rejection_reason = metaError;
      }
    }

    res.status(201).json({ template, metaError });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync-all-meta', async (req, res) => {
  try {
    // Pull all templates from Meta into local DB, then refresh statuses
    const importResult = await importMetaTemplatesToDb(pool);

    const result = await pool.query('SELECT * FROM templates ORDER BY id');
    const results = [];

    for (const template of result.rows) {
      try {
        const syncResult = await syncTemplateMetaStatus(template);
        results.push({
          id: template.id,
          name: template.name,
          whatsapp_template_name: template.whatsapp_template_name,
          meta_status: syncResult.template.meta_status,
          synced: syncResult.synced,
          warning: syncResult.warning,
        });
      } catch (err) {
        results.push({
          id: template.id,
          name: template.name,
          whatsapp_template_name: template.whatsapp_template_name,
          meta_status: template.meta_status,
          synced: false,
          error: err.response?.data?.error?.message || err.message,
        });
      }
    }

    const synced = results.filter((r) => r.synced).length;
    const notFound = results.filter((r) => r.warning).length;
    const errors = results.filter((r) => r.error).length;

    res.json({
      results,
      import: importResult.summary,
      summary: {
        synced,
        notFound,
        errors,
        total: results.length,
        imported: importResult.summary.imported,
        updated: importResult.summary.updated,
        metaTotal: importResult.summary.total,
      },
    });
  } catch (err) {
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

router.post('/import-meta', async (req, res) => {
  try {
    const importResult = await importMetaTemplatesToDb(pool);
    const list = await pool.query('SELECT * FROM templates ORDER BY created_at DESC');
    res.json({
      templates: list.rows,
      summary: importResult.summary,
    });
  } catch (err) {
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

router.post('/:id/submit-meta', async (req, res) => {
  try {
    const templateRes = await pool.query('SELECT * FROM templates WHERE id = $1', [
      req.params.id,
    ]);
    if (templateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const template = templateRes.rows[0];

    if (template.header_type === 'image' && !template.header_image_path) {
      return res.status(400).json({ error: 'Upload a header image before submitting to Meta' });
    }

    const metaResult = await createMetaTemplate(template);
    const updateRes = await pool.query(
      `UPDATE templates SET meta_status = $1, meta_template_id = $2,
       header_media_handle = COALESCE($4, header_media_handle),
       meta_rejection_reason = NULL, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [
        metaResult.metaStatus,
        metaResult.metaTemplateId,
        template.id,
        metaResult.headerMediaHandle,
      ]
    );

    res.json({ template: updateRes.rows[0] });
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message;
    await pool.query(
      `UPDATE templates SET meta_status = 'failed', meta_rejection_reason = $1, updated_at = NOW()
       WHERE id = $2`,
      [errorMsg, req.params.id]
    );
    res.status(500).json({ error: errorMsg });
  }
});

router.post('/:id/sync-meta', async (req, res) => {
  try {
    const templateRes = await pool.query('SELECT * FROM templates WHERE id = $1', [
      req.params.id,
    ]);
    if (templateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const syncResult = await syncTemplateMetaStatus(templateRes.rows[0]);

    res.json({
      template: syncResult.template,
      warning: syncResult.warning,
    });
  } catch (err) {
    res.status(500).json({
      error: err.response?.data?.error?.message || err.message,
    });
  }
});

router.post('/preview', async (req, res) => {
  try {
    const { template_id, contact_id } = req.body;

    const templateRes = await pool.query('SELECT * FROM templates WHERE id = $1', [
      template_id,
    ]);
    if (templateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const contactRes = await pool.query('SELECT * FROM contacts WHERE id = $1', [
      contact_id,
    ]);
    if (contactRes.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const template = templateRes.rows[0];
    const contact = contactRes.rows[0];
    const preview = replaceVariables(template.body_text, contact);

    res.json({ preview, template, contact });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = [
      'name',
      'whatsapp_template_name',
      'language',
      'category',
      'body_text',
      'variables',
      'header_type',
      'header_value',
      'header_media_handle',
      'header_image_preview',
      'header_image_path',
      'header_image_url',
      'footer_text',
      'button_text',
      'buttons',
    ];

    const updates = ['updated_at = NOW()'];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'whatsapp_template_name') value = sanitizeTemplateName(value);
        if (field === 'header_image_path') {
          value = value ? path.basename(String(value)) : null;
          if (value && !/^[a-f0-9-]+\.(jpg|jpeg|png)$/i.test(value)) {
            return res.status(400).json({ error: 'Invalid header image path' });
          }
        }
        if (field === 'variables' && !value && req.body.body_text) {
          value = detectVariables(req.body.body_text);
        }
        // buttons is jsonb: pg would otherwise send a JS array as a Postgres
        // array literal, which fails to cast to json.
        if (field === 'buttons') {
          value = JSON.stringify(Array.isArray(value) ? value : []);
          updates.push(`${field} = $${paramIdx}::jsonb`);
        } else {
          updates.push(`${field} = $${paramIdx}`);
        }
        values.push(value);
        paramIdx++;
      }
    }

    if (updates.length === 1) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE templates SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM templates WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
