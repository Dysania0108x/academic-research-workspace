// Pure guard used before writing a project snapshot to Supabase.
// Reject missing baselines and any remote evidence changes.
export function evidenceSaveConflict(baseline, remoteEvidence) {
  if (baseline === undefined) return 'missing-baseline';
  return JSON.stringify(remoteEvidence || []) === baseline ? null : 'remote-changed';
}
