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

  // Grid snap
  let gridSnapEnabled = false;
  let gridSize = 10;

  // Options
  let color = '#000000';
  let strokeWidth = 2;
  let fillOpacity = 0.3;
  let fontSize = 18;
  let dashPattern = [8, 6];
  let lineStyle  = 'solid';   // 'solid' | 'dashed'
  let arrowStyle = 'none';    // 'none' | 'end' | 'both'
  let pointStyle = 'closed';  // 'closed' | 'open'

  // Shape fill
  let shapeFillEnabled = false;
  let shapeFillColor   = '#aaaaaa';

  // Stroke visibility (닫힌 도형)
  let strokeEnabled = true;
  function _strokeVal() { return strokeEnabled ? color : 'transparent'; }
  function setStrokeEnabled(v) { strokeEnabled = v; ToolState.strokeEnabled = v; }



  // Label tool state
  let labelMode = 'roman';  // 'roman' | 'italic' | 'greek'
  const _labelValues = { roman: 'A', italic: 'l', greek: 'alpha' };
  const _GREEK_LETTERS = ['alpha','beta','gamma','delta','epsilon','zeta','eta','theta',
                          'iota','kappa','lambda','mu','nu','xi','omicron','pi','rho',
                          'sigma','tau','upsilon','phi','chi','psi','omega'];
  const _GREEK_SYMBOL_MAP = {
    'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta',
    'θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu','ξ':'xi',
    'ο':'omicron','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','υ':'upsilon',
    'φ':'phi','χ':'chi','ψ':'psi','ω':'omega',
  };
  const _GREEK_DEFAULTS = { roman: 'A', italic: 'l', greek: 'alpha' };



  // Text/angle modal callbacks
  let textCallback = null;
  let angleCallback = null;

  function init(c) {
    canvas = c;
    ToolState.canvas = c;
    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);
    canvas.on('mouse:dblclick', onDblClick);

    // 축 레이블 원형 드래그 제한
    canvas.on('object:moving', (e) => {
      const obj = e.target;
      if (obj._type !== 'axis-label' || !obj._constraintCenter) return;
      const { x: cx, y: cy } = obj._constraintCenter;
      const r  = obj._constraintRadius || 50;
      const dx = obj.left - cx;
      const dy = obj.top  - cy;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d > r) {
        obj.set({ left: cx + (dx / d) * r, top: cy + (dy / d) * r });
      }
    });
  }

  function setTool(tool) {
    if (currentTool === 'polygon') PolygonTools.cancel();
    if (currentTool === 'arc') ArcTools.cancel();
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

  function setColor(c) { color = c; ToolState.color = c; }
  function setStrokeWidth(w) { strokeWidth = parseInt(w); ToolState.strokeWidth = strokeWidth; }
  function setFillOpacity(o) { fillOpacity = parseFloat(o) / 100; ToolState.fillOpacity = fillOpacity; }
  function setFontSize(s) { fontSize = parseInt(s); ToolState.fontSize = fontSize; }
  function setDashPattern(v) { dashPattern = v.split(',').map(Number); ToolState.dashPattern = dashPattern; }
  function setLineStyle(v)  { lineStyle  = v; ToolState.lineStyle  = v; }
  function setArrowStyle(v) { arrowStyle = v; ToolState.arrowStyle = v; }
  function setPointStyle(v) { pointStyle = v; ToolState.pointStyle = v; }
  function setShapeFillEnabled(v) { shapeFillEnabled = v; ToolState.shapeFillEnabled = v; }
  function setShapeFillColor(v)   { shapeFillColor   = v; ToolState.shapeFillColor   = v; }
  function setLabelMode(mode) {
    if (!_labelValues.hasOwnProperty(mode)) return;
    labelMode = mode;
    ToolState.labelMode = mode;
    _syncLabelUI();
  }
  function setLabelValue(v) {
    let val = (v || '').trim();
    if (!val) return;
    // 그리스 유니코드 기호 → LaTeX 이름으로 변환
    if (_GREEK_SYMBOL_MAP[val]) val = _GREEK_SYMBOL_MAP[val];
    // 입력값으로 모드 자동 감지
    if (_GREEK_LETTERS.includes(val)) {
      labelMode = 'greek';
    } else if (/^[A-Z]$/.test(val)) {
      labelMode = 'roman';
    } else if (/^[a-z]$/.test(val)) {
      labelMode = 'italic';
    }
    _labelValues[labelMode] = val;
    _syncLabelUI();
  }
  function getLabelMode()  { return labelMode; }
  function getLabelValue() { return _labelValues[labelMode]; }
  function getCurrentTool() { return currentTool; }

  function _latexForLabel(mode, value) {
    if (mode === 'roman')  return `\\mathrm{${value}}`;
    if (mode === 'italic') return value;
    if (mode === 'greek')  return `\\${value}`;
    return value;
  }

  function _syncLabelUI() {
    const elVal = document.getElementById('label-current');
    if (elVal) elVal.value = _labelValues[labelMode];
    const elMode = document.getElementById('label-mode-select');
    if (elMode) elMode.value = labelMode;
  }

  function _advanceLabel() {
    const cur = _labelValues[labelMode];
    if (labelMode === 'roman' && /^[A-Z]$/.test(cur)) {
      _labelValues.roman = cur === 'Z' ? 'A' : String.fromCharCode(cur.charCodeAt(0) + 1);
    } else if (labelMode === 'italic' && /^[a-z]$/.test(cur)) {
      _labelValues.italic = cur === 'z' ? 'a' : String.fromCharCode(cur.charCodeAt(0) + 1);
    } else if (labelMode === 'greek') {
      const idx = _GREEK_LETTERS.indexOf(cur);
      if (idx !== -1) {
        _labelValues.greek = _GREEK_LETTERS[(idx + 1) % _GREEK_LETTERS.length];
      }
    }
    _syncLabelUI();
  }

  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  function _shapeFill() {
    return shapeFillEnabled ? _hexToRgba(shapeFillColor, fillOpacity) : '';
  }

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

    if (currentTool === 'formula') {
      showTextModal(p);
      return;
    }

    if (currentTool === 'text') {
      const obj = new fabric.IText('텍스트', {
        left: p.x, top: p.y,
        fontSize, fill: color,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        originX: 'center', originY: 'center',
        _type: 'plain-text',
      });
      canvas.add(obj);
      canvas.setActiveObject(obj);
      obj.enterEditing();
      obj.selectAll();
      canvas.renderAll();
      return;
    }

    if (currentTool === 'label') {
      const mode  = labelMode;
      const value = _labelValues[mode];
      const latex = _latexForLabel(mode, value);
      buildMathText(p, latex).then(img => {
        img._labelMode  = mode;
        img._labelValue = value;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.renderAll();
      });
      _advanceLabel();
      return;
    }

    if (currentTool === 'bucket') {
      applyBucketFill(p);
      return;
    }

    if (currentTool === 'point') {
      canvas.add(buildPoint(p, pointStyle === 'open'));
      canvas.renderAll();
      return;
    }

    if (currentTool === 'axis') {
      AxisTools.createDefaultAxis(p);
      return;
    }

    if (currentTool === 'graph') {
      GraphTools.showGraphModal(p);
      return;
    }

    if (currentTool === 'arc') {
      ArcTools.handleMouseDown(p);
      return;
    }

    if (currentTool === 'polygon') {
      PolygonTools.handleMouseDown(p);
      return;
    }

    isDrawing = true;
    startPt = p;
  }

  function onMouseMove(e) {
    if (currentTool === 'arc' && ArcTools.isActive()) {
      ArcTools.handleMouseMove(ptSnap(e));
      return;
    }
    if (currentTool === 'polygon' && PolygonTools.isActive()) {
      PolygonTools.handleMouseMove(ptSnap(e));
      return;
    }
    if (!isDrawing || !startPt) return;
    const p = snapAngle(startPt, ptSnap(e), e);
    removePreview();

    const obj = buildObject(startPt, p, e);
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

    const obj = buildObject(startPt, p, e);
    if (obj) {
      canvas.add(obj);
      if (obj._type === 'cover-rect') {
        const bgImg = canvas.getObjects().find(o => o._type === 'bg-image');
        if (bgImg) {
          const bgIdx = canvas.getObjects().indexOf(bgImg);
          canvas.moveTo(obj, bgIdx + 1);
        } else {
          canvas.sendToBack(obj);
        }
      }
      canvas.renderAll();
    }
    startPt = null;
  }

  function onDblClick(e) {
    if (currentTool !== 'select') return;

    // 함수 그래프 더블클릭 → 수식·범위·비율 수정
    if (e.target && e.target._type === 'graph') {
      GraphTools.showGraphEditModal(e.target);
      return;
    }

    // 좌표축 더블클릭 → 인스펙터에서 편집
    if (e.target && e.target._type === 'axis') {
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
      setTimeout(() => { input.select(); input.focus(); input.dispatchEvent(new Event('input')); }, 50);
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
      setTimeout(() => { input.select(); input.focus(); input.dispatchEvent(new Event('input')); }, 50);
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
  function buildObject(start, end, e) {
    switch (currentTool) {
      case 'line':
        if (arrowStyle === 'none') return buildLine(start, end, lineStyle === 'dashed');
        return buildArrow(start, end, arrowStyle === 'both', lineStyle === 'dashed');
      case 'arc-dim':    return buildArcDimPreview(start, end);
      case 'projection': return buildProjectionPreview(start, end);
      case 'circle':     return buildCircleOrEllipse(start, end, true,  e);
      case 'ellipse':    return buildCircleOrEllipse(start, end, false, e);
      case 'rect':       return buildRect(start, end, e);
      case 'cover':      return buildCoverRect(start, end, e);
      default:           return null;
    }
  }

  function buildCircleOrEllipse(start, end, forceCircle, e) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let rx = Math.abs(dx) / 2;
    let ry = Math.abs(dy) / 2;
    const shift = e && e.e && e.e.shiftKey;
    if (forceCircle || shift) { const r = Math.max(rx, ry); rx = ry = r; }
    if (rx < 2 && ry < 2) return null;
    const cx = start.x + (forceCircle || shift ? Math.sign(dx) * rx : dx / 2);
    const cy = start.y + (forceCircle || shift ? Math.sign(dy) * ry : dy / 2);
    return new fabric.Ellipse({
      left: cx, top: cy,
      rx, ry,
      fill: _shapeFill(), stroke: _strokeVal(), strokeWidth,
      originX: 'center', originY: 'center',
      lockUniScaling: forceCircle,
    });
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
        if (err === 'no-image') {
          document.dispatchEvent(new CustomEvent('ui:toast', {
            detail: '⚠️ 채우기는 배경 이미지가 있을 때만 사용할 수 있습니다. 먼저 이미지를 불러오세요.',
          }));
        } else {
          // 선 위 클릭 — 캔버스를 짧게 테두리로 피드백
          const el = canvas.getElement().parentElement;
          el.style.outline = '2px solid #f38ba8';
          setTimeout(() => { el.style.outline = ''; }, 300);
        }
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
    ToolState.gridSnapEnabled = gridSnapEnabled;
    return gridSnapEnabled;
  }
  function setGridSize(v) { gridSize = Math.max(1, parseInt(v) || 10); ToolState.gridSize = gridSize; }

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

  // ── Rect ──
  function buildRect(start, end, e) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const shift = e && e.e && e.e.shiftKey;
    let w = Math.abs(dx);
    let h = Math.abs(dy);
    if (shift) { w = h = Math.max(w, h); }
    if (w < 2 && h < 2) return null;
    return new fabric.Rect({
      left: dx >= 0 ? start.x : start.x - w,
      top:  dy >= 0 ? start.y : start.y - h,
      width: w, height: h,
      fill: _shapeFill(), stroke: _strokeVal(), strokeWidth,
    });
  }

  // ── Cover Rect (가리기) ──
  let coverFillColor = '#ffffff';
  function setCoverFillColor(c) { coverFillColor = c; }
  function getCoverFillColor()  { return coverFillColor; }

  function buildCoverRect(start, end, e) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const shift = e && e.e && e.e.shiftKey;
    let w = Math.abs(dx);
    let h = Math.abs(dy);
    if (shift) { w = h = Math.max(w, h); }
    if (w < 2 && h < 2) return null;
    return new fabric.Rect({
      left: dx >= 0 ? start.x : start.x - w,
      top:  dy >= 0 ? start.y : start.y - h,
      width: w, height: h,
      fill: coverFillColor, stroke: null, strokeWidth: 0,
      _type: 'cover-rect',
    });
  }

  // ── Arrow (수능 교과서 스타일 — 날렵한 화살촉) ──
  function buildArrow(start, end, bothSides, dashed) {
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
      strokeDashArray: dashed ? dashPattern : null,
      strokeLineCap: 'butt',
      strokeLineJoin: 'miter',
      lockUniScaling: true,
    });
  }

  // ── Graph tool — moved to tools-graph.js ──


  // ── Projection tool ──
  function _projDash() { return lineStyle === 'dashed' ? dashPattern : null; }

  function buildProjectionPreview(start, end) {
    const s = Math.max(8, strokeWidth * 3);
    const sx = (end.x - start.x) >= 0 ? 1 : -1;
    const sy = (end.y - start.y) >= 0 ? 1 : -1;
    // 직각 표시: 직사각형의 두 발점에 각각 (start/end가 아닌 나머지 꼭짓점)
    const d = `M ${start.x} ${start.y} L ${start.x} ${end.y} ` +
              `M ${start.x} ${start.y} L ${end.x} ${start.y} ` +
              `M ${start.x+sx*s} ${end.y} L ${start.x+sx*s} ${end.y-sy*s} L ${start.x} ${end.y-sy*s} ` +
              `M ${end.x-sx*s} ${start.y} L ${end.x-sx*s} ${start.y+sy*s} L ${end.x} ${start.y+sy*s}`;
    return new fabric.Path(d, { stroke: color, strokeWidth, fill: '', strokeDashArray: _projDash() });
  }

  function buildProjection(start, end) {
    const dash = _projDash();
    const s = Math.max(8, strokeWidth * 3);
    const sx = (end.x - start.x) >= 0 ? 1 : -1;
    const sy = (end.y - start.y) >= 0 ? 1 : -1;

    const vLine = new fabric.Line([start.x, start.y, start.x, end.y], {
      stroke: color, strokeWidth, fill: '', strokeDashArray: dash, selectable: false,
    });
    const hLine = new fabric.Line([start.x, start.y, end.x, start.y], {
      stroke: color, strokeWidth, fill: '', strokeDashArray: dash, selectable: false,
    });
    // 직각 표시: 직사각형의 두 발점에 각각
    // foot1 = (start.x, end.y): vLine의 끝
    const mark1V = new fabric.Line(
      [start.x+sx*s, end.y,      start.x+sx*s, end.y-sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
    const mark1H = new fabric.Line(
      [start.x+sx*s, end.y-sy*s, start.x,      end.y-sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
    // foot2 = (end.x, start.y): hLine의 끝
    const mark2V = new fabric.Line(
      [end.x-sx*s, start.y,      end.x-sx*s, start.y+sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
    const mark2H = new fabric.Line(
      [end.x-sx*s, start.y+sy*s, end.x,      start.y+sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
    const group = new fabric.Group([vLine, hLine, mark1V, mark1H, mark2V, mark2H], { lockUniScaling: true });
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
    setTimeout(() => { input.focus(); input.dispatchEvent(new Event('input')); }, 50);

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

      // ex 단위 비율로 크기 계산 (pxPerEx 기준 — 문자마다 동일한 스케일 유지)
      const wEx = parseFloat(svg.getAttribute('width')) || 2;
      const hEx = parseFloat(svg.getAttribute('height')) || 1;
      const pxPerEx = Math.max(fontSize * 1.5, 20);
      svg.setAttribute('width',  Math.round(wEx * pxPerEx));
      svg.setAttribute('height', Math.round(hEx * pxPerEx));

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
            img._fontSize = fontSize;
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

  // 기존 math-text/text 객체의 글자 크기 변경 (inspector용)
  // 반환값: 새 객체(math-text 재빌드) 또는 기존 객체(text/i-text), 실패 시 null
  async function rebuildMathTextSize(obj, newSize) {
    const sz = parseInt(newSize);
    if (!sz || sz < 1) return null;
    if (obj.type === 'i-text' || obj.type === 'text') {
      obj.set({ fontSize: sz });
      return obj;
    }
    if (obj._type !== 'math-text' || !obj._latex) return null;
    // activeSelection 내 객체는 좌표가 그룹 상대좌표 → 절대좌표 계산
    let absX = obj.left, absY = obj.top;
    if (obj.group) {
      const pt = fabric.util.transformPoint(
        { x: obj.left, y: obj.top },
        obj.group.calcTransformMatrix()
      );
      absX = pt.x; absY = pt.y;
    }
    const prevFontSize = fontSize;
    fontSize = sz;
    const rebuilt = await buildMathText({ x: absX, y: absY }, obj._latex);
    fontSize = prevFontSize;
    rebuilt.set({ angle: obj.angle, scaleX: 1, scaleY: 1 });
    canvas.remove(obj);
    canvas.add(rebuilt);
    return rebuilt;
  }

  async function rebuildLabel(obj, mode, value) {
    if (!_labelValues.hasOwnProperty(mode) || !value) return;
    const latex   = _latexForLabel(mode, value);
    const prevSz  = fontSize;
    if (obj._fontSize) fontSize = obj._fontSize;
    const newImg  = await buildMathText({ x: obj.left, y: obj.top }, latex);
    fontSize = prevSz;
    newImg._labelMode  = mode;
    newImg._labelValue = value;
    newImg.set({ angle: obj.angle, scaleX: 1, scaleY: 1 });
    canvas.remove(obj);
    canvas.add(newImg);
    canvas.setActiveObject(newImg);
    canvas.renderAll();
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

  // ── Polygon tool ──
  // ── Polygon tool — moved to tools-polygon.js ──


  // ── Arc/Sector tool — moved to tools-arc.js ──


  return {
    init, setTool,
    setColor, setStrokeWidth, setFillOpacity, setFontSize, setDashPattern,
    setLineStyle, setArrowStyle, setPointStyle,
    setShapeFillEnabled, setShapeFillColor,
    setStrokeEnabled,
    setCoverFillColor, getCoverFillColor,
    setLabelMode, setLabelValue, getLabelMode, getLabelValue,
    rebuildLabel,
    getCurrentTool,
    confirmText, cancelText,
    confirmAngle, cancelAngle,
    buildMathLabel, switchToSelect,
    rebuildAxis: (...args) => AxisTools.rebuildAxis(...args),
    rebuildMathTextSize,
    confirmAxisRatio: () => AxisTools.confirmAxisRatio(),
    cancelAxisRatio:  () => AxisTools.cancelAxisRatio(),
    confirmGraph:             () => GraphTools.confirmGraph(),
    cancelGraph:              () => GraphTools.cancelGraph(),
    rebuildGraphFromInspector: (...args) => GraphTools.rebuildGraphFromInspector(...args),
    GRAPH_FN_DEFS,
    confirmPolygon: () => PolygonTools.confirmPolygon(),
    cancelPolygon:  () => PolygonTools.cancelPolygon(),
    cancelArc:      () => ArcTools.cancelArc(),
    toggleGridSnap, setGridSize,
    toggleLock,
  };
})();
