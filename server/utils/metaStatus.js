function normalizeMetaStatus(status) {
  if (!status) return null;
  return String(status).toLowerCase();
}

// Maps every known Meta API status value to our lowercase internal values
function mapMetaApiStatus(apiStatus) {
  if (!apiStatus) return null;
  const up = String(apiStatus).toUpperCase();
  if (up === 'APPROVED' || up === 'ACTIVE') return 'approved';
  if (up === 'PENDING' || up === 'IN_REVIEW' || up === 'PENDING_DELETION') return 'pending';
  if (up === 'REJECTED' || up === 'DISABLED') return 'rejected';
  if (up === 'PAUSED') return 'paused';
  // quality-related statuses — treat as still approved (just under monitoring)
  if (up.startsWith('QUALITY') || up === 'FLAGGED' || up === 'REINSTATED') return 'approved';
  return String(apiStatus).toLowerCase();
}

function isUsableTemplateStatus(status) {
  const s = normalizeMetaStatus(status);
  return s === 'approved' || s === 'pending';
}

module.exports = {
  normalizeMetaStatus,
  mapMetaApiStatus,
  isUsableTemplateStatus,
};
