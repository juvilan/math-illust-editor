// Shared DI container for app modules — set during init, never null after DOMContentLoaded
window.AppCtx = {
  canvas: null,
  eachLeaf: null,
  deleteActive: null,
  eyedropperActive: false,
  handleEyedropperClick: null,
  syncInspector: null,
};
