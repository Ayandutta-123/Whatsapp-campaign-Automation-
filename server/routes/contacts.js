const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const pool = require('../db');
const { validatePhone, phoneValidationError } = require('../utils/phone');
const { uploadLimiter } = require('../middleware/rateLimit');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      /sheet|excel|csv|spreadsheet/.test(file.mimetype) ||
      /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Only Excel/CSV files are allowed'));
  },
});

function normalizePhone(phone, defaultCountryCode = null) {
  if (!phone) return null;
  let p = String(phone).replace(/\s/g, '').replace(/-/g, '');

  if (!p.startsWith('+')) {
    const digits = p.replace(/\D/g, '');
    if (!digits) return null;

    if (p.startsWith('00')) {
      p = `+${digits.slice(2)}`;
    } else if (defaultCountryCode) {
      const code = String(defaultCountryCode).replace(/\s/g, '');
      const local = digits.startsWith('0') ? digits.slice(1) : digits;
      p = `${code}${local}`;
    } else if (/^\d/.test(p)) {
      p = `+${digits}`;
    }
  }

  return p;
}

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search || '';
    const tags = req.query.tags || '';
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (search) {
      conditions.push(
        `(name ILIKE $${paramIdx} OR phone ILIKE $${paramIdx} OR company ILIKE $${paramIdx})`
      );
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (tags) {
      conditions.push(`tags @> ARRAY[$${paramIdx}]`);
      params.push(tags);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT COUNT(*) FROM contacts ${where}`,
      params
    );
    const total = parseInt(countRes.rows[0].count, 10);

    const contactsRes = await pool.query(
      `SELECT * FROM contacts ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limit, offset]
    );

    res.json({
      contacts: contactsRes.rows,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/tags', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT DISTINCT unnest(tags) AS tag FROM contacts WHERE tags IS NOT NULL ORDER BY tag'
    );
    res.json(result.rows.map((r) => r.tag).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contacts ORDER BY name');
    const data = result.rows.map((c) => ({
      Name: c.name || '',
      Phone: c.phone,
      Company: c.company || '',
      Email: c.email || '',
      Tags: (c.tags || []).join(', '),
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader(
      'Content-Disposition',
      'attachment; filename=contacts_export.xlsx'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, phone, company, email, tags } = req.body;
    const normalized = normalizePhone(phone);

    if (!validatePhone(normalized)) {
      return res.status(400).json({ error: phoneValidationError(normalized) });
    }

    const result = await pool.query(
      `INSERT INTO contacts (name, phone, company, email, tags)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name || null, normalized, company || null, email || null, tags || []]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/import', uploadLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const defaultCountryCode = req.body?.default_country_code || null;

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    let imported = 0;
    let duplicates = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = row.Name || row.name || '';
      const phoneRaw =
        row.Phone || row.phone || row.WhatsApp || row.mobile || row.Mobile || '';
      const company = row.Company || row.company || '';
      const email = row.Email || row.email || '';
      const tagsRaw = row.Tags || row.tags || '';
      const tags = tagsRaw
        ? String(tagsRaw)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      const phone = normalizePhone(phoneRaw, defaultCountryCode);

      if (!phone) {
        errors.push({ row: rowNum, reason: 'Missing phone number' });
        continue;
      }

      if (!validatePhone(phone)) {
        errors.push({ row: rowNum, reason: 'Invalid phone format' });
        continue;
      }

      try {
        const existing = await pool.query('SELECT id FROM contacts WHERE phone = $1', [
          phone,
        ]);
        if (existing.rows.length > 0) {
          duplicates++;
          continue;
        }

        await pool.query(
          `INSERT INTO contacts (name, phone, company, email, tags)
           VALUES ($1, $2, $3, $4, $5)`,
          [name || null, phone, company || null, email || null, tags]
        );
        imported++;
      } catch (err) {
        errors.push({ row: rowNum, reason: err.message });
      }
    }

    res.json({ imported, duplicates, errors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/bulk', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }

    const result = await pool.query('DELETE FROM contacts WHERE id = ANY($1::int[])', [
      ids,
    ]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'phone', 'company', 'email', 'tags'];
    const updates = [];
    const values = [];
    let paramIdx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'phone') {
          value = normalizePhone(value);
          if (!validatePhone(value)) {
            return res
              .status(400)
              .json({ error: phoneValidationError(value) });
          }
        }
        updates.push(`${field} = $${paramIdx}`);
        values.push(value);
        paramIdx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE contacts SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Phone number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM contacts WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
