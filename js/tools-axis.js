const AxisTools = (() => {
  let axisRatioCallback = null;

  // ── Axis label sync helpers ──
  function _findAxisLabels(axisId) {
    return ToolState.canvas.getObjects().filter(o => o._type === 'axis-label' && o._axisId === axisId);
  }

  function _cacheAxisLabelLocals(group) {
    const invMatrix = fabric.util.invertTransform(group.calcTransformMatrix());
    _findAxisLabels(group._axisId).forEach(lbl => {
      lbl._axisLocalPos = fabric.util.transformPoint({ x: lbl.left, y: lbl.top }, invMatrix);
      lbl._axisLocalCC  = fabric.util.transformPoint(lbl._constraintCenter, invMatrix);
    });
  }

  function _applyAxisGroupTransform(group) {
    const matrix     = group.calcTransformMatrix();
    const worldAngle = Math.atan2(matrix[1], matrix[0]) * 180 / Math.PI;
    _findAxisLabels(group._axisId).forEach(lbl => {
      if (!lbl._axisLocalPos) return;
      const worldPos = fabric.util.transformPoint(lbl._axisLocalPos, matrix);
      const worldCC  = fabric.util.transformPoint(lbl._axisLocalCC,  matrix);
      lbl.set({ left: worldPos.x, top: worldPos.y, angle: -worldAngle, _constraintCenter: worldCC });
      lbl.setCoords();
    });
  }

  function _getAxisGroupsFrom(target) {
    if (!target) return [];
    if (target._type === 'axis') return [target];
    if (target.type === 'activeSelection')
      return target._objects.filter(o => o._type === 'axis');
    return [];
  }

  function initAxisCanvas(canvas) {
    canvas.on('before:transform', (e) => {
      _getAxisGroupsFrom(e.transform && e.transform.target).forEach(g => _cacheAxisLabelLocals(g));
    });
    canvas.on('object:moving', (e) => {
      _getAxisGroupsFrom(e.target).forEach(g => _applyAxisGroupTransform(g));
    });
    canvas.on('object:scaling', (e) => {
      _getAxisGroupsFrom(e.target).forEach(g => _applyAxisGroupTransform(g));
    });
    canvas.on('object:rotating', (e) => {
      _getAxisGroupsFrom(e.target).forEach(g => {
        _applyAxisGroupTransform(g);
        const mat = g.calcTransformMatrix();
        const wa  = Math.atan2(mat[1], mat[0]) * 180 / Math.PI;
        g._objects.forEach(o => {
          if (o._type === 'math-label' || o.type === 'text') o.set({ angle: -wa });
        });
        g.set({ dirty: true });
      });
    });
  }

  function buildAxisArrowPath(from, to) {
    const { strokeWidth } = ToolState;
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const headLen = Math.max(14, strokeWidth * 7);
    const headHalf = headLen * 0.24;
    const bx = to.x - headLen * Math.cos(angle);
    const by = to.y - headLen * Math.sin(angle);
    const lx = bx + headHalf * Math.cos(angle + Math.PI / 2);
    const ly = by + headHalf * Math.sin(angle + Math.PI / 2);
    const rx = bx + headHalf * Math.cos(angle - Math.PI / 2);
    const ry = by + headHalf * Math.sin(angle - Math.PI / 2);
    return `M ${from.x} ${from.y} L ${bx} ${by} M ${lx} ${ly} L ${to.x} ${to.y} L ${rx} ${ry} Z`;
  }

  async function buildAxisFromParams(origin, xDir, xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts = {}) {
    const { color, strokeWidth } = ToolState;
    const yDir = { x: xDir.y, y: -xDir.x };

    const xFrom = { x: origin.x - xNegLen * xDir.x, y: origin.y - xNegLen * xDir.y };
    const xTo   = { x: origin.x + xLen * xDir.x,    y: origin.y + xLen * xDir.y    };
    const yFrom = { x: origin.x - yNegLen * yDir.x, y: origin.y - yNegLen * yDir.y };
    const yTo   = { x: origin.x + yLen * yDir.x,    y: origin.y + yLen * yDir.y    };

    const axesPath = new fabric.Path(
      buildAxisArrowPath(xFrom, xTo) + ' ' + buildAxisArrowPath(yFrom, yTo),
      { stroke: color, strokeWidth, fill: color, strokeLineCap: 'butt', strokeLineJoin: 'miter', selectable: false }
    );

    const lo = labelSize * 1.1;
    const oPos = {
      x: origin.x - xDir.x * lo * 0.8 - yDir.x * lo * 0.8,
      y: origin.y - xDir.y * lo * 0.8 - yDir.y * lo * 0.8,
    };
    const xLblPos = {
      x: xTo.x + xDir.x * lo * 0.5 - yDir.x * lo * 0.7,
      y: xTo.y + xDir.y * lo * 0.5 - yDir.y * lo * 0.7,
    };
    const yLblPos = {
      x: yTo.x - xDir.x * lo * 0.7 + yDir.x * lo * 0.5,
      y: yTo.y - xDir.y * lo * 0.7 + yDir.y * lo * 0.5,
    };

    const [oLbl, xLbl, yLbl] = await Promise.all([
      Tools.buildMathLabel('\\mathrm{O}', oPos.x, oPos.y, labelSize),
      Tools.buildMathLabel('x', xLblPos.x, xLblPos.y, labelSize),
      Tools.buildMathLabel('y', yLblPos.x, yLblPos.y, labelSize),
    ]);

    // ── 눈금 생성 ──
    const tickObjs = [];
    const sp = tickOpts.spacing || 0;
    if (sp > 0) {
      const tkLen = Math.max(5, strokeWidth * 2.5);
      const numSz = Math.max(10, labelSize * 0.85);
      const numOff = labelSize * 0.9;

      function makeTick(pos, perpDir, label, isXAxis) {
        if (tickOpts.showTicks !== false) {
          tickObjs.push(new fabric.Line([
            pos.x - tkLen / 2 * perpDir.x, pos.y - tkLen / 2 * perpDir.y,
            pos.x + tkLen / 2 * perpDir.x, pos.y + tkLen / 2 * perpDir.y,
          ], { stroke: color, strokeWidth, selectable: false }));
        }
        if (tickOpts.showNumbers !== false) {
          const offDir = isXAxis ? { x: -yDir.x, y: -yDir.y } : { x: -xDir.x, y: -xDir.y };
          tickObjs.push(new fabric.Text(label, {
            left: pos.x + offDir.x * numOff,
            top:  pos.y + offDir.y * numOff,
            fontSize: numSz, fill: color,
            fontFamily: 'serif',
            originX: 'center', originY: 'center',
            selectable: false,
          }));
        }
      }

      for (let n = 1; n * sp <= xLen;    n++)
        makeTick({ x: origin.x + n*sp*xDir.x, y: origin.y + n*sp*xDir.y }, yDir, String(n),  true);
      for (let n = 1; n * sp <= xNegLen; n++)
        makeTick({ x: origin.x - n*sp*xDir.x, y: origin.y - n*sp*xDir.y }, yDir, String(-n), true);
      for (let n = 1; n * sp <= yLen;    n++)
        makeTick({ x: origin.x + n*sp*yDir.x, y: origin.y + n*sp*yDir.y }, xDir, String(n),  false);
      for (let n = 1; n * sp <= yNegLen; n++)
        makeTick({ x: origin.x - n*sp*yDir.x, y: origin.y - n*sp*yDir.y }, xDir, String(-n), false);
    }

    const group = new fabric.Group([axesPath, ...tickObjs], { lockUniScaling: true });
    group._type   = 'axis';
    group._axisId = `ax-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const constraintRadius = labelSize * 3;
    const labelDefs = [
      [oLbl, oPos,    'O'],
      [xLbl, xLblPos, 'x'],
      [yLbl, yLblPos, 'y'],
    ];
    const labels = labelDefs.map(([lbl, pos, role]) => {
      lbl.set({
        selectable: true, hasControls: false,
        _type: 'axis-label', _axisId: group._axisId, _labelRole: role,
        _constraintCenter: { x: pos.x, y: pos.y },
        _constraintRadius: constraintRadius,
      });
      return lbl;
    });

    return { group, labels };
  }

  // showAxisCreateModal / showAxisRatioModal — legacy dead code (DOM IDs absent from index.html)
  function showAxisCreateModal(origin) {
    document.getElementById('axis-x-len').value     = 200;
    document.getElementById('axis-y-len').value     = 200;
    document.getElementById('axis-x-neg-len').value = 30;
    document.getElementById('axis-y-neg-len').value = 30;
    document.getElementById('axis-label-size').value = 18;
    document.getElementById('axis-tick-spacing').value = 0;
    document.getElementById('axis-show-ticks').checked   = true;
    document.getElementById('axis-show-numbers').checked = true;
    document.getElementById('axis-ratio-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('axis-x-len').focus(), 50);
    axisRatioCallback = async (xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts) => {
      const xDir = { x: 1, y: 0 };
      const { group, labels } = await buildAxisFromParams(origin, xDir, xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts);
      const gc = group.getCenterPoint();
      group._axisData = {
        relOriginX: origin.x - gc.x,
        relOriginY: origin.y - gc.y,
        xDirX: 1, xDirY: 0,
        xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts,
      };
      CanvasManager.setHistoryLock(true);
      ToolState.canvas.add(group);
      labels.forEach(lbl => ToolState.canvas.add(lbl));
      CanvasManager.setHistoryLock(false);
      CanvasManager.saveNow();
      ToolState.canvas.renderAll();
      Tools.switchToSelect();
    };
  }

  async function createDefaultAxis(origin) {
    const xDir = { x: 1, y: 0 };
    const defaults = { xLen: 200, yLen: 200, xNegLen: 30, yNegLen: 30, labelSize: 10,
                       tickOpts: { spacing: 0, showTicks: true, showNumbers: true } };
    const { group, labels } = await buildAxisFromParams(
      origin, xDir, defaults.xLen, defaults.yLen, defaults.xNegLen, defaults.yNegLen,
      defaults.labelSize, defaults.tickOpts
    );
    const gc = group.getCenterPoint();
    group._axisData = {
      relOriginX: origin.x - gc.x, relOriginY: origin.y - gc.y,
      xDirX: 1, xDirY: 0, ...defaults,
    };
    CanvasManager.setHistoryLock(true);
    ToolState.canvas.add(group);
    labels.forEach(lbl => ToolState.canvas.add(lbl));
    CanvasManager.setHistoryLock(false);
    CanvasManager.saveNow();
    ToolState.canvas.setActiveObject(group);
    ToolState.canvas.renderAll();
    Tools.switchToSelect();
  }

  function showAxisRatioModal(group) {
    const data = group._axisData;
    if (!data) return;
    const scale = group.scaleX || 1;
    const tick = data.tickOpts || { spacing: 0, showTicks: true, showNumbers: true };
    document.getElementById('axis-x-len').value    = Math.round(data.xLen    * scale);
    document.getElementById('axis-y-len').value    = Math.round(data.yLen    * scale);
    document.getElementById('axis-x-neg-len').value = Math.round((data.xNegLen || 0) * scale);
    document.getElementById('axis-y-neg-len').value = Math.round((data.yNegLen || 0) * scale);
    document.getElementById('axis-label-size').value = Math.round(data.labelSize || 18);
    document.getElementById('axis-tick-spacing').value = Math.round((tick.spacing || 0) * scale);
    document.getElementById('axis-show-ticks').checked   = tick.showTicks   !== false;
    document.getElementById('axis-show-numbers').checked = tick.showNumbers !== false;
    document.getElementById('axis-ratio-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('axis-x-len').focus(), 50);
    axisRatioCallback = (xLen, yLen, xNegLen, yNegLen, newLabelSize, tickOpts) =>
      rebuildAxis(group, xLen, yLen, xNegLen, yNegLen, newLabelSize, tickOpts);
  }

  async function rebuildAxis(group, newXLen, newYLen, newXNegLen, newYNegLen, newLabelSize, tickOpts) {
    const data = group._axisData;
    if (!data) return;
    const { canvas } = ToolState;
    const matrix = group.calcTransformMatrix();
    const canvasOrigin = fabric.util.transformPoint(
      { x: data.relOriginX, y: data.relOriginY }, matrix
    );
    const angleRad = (group.angle || 0) * Math.PI / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const visXDir = {
      x: data.xDirX * cos - data.xDirY * sin,
      y: data.xDirX * sin + data.xDirY * cos,
    };
    canvas.getObjects()
      .filter(o => o._type === 'axis-label' && o._axisId === group._axisId)
      .forEach(o => canvas.remove(o));

    const { group: newGroup, labels } = await buildAxisFromParams(
      canvasOrigin, visXDir, newXLen, newYLen, newXNegLen, newYNegLen, newLabelSize, tickOpts
    );
    const gc = newGroup.getCenterPoint();
    newGroup._axisData = {
      relOriginX: canvasOrigin.x - gc.x,
      relOriginY: canvasOrigin.y - gc.y,
      xDirX: visXDir.x,
      xDirY: visXDir.y,
      xLen: newXLen,
      yLen: newYLen,
      xNegLen: newXNegLen,
      yNegLen: newYNegLen,
      labelSize: newLabelSize,
      tickOpts,
    };
    CanvasManager.setHistoryLock(true);
    canvas.remove(group);
    canvas.add(newGroup);
    labels.forEach(lbl => canvas.add(lbl));
    CanvasManager.setHistoryLock(false);
    CanvasManager.saveNow();
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
  }

  function confirmAxisRatio() { axisRatioCallback = null; }
  function cancelAxisRatio()  { axisRatioCallback = null; }

  // ungroup 후 axis-label 위치·제약 재동기화
  function refreshAxisLabels(group) {
    const invMatrix = fabric.util.invertTransform(group.calcTransformMatrix());
    _findAxisLabels(group._axisId).forEach(lbl => {
      lbl._axisLocalPos    = fabric.util.transformPoint({ x: lbl.left, y: lbl.top }, invMatrix);
      lbl._constraintCenter = { x: lbl.left, y: lbl.top };
      lbl._axisLocalCC     = fabric.util.transformPoint({ x: lbl.left, y: lbl.top }, invMatrix);
    });
  }

  return {
    createDefaultAxis,
    rebuildAxis,
    confirmAxisRatio,
    cancelAxisRatio,
    initAxisCanvas,
    refreshAxisLabels,
  };
})();
