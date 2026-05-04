function initActions(canvas) {
  function deleteActive() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const targets = obj.type === 'activeSelection' ? canvas.getActiveObjects() : [obj];
    targets.forEach(o => {
      canvas.remove(o);
      if (o._type === 'axis' && o._axisId) {
        canvas.getObjects()
          .filter(lbl => lbl._type === 'axis-label' && lbl._axisId === o._axisId)
          .forEach(lbl => canvas.remove(lbl));
      }
    });
    if (obj.type === 'activeSelection') canvas.discardActiveObject();
    canvas.renderAll();
  }
  AppCtx.deleteActive = deleteActive;

  document.getElementById('btn-export').addEventListener('click', () => CanvasManager.exportPNG());
  document.getElementById('btn-export-svg').addEventListener('click', () => CanvasManager.exportSVG());
  document.getElementById('btn-save').addEventListener('click', () => CanvasManager.saveJSON());
  document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

  document.getElementById('btn-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';
    CanvasManager.snapshot();
  });

  const _gridOverlay = document.getElementById('grid-overlay');
  document.getElementById('btn-grid-snap').addEventListener('click', () => {
    const on = Tools.toggleGridSnap();
    document.getElementById('btn-grid-snap').classList.toggle('active', on);
    _gridOverlay.classList.toggle('hidden', !on);
  });
  document.getElementById('grid-size-input').addEventListener('change', (e) => {
    const sz = Math.max(2, parseInt(e.target.value) || 10);
    Tools.setGridSize(sz);
    _gridOverlay.style.backgroundSize = `${sz}px ${sz}px`;
  });

  document.getElementById('btn-delete').addEventListener('click', () => AppCtx.deleteActive());

  document.getElementById('btn-bring-forward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });
  document.getElementById('btn-send-backward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  function transformActive(fn) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    fn(obj);
    obj.setCoords();
    canvas.renderAll();
    CanvasManager.snapshot();
  }

  document.getElementById('btn-flip-x').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipX: !obj.flipX }));
  });
  document.getElementById('btn-flip-y').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipY: !obj.flipY }));
  });
  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) - 90 + 360) % 360 }));
  });
  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) + 90) % 360 }));
  });
}
