export function normalizeMetaStatus(status) {
  if (!status) return '';
  return String(status).toLowerCase();
}

export function isApprovedTemplate(template) {
  const s = normalizeMetaStatus(template?.meta_status);
  return s === 'approved' || s === 'active';
}

export function isSelectableTemplate(template) {
  return true; // all saved templates are selectable
}
