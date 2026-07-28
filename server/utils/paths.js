const path = require('path');

/**
 * Resolve on-prem flexible directories from env (absolute or relative to project root).
 */
function projectRoot() {
  return path.join(__dirname, '..', '..');
}

function resolveUploadsDir() {
  if (process.env.UPLOADS_DIR?.trim()) {
    return path.resolve(process.env.UPLOADS_DIR.trim());
  }
  return path.join(projectRoot(), 'uploads');
}

function resolveHeadersDir() {
  return path.join(resolveUploadsDir(), 'headers');
}

function resolveBackupsDir() {
  if (process.env.BACKUPS_DIR?.trim()) {
    return path.resolve(process.env.BACKUPS_DIR.trim());
  }
  return path.join(projectRoot(), 'backups');
}

function graphApiBase() {
  const version = (process.env.META_GRAPH_VERSION || process.env.GRAPH_API_VERSION || 'v21.0')
    .trim()
    .replace(/^\/*/, '');
  return `https://graph.facebook.com/${version}`;
}

module.exports = {
  projectRoot,
  resolveUploadsDir,
  resolveHeadersDir,
  resolveBackupsDir,
  graphApiBase,
};
