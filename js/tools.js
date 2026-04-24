const Tools = (() => {
  let canvas = null;
  let currentTool = 'select';

  // Drawing state
  let isDrawing = false;
  let startPt = null;
  let previewObj = null;

  // Arc-dim tool state
  let pendingArcStart = null;
  let pendingArcEnd = null;

  // Pending placement for angle tool
  let pendingAngleCenter = null;
  let pendingAngleRadius = null;
  let pendingAngleStartAngle = null;

  // Axis ratio modal callback
  let axisRatioCallback = null;

  // Graph tool state
  let _pendingGraphCtx = null;

  // Grid snap
  let gridSnapEnabled = false;
  let gridSize = 10;

  // Options
  let color = '#000000';
  let strokeWidth = 2;
  let fillOpacity = 0.3;
  let fontSize = 18;
  let dashPattern = [8, 6];

  // Text/angle modal callbacks
  let textCallback = null;
  let angleCallback = null;

  function init(c) {
    canvas = c;
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:dblclick', onDblClick);
  }

  function setTool(tool) {
    currentTool = tool;
    isDrawing = false;
    startPt = null;
    removePreview();

    const isSelect = tool === 'select';
    canvas.isDrawingMode = false;
    canvas.selection = isSelect;
    canvas.defaultCursor = isSelect ? 'default' : 'crosshair';

    canvas.getObjects().forEach(obj => {
      obj.selectable = isSelect;
      obj.evented = isSelect;
    });
    canvas.renderAll();
  }

  function setColor(c) { color = c; }
  function setStrokeWidth(w) { strokeWidth = parseInt(w); }
  function setFillOpacity(o) { fillOpacity = parseFloat(o) / 100; }
  function setFontSize(s) { fontSize = parseInt(s); }
  function setDashPattern(v) { dashPattern = v.split(',').map(Number); }
  function getCurrentTool() { return currentTool; }

  // 도구 배치 후 select로 자동 복귀
  function switchToSelect() {
    setTool('select');
    document.dispatchEvent(new CustomEvent('tool:switch', { detail: 'select' }));
  }

  // ── Pointer helper ──
  function ptr(e) { return canvas.getPointer(e.e); }
  function ptSnap(e) {
    const p = ptr(e);
    if (!gridSnapEnabled) return p;
    return { x: Math.round(p.x / gridSize) * gridSize, y: Math.round(p.y / gridSize) * gridSize };
  }
  function dist(a, b) { return Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2); }

  // Shift 누르면 45° 단위로 스냅 (수평·수직·대각선)
  function snapAngle(start, raw, e) {
    if (!e.e || !e.e.shiftKey) return raw;
    const dx = raw.x - start.x;
    const dy = raw.y - start.y;
    const angle = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const r = Math.sqrt(dx * dx + dy * dy);
    return { x: start.x + r * Math.cos(snapped), y: start.y + r * Math.sin(snapped) };
  }

  // ── Remove preview object ──
  function removePreview() {
    if (previewObj) {
      canvas.remove(previewObj);
      previewObj = null;
    }
  }

  // ── Mouse events ──
  function onMouseDown(e) {
    if (currentTool === 'select') return;

    const p = ptSnap(e);

    if (currentTool === 'text') {
      showTextModal(p);
      return;
    }

    if (currentTool === 'bucket') {
      applyBucketFill(p);
      return;
    }

    if (currentTool === 'point' || currentTool === 'open-point') {
      canvas.add(buildPoint(p, currentTool === 'open-point'));
      canvas.renderAll();
      return;
    }

    if (currentTool === 'axis') {
      showAxisCreateModal(p);
      return;
    }

    if (currentTool === 'graph') {
      showGraphModal(p);
      return;
    }

    isDrawing = true;
    startPt = p;
  }

  function onMouseMove(e) {
    if (!isDrawing || !startPt) return;
    const p = snapAngle(startPt, ptSnap(e), e);
    removePreview();

    const obj = buildObject(startPt, p);
    if (obj) {
      obj._isTempPreview = true;
      obj.set({ opacity: 0.5, selectable: false, evented: false });
      canvas.add(obj);
      canvas.renderAll();
      previewObj = obj;
    }
  }

  function onMouseUp(e) {
    if (!isDrawing || !startPt) return;
    isDrawing = false;

    const p = snapAngle(startPt, ptSnap(e), e);
    removePreview();

    if (dist(startPt, p) < 4) { startPt = null; return; }

    if (currentTool === 'angle') {
      pendingAngleCenter = { ...startPt };
      pendingAngleRadius = dist(startPt, p) * 0.35;
      pendingAngleStartAngle = Math.atan2(p.y - startPt.y, p.x - startPt.x) * 180 / Math.PI;
      showAngleModal();
      startPt = null;
      return;
    }

    if (currentTool === 'arc-dim') {
      pendingArcStart = { ...startPt };
      pendingArcEnd = { ...p };
      showTextModal(p, 'arc-dim');
      startPt = null;
      return;
    }

    if (currentTool === 'projection') {
      const obj = buildProjection(startPt, p);
      canvas.add(obj);
      canvas.renderAll();
      startPt = null;
      switchToSelect();
      return;
    }

    const obj = buildObject(startPt, p);
    if (obj) {
      canvas.add(obj);
      canvas.renderAll();
    }
    startPt = null;
  }

  function onDblClick(e) {
    if (currentTool !== 'select') return;

    // 좌표축 더블클릭 → 축 길이 조정
    if (e.target && e.target._type === 'axis') {
      showAxisRatioModal(e.target);
      return;
    }

    // 수식 텍스트 더블클릭 → 수정
    if (e.target && e.target._type === 'math-text') {
      const existing = e.target;
      const modal = document.getElementById('text-modal');
      document.getElementById('modal-title').textContent = '수식 수정';
      const input = document.getElementById('text-input');
      input.value = existing._latex || '';
      modal.classList.remove('hidden');
      setTimeout(() => { input.select(); input.focus(); }, 50);
      textCallback = async (newLatex) => {
        if (!newLatex.trim()) return;
        const newImg = await buildMathText({ x: existing.left, y: existing.top }, newLatex);
        canvas.remove(existing);
        canvas.add(newImg);
        canvas.renderAll();
      };
      return;
    }

    // 각도 그룹 더블클릭 → 라벨 수정
    if (e.target && e.target._type === 'angle') {
      const grp = e.target;
      const labelObj = grp._objects.find(o => o._type === 'math-label' || o.type === 'text');
      const modal = document.getElementById('angle-modal');
      document.getElementById('angle-input').value = labelObj
        ? (labelObj._latex || labelObj.text || '90°') : '90°';
      modal.classList.remove('hidden');
      setTimeout(() => {
        document.getElementById('angle-input').select();
        document.getElementById('angle-input').focus();
      }, 50);
      angleCallback = async (angleValue, displayLabel) => {
        const show = displayLabel && displayLabel.trim();
        const prevAngle = labelObj ? (labelObj.angle || 0) : 0;
        const prevLeft  = labelObj ? labelObj.left  : 0;
        const prevTop   = labelObj ? labelObj.top   : 0;
        const idx = grp._objects.indexOf(labelObj);
        if (!show) {
          if (idx !== -1) grp._objects.splice(idx, 1);
        } else {
          const newLbl = await buildMathLabel(displayLabel, prevLeft, prevTop);
          newLbl.angle = prevAngle;
          if (idx !== -1) grp._objects[idx] = newLbl;
          else grp._objects.push(newLbl);
        }
        grp.set({ dirty: true });
        canvas.requestRenderAll();
      };
      return;
    }

    // 호치수 그룹 더블클릭 → 라벨 수정
    if (e.target && e.target._type === 'arc-dim') {
      const grp = e.target;
      const labelObj = grp._objects.find(o => o._type === 'math-label' || o.type === 'text');
      const modal = document.getElementById('text-modal');
      document.getElementById('modal-title').textContent = '호 치수 수정';
      const input = document.getElementById('text-input');
      input.value = labelObj ? (labelObj._latex || labelObj.text || '') : '';
      modal.classList.remove('hidden');
      setTimeout(() => { input.select(); input.focus(); }, 50);
      textCallback = async (newLabel) => {
        if (!newLabel.trim()) return;
        const newLbl = await buildMathLabel(
          newLabel,
          labelObj ? labelObj.left : 0,
          labelObj ? labelObj.top : 0
        );
        newLbl.angle = labelObj ? (labelObj.angle || 0) : 0;
        const idx = grp._objects.indexOf(labelObj);
        if (idx !== -1) grp._objects[idx] = newLbl;
        else grp._objects.push(newLbl);
        grp.set({ dirty: true });
        canvas.requestRenderAll();
      };
    }
  }

  // ── Build object by tool ──
  function buildObject(start, end) {
    switch (currentTool) {
      case 'arrow':        return buildArrow(start, end, false);
      case 'double-arrow': return buildArrow(start, end, true);
      case 'line':         return buildLine(start, end, false);
      case 'dashed-line':  return buildLine(start, end, true);
      case 'arc-dim':      return buildArcDimPreview(start, end);
      case 'projection':   return buildProjectionPreview(start, end);
      default:             return null;
    }
  }

  // 호치수 미리보기 (라벨 없는 점선 호)
  function buildArcDimPreview(start, end) {
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const sag = Math.min(len * 0.3, 60);
    return new fabric.Path(
      `M ${start.x} ${start.y} Q ${mx - (dy / len) * sag} ${my + (dx / len) * sag} ${end.x} ${end.y}`,
      { stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern }
    );
  }

  // ── Bucket fill ──
  function applyBucketFill(p) {
    FillTool.apply(canvas, p.x, p.y, color, fillOpacity, (err, img) => {
      if (err) {
        // 선 위를 클릭했거나 배경 없음 — 캔버스를 짧게 흔들어 피드백
        const el = canvas.getElement().parentElement;
        el.style.outline = '2px solid #f38ba8';
        setTimeout(() => { el.style.outline = ''; }, 300);
        return;
      }
      canvas.add(img);
      canvas.renderAll();
    });
  }

  // ── Point tool ──
  function buildPoint(p, isOpen) {
    const r = Math.max(4, strokeWidth * 2);
    return new fabric.Circle({
      left: p.x, top: p.y,
      radius: r,
      fill: isOpen ? '#ffffff' : color,
      stroke: color,
      strokeWidth: isOpen ? Math.max(1, strokeWidth * 0.8) : 0,
      originX: 'center', originY: 'center',
      lockUniScaling: true,
    });
  }

  // ── Grid snap controls ──
  function toggleGridSnap() {
    gridSnapEnabled = !gridSnapEnabled;
    return gridSnapEnabled;
  }
  function setGridSize(v) { gridSize = Math.max(1, parseInt(v) || 10); }

  // ── Object lock ──
  function toggleLock() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const lock = !obj._locked;
    const targets = obj.type === 'activeSelection' ? obj._objects : [obj];
    targets.forEach(o => {
      o.set({
        lockMovementX: lock, lockMovementY: lock,
        lockRotation: lock, lockScalingX: lock, lockScalingY: lock,
        hasControls: !lock,
        _locked: lock,
      });
    });
    canvas.requestRenderAll();
    return lock;
  }

  // ── Line / Dashed line ──
  function buildLine(start, end, dashed) {
    return new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: color,
      strokeWidth,
      fill: '',
      strokeDashArray: dashed ? dashPattern : null,
      lockUniScaling: true,
      padding: 6,
    });
  }

  // ── Arrow (수능 교과서 스타일 — 날렵한 화살촉) ──
  function buildArrow(start, end, bothSides) {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const sw = strokeWidth;
    const headLen = Math.max(12, sw * 6);
    const headHalf = headLen * 0.24; // 수능 스타일: 좁고 날렵하게

    // 오른쪽(끝) 화살촉
    const rbx = end.x - headLen * Math.cos(angle);
    const rby = end.y - headLen * Math.sin(angle);
    const rlx = rbx + headHalf * Math.cos(angle + Math.PI / 2);
    const rly = rby + headHalf * Math.sin(angle + Math.PI / 2);
    const rrx = rbx + headHalf * Math.cos(angle - Math.PI / 2);
    const rry = rby + headHalf * Math.sin(angle - Math.PI / 2);

    const lineFrom = bothSides
      ? { x: start.x + headLen * Math.cos(angle), y: start.y + headLen * Math.sin(angle) }
      : start;

    // 선: lineFrom → 화살촉 밑변 중심
    let d = `M ${lineFrom.x} ${lineFrom.y} L ${rbx} ${rby}`;
    // 오른쪽 화살촉 삼각형
    d += ` M ${rlx} ${rly} L ${end.x} ${end.y} L ${rrx} ${rry} Z`;

    if (bothSides) {
      // 왼쪽(시작) 화살촉
      const lbx = start.x + headLen * Math.cos(angle);
      const lby = start.y + headLen * Math.sin(angle);
      const llx = lbx + headHalf * Math.cos(angle - Math.PI / 2);
      const lly = lby + headHalf * Math.sin(angle - Math.PI / 2);
      const lrx = lbx + headHalf * Math.cos(angle + Math.PI / 2);
      const lry = lby + headHalf * Math.sin(angle + Math.PI / 2);
      d += ` M ${llx} ${lly} L ${start.x} ${start.y} L ${lrx} ${lry} Z`;
    }

    return new fabric.Path(d, {
      stroke: color, strokeWidth: sw,
      fill: color,
      strokeLineCap: 'butt',
      strokeLineJoin: 'miter',
      lockUniScaling: true,
    });
  }

  // ── Axis tool ──
  function buildAxisArrowPath(from, to) {
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
      buildMathLabel('\\mathrm{O}', oPos.x, oPos.y, labelSize),
      buildMathLabel('x', xLblPos.x, xLblPos.y, labelSize),
      buildMathLabel('y', yLblPos.x, yLblPos.y, labelSize),
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
          // x축: 숫자를 -yDir(아래), y축: 숫자를 -xDir(왼쪽)
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

    const group = new fabric.Group([axesPath, oLbl, xLbl, yLbl, ...tickObjs], { lockUniScaling: true });
    group._type = 'axis';
    group.on('rotating', function () {
      this._objects.forEach(o => {
        if (o._type === 'math-label' || o.type === 'text') o.set({ angle: -this.angle });
      });
      this.set({ dirty: true });
    });
    return group;
  }

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
      const group = await buildAxisFromParams(origin, xDir, xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts);
      const gc = group.getCenterPoint();
      group._axisData = {
        relOriginX: origin.x - gc.x,
        relOriginY: origin.y - gc.y,
        xDirX: 1, xDirY: 0,
        xLen, yLen, xNegLen, yNegLen, labelSize, tickOpts,
      };
      canvas.add(group);
      canvas.renderAll();
      switchToSelect();
    };
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
    axisRatioCallback = (xLen, yLen, xNegLen, yNegLen, newLabelSize, tickOpts) => rebuildAxis(group, xLen, yLen, xNegLen, yNegLen, newLabelSize, tickOpts);
  }

  async function rebuildAxis(group, newXLen, newYLen, newXNegLen, newYNegLen, newLabelSize, tickOpts) {
    const data = group._axisData;
    if (!data) return;
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
    const newGroup = await buildAxisFromParams(
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
    canvas.remove(group);
    canvas.add(newGroup);
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
  }

  async function confirmAxisRatio() {
    const xLen      = parseFloat(document.getElementById('axis-x-len').value);
    const yLen      = parseFloat(document.getElementById('axis-y-len').value);
    const xNegLen   = parseFloat(document.getElementById('axis-x-neg-len').value)  || 0;
    const yNegLen   = parseFloat(document.getElementById('axis-y-neg-len').value)  || 0;
    const labelSize = parseFloat(document.getElementById('axis-label-size').value) || 18;
    const spacing   = parseFloat(document.getElementById('axis-tick-spacing').value) || 0;
    const showTicks   = document.getElementById('axis-show-ticks').checked;
    const showNumbers = document.getElementById('axis-show-numbers').checked;
    document.getElementById('axis-ratio-modal').classList.add('hidden');
    if (axisRatioCallback && xLen > 0 && yLen > 0) {
      await axisRatioCallback(xLen, yLen, xNegLen, yNegLen, labelSize, { spacing, showTicks, showNumbers });
      axisRatioCallback = null;
    }
  }

  function cancelAxisRatio() {
    document.getElementById('axis-ratio-modal').classList.add('hidden');
    axisRatioCallback = null;
  }

  // ── Graph tool ──
  function showGraphModal(clickPt) {
    const axisGroups = canvas.getObjects().filter(o => o._type === 'axis' && o._axisData);
    let axisOrigin = { ...clickPt };
    let axisXDir   = { x: 1, y: 0 };
    let axisYDir   = { x: 0, y: -1 };
    let minDist    = Infinity;

    for (const g of axisGroups) {
      const data   = g._axisData;
      const matrix = g.calcTransformMatrix();
      const pt     = fabric.util.transformPoint({ x: data.relOriginX, y: data.relOriginY }, matrix);
      const d      = Math.sqrt((pt.x - clickPt.x) ** 2 + (pt.y - clickPt.y) ** 2);
      if (d < minDist) {
        minDist = d;
        axisOrigin = pt;
        const angleRad = (g.angle || 0) * Math.PI / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        axisXDir = { x: data.xDirX * cos - data.xDirY * sin, y: data.xDirX * sin + data.xDirY * cos };
        axisYDir = { x: axisXDir.y, y: -axisXDir.x };
        const tick  = data.tickOpts || {};
        const scale = g.scaleX || 1;
        if (tick.spacing > 0) {
          const pxPerUnit = tick.spacing * scale;
          document.getElementById('graph-scale').value = Math.round(pxPerUnit);
          document.getElementById('graph-scale-hint').textContent = `축에서 감지: ${Math.round(pxPerUnit)}px/단위`;
          document.getElementById('graph-xmin').value = -Math.floor(data.xNegLen / tick.spacing);
          document.getElementById('graph-xmax').value =  Math.floor(data.xLen    / tick.spacing);
        } else {
          document.getElementById('graph-scale').value = 40;
          document.getElementById('graph-scale-hint').textContent = '수동 입력 (축 눈금 없음)';
          document.getElementById('graph-xmin').value = -5;
          document.getElementById('graph-xmax').value =  5;
        }
      }
    }

    if (axisGroups.length === 0) {
      document.getElementById('graph-scale').value = 40;
      document.getElementById('graph-scale-hint').textContent = '';
      document.getElementById('graph-xmin').value = -5;
      document.getElementById('graph-xmax').value =  5;
    }

    _pendingGraphCtx = { axisOrigin, axisXDir, axisYDir };
    document.getElementById('graph-expr').value = '';
    document.getElementById('graph-expr').style.outline = '';
    document.getElementById('graph-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('graph-expr').focus(), 50);
  }

  // 수학 표현식만 허용 — Math 함수명 제거 후 숫자·연산자·괄호·x만 남아야 통과
  const _MATH_NAMES = /\b(abs|acos|asin|atan2|atan|ceil|cos|exp|floor|log2|log|max|min|pow|round|sign|sin|sqrt|tan|PI|E)\b/g;
  const _SAFE_RE    = /^[0-9x\s\+\-\*\/\^().,!%]+$/;
  function _isSafeMathExpr(expr) {
    return _SAFE_RE.test(expr.replace(_MATH_NAMES, '1'));
  }

  function buildGraphPath(exprStr, xMin, xMax, pixelsPerUnit, origin, xDir, yDir) {
    if (!_isSafeMathExpr(exprStr)) return null;
    const fnBody = `const {abs,acos,asin,atan,atan2,ceil,cos,exp,floor,log,log2,max,min,pow,round,sign,sin,sqrt,tan,PI,E}=Math; return (${exprStr});`;
    let fn;
    try { fn = new Function('x', fnBody); } catch (_) { return null; }

    const steps    = Math.min(Math.ceil(Math.abs(xMax - xMin) * pixelsPerUnit), 2000);
    const maxJump  = pixelsPerUnit * 10;
    let d          = '';
    let prevCy     = null;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      let y;
      try { y = fn(x); } catch (_) { prevCy = null; continue; }
      if (!isFinite(y) || isNaN(y)) { prevCy = null; continue; }

      const cx = origin.x + x * pixelsPerUnit * xDir.x + y * pixelsPerUnit * yDir.x;
      const cy = origin.y + x * pixelsPerUnit * xDir.y + y * pixelsPerUnit * yDir.y;

      if (prevCy !== null && Math.abs(cy - prevCy) > maxJump) { prevCy = null; }
      d += prevCy === null ? `M ${cx} ${cy} ` : `L ${cx} ${cy} `;
      prevCy = cy;
    }

    if (!d.trim()) return null;

    const path = new fabric.Path(d, { stroke: color, strokeWidth, fill: '', lockUniScaling: true });
    path._type       = 'graph';
    path._graphExpr  = exprStr;
    path._graphXMin  = xMin;
    path._graphXMax  = xMax;
    path._graphScale = pixelsPerUnit;
    return path;
  }

  function confirmGraph() {
    const ctx = _pendingGraphCtx;
    if (!ctx) return;
    const exprStr = document.getElementById('graph-expr').value.trim();
    const xMin    = parseFloat(document.getElementById('graph-xmin').value);
    const xMax    = parseFloat(document.getElementById('graph-xmax').value);
    const scale   = parseFloat(document.getElementById('graph-scale').value) || 40;

    if (!exprStr || isNaN(xMin) || isNaN(xMax) || xMin >= xMax) return;

    const path = buildGraphPath(exprStr, xMin, xMax, scale, ctx.axisOrigin, ctx.axisXDir, ctx.axisYDir);
    if (!path) {
      document.getElementById('graph-expr').style.outline = '2px solid #f38ba8';
      setTimeout(() => { document.getElementById('graph-expr').style.outline = ''; }, 800);
      return;
    }
    document.getElementById('graph-modal').classList.add('hidden');
    _pendingGraphCtx = null;
    canvas.add(path);
    canvas.renderAll();
    switchToSelect();
  }

  function cancelGraph() {
    document.getElementById('graph-modal').classList.add('hidden');
    _pendingGraphCtx = null;
  }

  // ── Projection tool ──
  function buildProjectionPreview(start, end) {
    const d = `M ${start.x} ${start.y} L ${start.x} ${end.y} M ${start.x} ${start.y} L ${end.x} ${start.y}`;
    return new fabric.Path(d, { stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern });
  }

  function buildProjection(start, end) {
    const vLine = new fabric.Line([start.x, start.y, start.x, end.y], {
      stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern, selectable: false,
    });
    const hLine = new fabric.Line([start.x, start.y, end.x, start.y], {
      stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern, selectable: false,
    });
    const dot = new fabric.Circle({
      left: start.x, top: start.y,
      radius: Math.max(3, strokeWidth * 1.5),
      fill: color, stroke: '',
      originX: 'center', originY: 'center', selectable: false,
    });
    const group = new fabric.Group([vLine, hLine, dot], { lockUniScaling: true });
    group._type = 'projection';
    return group;
  }

  // ── Arc dimension line ──
  async function buildArcDim(start, end, label) {
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const sag = Math.min(len * 0.3, 60);
    const cpx = mx - (dy / len) * sag;
    const cpy = my + (dx / len) * sag;

    function lerp(a, b, t) { return a + (b - a) * t; }

    const labelWidth = fontSize * label.length * 0.55 + 10;
    const gapHalf = Math.min(0.18, labelWidth / (len + 1));
    const t1 = 0.5 - gapHalf;
    const t2 = 0.5 + gapHalf;

    const cp01_t1 = { x: lerp(start.x, cpx, t1), y: lerp(start.y, cpy, t1) };
    const cp12_t1 = { x: lerp(cpx, end.x, t1), y: lerp(cpy, end.y, t1) };
    const bt1 = { x: lerp(cp01_t1.x, cp12_t1.x, t1), y: lerp(cp01_t1.y, cp12_t1.y, t1) };
    const cp01_t2 = { x: lerp(start.x, cpx, t2), y: lerp(start.y, cpy, t2) };
    const cp12_t2 = { x: lerp(cpx, end.x, t2), y: lerp(cpy, end.y, t2) };
    const bt2 = { x: lerp(cp01_t2.x, cp12_t2.x, t2), y: lerp(cp01_t2.y, cp12_t2.y, t2) };

    const arcOpts = { stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern, selectable: false };
    const arc1 = new fabric.Path(`M ${start.x} ${start.y} Q ${cp01_t1.x} ${cp01_t1.y} ${bt1.x} ${bt1.y}`, arcOpts);
    const arc2 = new fabric.Path(`M ${bt2.x} ${bt2.y} Q ${cp12_t2.x} ${cp12_t2.y} ${end.x} ${end.y}`, arcOpts);

    const tx = (bt1.x + bt2.x) / 2;
    const ty = (bt1.y + bt2.y) / 2;
    const lbl = await buildMathLabel(label, tx, ty);

    const group = new fabric.Group([arc1, arc2, lbl], { lockUniScaling: true });
    group._type = 'arc-dim';
    group.on('rotating', function () {
      const t = this._objects.find(o => o._type === 'math-label' || o.type === 'text');
      if (t) { t.set({ angle: -this.angle }); this.set({ dirty: true }); }
    });
    return group;
  }

  // ── Angle marker ──
  // angleValue: 호 크기 계산용, displayLabel: 화면 표시용 (빈 문자열 = 라벨 없음)
  async function buildAngleMarker(center, radius, startAngleDeg, angleValue, displayLabel) {
    if (displayLabel === undefined) displayLabel = angleValue; // 하위 호환
    const numMatch = (angleValue || '').match(/[\d.]+/);
    const sweepDeg = numMatch ? parseFloat(numMatch[0]) : 45;
    const isRight = Math.abs(sweepDeg - 90) < 1;

    let shapeObj;
    if (isRight) {
      const s = Math.max(8, radius * 0.55);
      const a = degToRad(startAngleDeg);
      const b = a - Math.PI / 2;
      const p1x = center.x + s * Math.cos(a);
      const p1y = center.y + s * Math.sin(a);
      const p2x = p1x + s * Math.cos(b);
      const p2y = p1y + s * Math.sin(b);
      const p3x = center.x + s * Math.cos(b);
      const p3y = center.y + s * Math.sin(b);
      shapeObj = new fabric.Path(
        `M ${center.x} ${center.y} L ${p1x} ${p1y} L ${p2x} ${p2y} L ${p3x} ${p3y} Z`,
        { stroke: color, strokeWidth, fill: 'rgba(0,0,0,0)' }
      );
    } else {
      shapeObj = new fabric.Path(
        describeArc(center.x, center.y, radius, startAngleDeg, startAngleDeg + sweepDeg),
        { stroke: color, strokeWidth, fill: '' }
      );
    }

    const base = isRight ? Math.max(8, radius * 0.55) : radius;
    const labelDist = base * 1.9 + fontSize * 0.4;
    const lx = center.x + labelDist * Math.cos(degToRad(startAngleDeg + sweepDeg / 2));
    const ly = center.y + labelDist * Math.sin(degToRad(startAngleDeg + sweepDeg / 2));

    const children = [shapeObj];
    if (displayLabel && displayLabel.trim()) {
      const label = await buildMathLabel(displayLabel, lx, ly);
      children.push(label);
    }

    const group = new fabric.Group(children, { lockUniScaling: true });
    group._type = 'angle';
    group.on('rotating', function () {
      const t = this._objects.find(o => o._type === 'math-label' || o.type === 'text');
      if (t) { t.set({ angle: -this.angle }); this.set({ dirty: true }); }
    });
    return group;
  }

  function describeArc(cx, cy, r, startDeg, endDeg) {
    const s = degToRad(startDeg);
    const e = degToRad(endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return [
      `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)}`,
      `A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`,
    ].join(' ');
  }

  function degToRad(d) { return d * Math.PI / 180; }

  // ── Text / Point label modal ──
  function showTextModal(p, mode) {
    const modal = document.getElementById('text-modal');
    const input = document.getElementById('text-input');
    const titleMap = { 'arc-dim': '호 치수 입력', 'point': '점 라벨 입력' };
    document.getElementById('modal-title').textContent =
      titleMap[mode || currentTool] || '텍스트 입력';
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);

    textCallback = async (text) => {
      if (!text.trim()) return;
      if (mode === 'arc-dim' && pendingArcStart && pendingArcEnd) {
        const obj = await buildArcDim(pendingArcStart, pendingArcEnd, text);
        canvas.add(obj);
        canvas.renderAll();
        pendingArcStart = null;
        pendingArcEnd = null;
        switchToSelect();
      } else if (!mode) {
        const obj = await buildMathText(p, text);
        canvas.add(obj);
        canvas.renderAll();
        switchToSelect();
      }
    };
  }

  function buildText(p, text) {
    return new fabric.Text(text, {
      left: p.x, top: p.y,
      fontSize, fill: color,
      fontFamily: 'serif',
      fontStyle: 'italic',
      originX: 'center', originY: 'center',
      lockUniScaling: true,
    });
  }

  // 그룹 내 라벨용 (fabric.Image or fabric.Text fallback)
  async function buildMathLabel(latex, left, top, size) {
    const sz = size || fontSize;
    const fallback = () => new fabric.Text(latex, {
      left, top, fontSize: sz, fill: color,
      fontFamily: 'serif', fontStyle: 'italic',
      originX: 'center', originY: 'center', selectable: false,
    });
    if (!window.MathJax || !MathJax.startup) return fallback();
    try {
      await MathJax.startup.promise;
      const node = MathJax.tex2svg(latex, { display: false });
      const svg = node && node.querySelector('svg');
      if (!svg) return fallback();
      const wEx = parseFloat(svg.getAttribute('width')) || 2;
      const hEx = parseFloat(svg.getAttribute('height')) || 1;
      const h = Math.max(sz * 1.3, 16);
      svg.setAttribute('width', Math.round((wEx / hEx) * h));
      svg.setAttribute('height', Math.round(h));
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/xmlns:xlink="[^"]*"\s*/g, '');
      s = s.replace(/xlink:href/g, 'href');
      s = s.replace(/fill="currentColor"/g, `fill="${color}"`);
      s = s.replace(/stroke="currentColor"/g, `stroke="${color}"`);
      const blob = new Blob([s], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);
      return new Promise((resolve) => {
        fabric.Image.fromURL(blobUrl, (img) => {
          URL.revokeObjectURL(blobUrl);
          if (!img) { resolve(fallback()); return; }
          img.set({ left, top, originX: 'center', originY: 'center', selectable: false });
          img._type = 'math-label';
          img._latex = latex;
          resolve(img);
        });
      });
    } catch (_) { return fallback(); }
  }

  // MathJax로 LaTeX 렌더링 → fabric.Image (실패 시 IText fallback)
  async function buildMathText(p, latex) {
    if (!window.MathJax || !MathJax.startup) return buildText(p, latex);
    try {
      await MathJax.startup.promise;
      const node = MathJax.tex2svg(latex, { display: false });
      const svg = node && node.querySelector('svg');
      if (!svg) return buildText(p, latex);

      // ex 단위 파싱으로 비율 유지 크기 계산
      const wEx = parseFloat(svg.getAttribute('width')) || 2;
      const hEx = parseFloat(svg.getAttribute('height')) || 1;
      const targetH = Math.max(fontSize * 1.5, 20);
      const targetW = (wEx / hEx) * targetH;
      svg.setAttribute('width', Math.round(targetW));
      svg.setAttribute('height', Math.round(targetH));

      let s = new XMLSerializer().serializeToString(svg);
      // xlink:href → href (일부 브라우저에서 data URL 로딩 실패 원인)
      s = s.replace(/xmlns:xlink="[^"]*"\s*/g, '');
      s = s.replace(/xlink:href/g, 'href');
      s = s.replace(/fill="currentColor"/g, `fill="${color}"`);
      s = s.replace(/stroke="currentColor"/g, `stroke="${color}"`);

      const blob = new Blob([s], { type: 'image/svg+xml' });
      const blobUrl = URL.createObjectURL(blob);

      return new Promise((resolve) => {
        fabric.Image.fromURL(blobUrl, (img) => {
          URL.revokeObjectURL(blobUrl);
          if (img) {
            img.set({ left: p.x, top: p.y, originX: 'center', originY: 'center', lockUniScaling: true });
            img._type = 'math-text';
            img._latex = latex;
            resolve(img);
          } else {
            resolve(buildText(p, latex));
          }
        });
      });
    } catch (_) {
      return buildText(p, latex);
    }
  }

  async function confirmText() {
    const text = document.getElementById('text-input').value;
    document.getElementById('text-modal').classList.add('hidden');
    if (textCallback) { await textCallback(text); textCallback = null; }
  }

  function cancelText() {
    document.getElementById('text-modal').classList.add('hidden');
    textCallback = null;
    pendingArcStart = null;
    pendingArcEnd = null;
  }

  // ── Angle modal ──
  function showAngleModal() {
    const modal = document.getElementById('angle-modal');
    const input = document.getElementById('angle-input');
    input.value = '90°';
    modal.classList.remove('hidden');
    setTimeout(() => { input.select(); input.focus(); }, 50);

    angleCallback = async (angleValue, displayLabel) => {
      if (!pendingAngleCenter) return;
      const obj = await buildAngleMarker(
        pendingAngleCenter, pendingAngleRadius, pendingAngleStartAngle, angleValue, displayLabel
      );
      canvas.add(obj);
      canvas.renderAll();
      pendingAngleCenter = null;
    };
  }

  async function confirmAngle() {
    const noLabel = document.getElementById('angle-no-label').checked;
    const inputVal = document.getElementById('angle-input').value;
    document.getElementById('angle-modal').classList.add('hidden');
    document.getElementById('angle-no-label').checked = false;
    if (angleCallback) {
      const wasNewAngle = !!pendingAngleCenter;
      // angleValue: shape 계산용(항상 입력값), displayLabel: 표시용(숨김이면 빈 문자열)
      await angleCallback(inputVal, noLabel ? '' : inputVal);
      angleCallback = null;
      if (wasNewAngle) switchToSelect();
    }
  }

  function cancelAngle() {
    document.getElementById('angle-modal').classList.add('hidden');
    angleCallback = null;
    pendingAngleCenter = null;
  }

  return {
    init, setTool,
    setColor, setStrokeWidth, setFillOpacity, setFontSize, setDashPattern,
    getCurrentTool,
    confirmText, cancelText,
    confirmAngle, cancelAngle,
    confirmAxisRatio, cancelAxisRatio,
    confirmGraph, cancelGraph,
    toggleGridSnap, setGridSize,
    toggleLock,
  };
})();
