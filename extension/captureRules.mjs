// Pure rules shared by capture UI and tests.
export function eligibleCaptures(captures, projectId) {
  if (!projectId) return [];
  return (captures || []).filter(item => !item.projectId || item.projectId === projectId);
}
export function captureProjectLabel(item, projectId) {
  if (!item.projectId) return 'Legacy capture (project not assigned)';
  return item.projectId === projectId ? 'Current project' : 'Another project';
}

export function assignCaptureProject(captures,captureId,projectId){
  return (captures||[]).map(item=>item.id===captureId&&!item.projectId?{...item,projectId}:item);
}
