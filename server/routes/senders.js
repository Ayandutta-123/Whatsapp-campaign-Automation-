const express = require('express');
const pool = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM sender_numbers ORDER BY is_default DESC, label'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { label, country_prefix, phone_number_id, display_phone, is_default } = req.body;

    if (!label || !country_prefix || !phone_number_id) {
      return res.status(400).json({ error: 'label, country_prefix, and phone_number_id are required' });
    }

    const prefix = country_prefix.startsWith('+') ? country_prefix : `+${country_prefix}`;

    if (is_default) {
      await pool.query('UPDATE sender_numbers SET is_default = false');
    }

    const result = await pool.query(
      `INSERT INTO sender_numbers (label, country_prefix, phone_number_id, display_phone, is_default)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [label, prefix, phone_number_id, display_phone || null, !!is_default]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['label', 'country_prefix', 'phone_number_id', 'display_phone', 'is_default'];
    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        let value = req.body[field];
        if (field === 'country_prefix') {
          value = value.startsWith('+') ? value : `+${value}`;
        }
        if (field === 'is_default' && value) {
          await pool.query('UPDATE sender_numbers SET is_default = false');
        }
        updates.push(`${field} = $${idx}`);
        values.push(value);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE sender_numbers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM sender_numbers WHERE id = $1', [
      req.params.id,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Sender not found' });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
