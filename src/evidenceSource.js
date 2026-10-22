// Shared presentation rules for PDF, web and manually entered evidence.
export function evidenceSourceLabel(e, papers = []) {
  if (e.paperId) {
    const paper = papers.find(p => p.id === e.paperId);
    return (paper?.name || 'Unknown PDF') + ' · Page ' + (e.page || '?');
  }
  const name = String(e.sourceTitle || e.source || '').trim() || 'Source not specified';
  return name + ' · ' + (e.sourceType === 'web' ? 'Website' : 'Manual');
}
export function safeEvidenceUrl(e) {
  try {
    const u = new URL(e?.sourceUrl || '');
    return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : null;
  } catch { return null; }
}
export function isVerifiedEvidence(e) {
  return Boolean(e?.paperId || e?.verified === true || e?.verificationStatus === 'verified');
}
