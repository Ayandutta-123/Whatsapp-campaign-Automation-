const pool = require('../db');
const { sanitizePhoneNumberId } = require('./phoneNumberId');

async function getSenderNumbers() {
  const res = await pool.query(
    'SELECT * FROM sender_numbers ORDER BY LENGTH(country_prefix) DESC, id'
  );
  return res.rows;
}

async function getSenderById(id) {
  const res = await pool.query('SELECT * FROM sender_numbers WHERE id = $1', [id]);
  return res.rows[0] || null;
}

async function settingsPhoneNumberId() {
  const settingRes = await pool.query(
    "SELECT value FROM settings WHERE key = 'phone_number_id'"
  );
  const fromDb = sanitizePhoneNumberId(settingRes.rows[0]?.value);
  if (fromDb) return fromDb;
  return sanitizePhoneNumberId(process.env.PHONE_NUMBER_ID);
}

async function getPhoneNumberIdForContact(phone) {
  const senders = await getSenderNumbers();
  const normalized = phone || '';

  for (const sender of senders) {
    if (normalized.startsWith(sender.country_prefix)) {
      const id = sanitizePhoneNumberId(sender.phone_number_id);
      if (id) return id;
      console.warn(
        `Sender "${sender.label}" has invalid phone_number_id "${sender.phone_number_id}" — skipping`
      );
    }
  }

  const defaultSender = senders.find((s) => s.is_default);
  if (defaultSender) {
    const id = sanitizePhoneNumberId(defaultSender.phone_number_id);
    if (id) return id;
  }

  return settingsPhoneNumberId();
}

async function resolvePhoneNumberId(contactPhone, campaign = null) {
  if (campaign?.sender_mode === 'fixed' && campaign?.sender_number_id) {
    const sender = await getSenderById(campaign.sender_number_id);
    const id = sanitizePhoneNumberId(sender?.phone_number_id);
    if (id) return id;
    console.warn(
      `Fixed sender #${campaign.sender_number_id} has invalid phone_number_id — falling back`
    );
  }
  return getPhoneNumberIdForContact(contactPhone);
}

/** Fix known bad rows: display phones stored as Meta IDs */
async function repairInvalidSenderPhoneNumberIds() {
  const fallback = await settingsPhoneNumberId();
  const senders = await getSenderNumbers();
  let fixed = 0;

  for (const sender of senders) {
    const valid = sanitizePhoneNumberId(sender.phone_number_id);
    if (valid) {
      if (valid !== String(sender.phone_number_id).trim()) {
        await pool.query(
          'UPDATE sender_numbers SET phone_number_id = $1 WHERE id = $2',
          [valid, sender.id]
        );
        fixed += 1;
      }
      continue;
    }

    if (fallback) {
      await pool.query(
        'UPDATE sender_numbers SET phone_number_id = $1 WHERE id = $2',
        [fallback, sender.id]
      );
      console.warn(
        `Repaired sender #${sender.id} ("${sender.label}"): replaced invalid phone_number_id "${sender.phone_number_id}" with Settings Phone Number ID`
      );
      fixed += 1;
    } else {
      console.warn(
        `Sender #${sender.id} ("${sender.label}") has invalid phone_number_id "${sender.phone_number_id}" and no Settings fallback`
      );
    }
  }

  return fixed;
}

module.exports = {
  getSenderNumbers,
  getSenderById,
  getPhoneNumberIdForContact,
  resolvePhoneNumberId,
  repairInvalidSenderPhoneNumberIds,
};
