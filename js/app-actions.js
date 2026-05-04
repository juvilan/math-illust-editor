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

  function groupSelection() {
    const ao = canvas.getActiveObject();
    if (!ao || ao.type !== 'activeSelection') return;
    const selected = ao.getObjects();
    if (selected.length < 2) return;

    const axisLabels = [];
    selected.forEach(obj => {
      if (obj._type === 'axis' && obj._axisId) {
        canvas.getObjects()
          .filter(lbl => lbl._type === 'axis-label' && lbl._axisId === obj._axisId && !selected.includes(lbl))
          .forEach(lbl => axisLabels.push(lbl));
      }
    });

    canvas.discardActiveObject();

    CanvasManager.setHistoryLock(true);
    const allMembers = [...selected, ...axisLabels];
    allMembers.forEach(o => canvas.remove(o));

    const grp = new fabric.Group(allMembers, { canvas });
    grp._type = 'meta-group';
    canvas.add(grp);
    canvas.setActiveObject(grp);
    canvas.renderAll();
    CanvasManager.setHistoryLock(false);
    CanvasManager.saveNow();
  }
  AppCtx.groupSelection = groupSelection;

  function ungroupSelection() {
    const ao = canvas.getActiveObject();
    if (!ao || ao._type !== 'meta-group') return;

    const matrix   = ao.calcTransformMatrix();
    const members  = [...ao._objects];

    CanvasManager.setHistoryLock(true);
    canvas.remove(ao);

    members.forEach(obj => {
      const worldPt = fabric.util.transformPoint({ x: obj.left, y: obj.top }, matrix);
      obj.group = null; // stale 그룹 참조 제거 (hit-testing 오류 방지)
      obj.set({
        left:    worldPt.x,
        top:     worldPt.y,
        angle:   (obj.angle  || 0) + (ao.angle  || 0),
        scaleX:  (obj.scaleX || 1) * (ao.scaleX || 1),
        scaleY:  (obj.scaleY || 1) * (ao.scaleY || 1),
        selectable: true,
        evented:    true,
      });
      obj.setCoords();
      canvas.add(obj);
    });

    canvas.discardActiveObject();
    canvas.renderAll();
    CanvasManager.setHistoryLock(false);
    CanvasManager.saveNow();

    canvas.getObjects()
      .filter(o => o._type === 'axis')
      .forEach(g => AxisTools.refreshAxisLabels(g));
  }
  AppCtx.ungroupSelection = ungroupSelection;

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
