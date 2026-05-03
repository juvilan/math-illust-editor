const AnnotationTools = (() => {
  let pendingArcStart     = null;
  let pendingArcEnd       = null;
  let pendingAngleCenter  = null;
  let pendingAngleRadius  = null;
  let pendingAngleStartAngle = null;
  let angleCallback       = null;

  function degToRad(d) { return d * Math.PI / 180; }

  function describeArc(cx, cy, r, startDeg, endDeg) {
    const s = degToRad(startDeg);
    const e = degToRad(endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return [
      `M ${cx + r * Math.cos(s)} ${cy + r * Math.sin(s)}`,
      `A ${r} ${r} 0 ${large} 1 ${cx + r * Math.cos(e)} ${cy + r * Math.sin(e)}`,
    ].join(' ');
  }

  function buildArcDimPreview(start, end) {
    const { color, strokeWidth, dashPattern } = ToolState;
    const mx  = (start.x + end.x) / 2;
    const my  = (start.y + end.y) / 2;
    const dx  = end.x - start.x;
    const dy  = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const sag = Math.min(len * 0.3, 60);
    return new fabric.Path(
      `M ${start.x} ${start.y} Q ${mx - (dy / len) * sag} ${my + (dx / len) * sag} ${end.x} ${end.y}`,
      { stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern }
    );
  }

  async function buildArcDim(start, end, label) {
    const { color, strokeWidth, dashPattern, fontSize } = ToolState;
    const mx  = (start.x + end.x) / 2;
    const my  = (start.y + end.y) / 2;
    const dx  = end.x - start.x;
    const dy  = end.y - start.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const sag = Math.min(len * 0.3, 60);
    const cpx = mx - (dy / len) * sag;
    const cpy = my + (dx / len) * sag;

    function lerp(a, b, t) { return a + (b - a) * t; }

    const labelWidth = fontSize * label.length * 0.55 + 10;
    const gapHalf   = Math.min(0.18, labelWidth / (len + 1));
    const t1 = 0.5 - gapHalf;
    const t2 = 0.5 + gapHalf;

    const cp01_t1 = { x: lerp(start.x, cpx, t1), y: lerp(start.y, cpy, t1) };
    const cp12_t1 = { x: lerp(cpx, end.x, t1), y: lerp(cpy, end.y, t1) };
    const bt1     = { x: lerp(cp01_t1.x, cp12_t1.x, t1), y: lerp(cp01_t1.y, cp12_t1.y, t1) };
    const cp01_t2 = { x: lerp(start.x, cpx, t2), y: lerp(start.y, cpy, t2) };
    const cp12_t2 = { x: lerp(cpx, end.x, t2), y: lerp(cpy, end.y, t2) };
    const bt2     = { x: lerp(cp01_t2.x, cp12_t2.x, t2), y: lerp(cp01_t2.y, cp12_t2.y, t2) };

    const arcOpts = { stroke: color, strokeWidth, fill: '', strokeDashArray: dashPattern, selectable: false };
    const arc1 = new fabric.Path(
      `M ${start.x} ${start.y} Q ${cp01_t1.x} ${cp01_t1.y} ${bt1.x} ${bt1.y}`, arcOpts
    );
    const arc2 = new fabric.Path(
      `M ${bt2.x} ${bt2.y} Q ${cp12_t2.x} ${cp12_t2.y} ${end.x} ${end.y}`, arcOpts
    );

    const tx  = (bt1.x + bt2.x) / 2;
    const ty  = (bt1.y + bt2.y) / 2;
    const lbl = await MathTextTools.buildMathLabel(label, tx, ty);

    const group = new fabric.Group([arc1, arc2, lbl], { lockUniScaling: true });
    group._type = 'arc-dim';
    group.on('rotating', function () {
      const t = this._objects.find(o => o._type === 'math-label' || o.type === 'text');
      if (t) { t.set({ angle: -this.angle }); this.set({ dirty: true }); }
    });
    return group;
  }

  async function buildAngleMarker(center, radius, startAngleDeg, angleValue, displayLabel) {
    if (displayLabel === undefined) displayLabel = angleValue;
    const { color, strokeWidth, fontSize } = ToolState;
    const numMatch = (angleValue || '').match(/[\d.]+/);
    const sweepDeg = numMatch ? parseFloat(numMatch[0]) : 45;
    const isRight  = Math.abs(sweepDeg - 90) < 1;

    let shapeObj;
    if (isRight) {
      const s   = Math.max(8, radius * 0.55);
      const a   = degToRad(startAngleDeg);
      const b   = a - Math.PI / 2;
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

    const base      = isRight ? Math.max(8, radius * 0.55) : radius;
    const labelDist = base * 1.9 + fontSize * 0.4;
    const lx = center.x + labelDist * Math.cos(degToRad(startAngleDeg + sweepDeg / 2));
    const ly = center.y + labelDist * Math.sin(degToRad(startAngleDeg + sweepDeg / 2));

    const children = [shapeObj];
    if (displayLabel && displayLabel.trim()) {
      const label = await MathTextTools.buildMathLabel(displayLabel, lx, ly);
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
      ToolState.canvas.add(obj);
      ToolState.canvas.renderAll();
      pendingAngleCenter = null;
    };
  }

  async function confirmAngle() {
    const noLabel   = document.getElementById('angle-no-label').checked;
    const inputVal  = document.getElementById('angle-input').value;
    document.getElementById('angle-modal').classList.add('hidden');
    document.getElementById('angle-no-label').checked = false;
    if (angleCallback) {
      const wasNewAngle = !!pendingAngleCenter;
      await angleCallback(inputVal, noLabel ? '' : inputVal);
      angleCallback = null;
      if (wasNewAngle) Tools.switchToSelect();
    }
  }

  function cancelAngle() {
    document.getElementById('angle-modal').classList.add('hidden');
    angleCallback = null;
    pendingAngleCenter = null;
  }

  // Called from tools.js onMouseUp when currentTool === 'arc-dim'
  function startArcDim(start, end) {
    pendingArcStart = { ...start };
    pendingArcEnd   = { ...end };
    MathTextTools.showTextModal(end, 'arc-dim');
  }

  // Called from tools.js onMouseUp when currentTool === 'angle'
  function startAngle(startPt, p) {
    pendingAngleCenter      = { ...startPt };
    pendingAngleRadius      = dist(startPt, p) * 0.35;
    pendingAngleStartAngle  = Math.atan2(p.y - startPt.y, p.x - startPt.x) * 180 / Math.PI;
    showAngleModal();
  }

  // Double-click edit: angle group label
  function openAngleEdit(grp) {
    const labelObj = grp._objects.find(o => o._type === 'math-label' || o.type === 'text');
    const modal    = document.getElementById('angle-modal');
    document.getElementById('angle-input').value = labelObj
      ? (labelObj._latex || labelObj.text || '90°') : '90°';
    modal.classList.remove('hidden');
    setTimeout(() => {
      document.getElementById('angle-input').select();
      document.getElementById('angle-input').focus();
    }, 50);
    angleCallback = async (angleValue, displayLabel) => {
      const show      = displayLabel && displayLabel.trim();
      const prevAngle = labelObj ? (labelObj.angle || 0) : 0;
      const prevLeft  = labelObj ? labelObj.left  : 0;
      const prevTop   = labelObj ? labelObj.top   : 0;
      const idx       = grp._objects.indexOf(labelObj);
      if (!show) {
        if (idx !== -1) grp._objects.splice(idx, 1);
      } else {
        const newLbl = await MathTextTools.buildMathLabel(displayLabel, prevLeft, prevTop);
        newLbl.angle = prevAngle;
        if (idx !== -1) grp._objects[idx] = newLbl;
        else grp._objects.push(newLbl);
      }
      grp.set({ dirty: true });
      ToolState.canvas.requestRenderAll();
    };
  }

  function getPendingArcStart() { return pendingArcStart; }
  function getPendingArcEnd()   { return pendingArcEnd; }
  function clearPendingArc()    { pendingArcStart = null; pendingArcEnd = null; }

  return {
    buildArcDimPreview, buildArcDim, buildAngleMarker,
    startArcDim, startAngle,
    openAngleEdit,
    getPendingArcStart, getPendingArcEnd, clearPendingArc,
    confirmAngle, cancelAngle,
  };
})();
