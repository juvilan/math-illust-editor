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

  const GRAPH_FN_DEFS = [
    { key:'linear',    label:'일차함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:0,s:.5}],
      display: p=>`y = ${p.a}x + ${p.b}`,
      build: p=>`(${p.a})*x+(${p.b})` },
    { key:'quadratic', label:'이차함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:0,s:.5},{k:'c',v:0,s:.5}],
      display: p=>`y = ${p.a}x² + ${p.b}x + ${p.c}`,
      build: p=>`(${p.a})*x**2+(${p.b})*x+(${p.c})` },
    { key:'cubic',     label:'삼차함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:0,s:.5},{k:'c',v:0,s:.5},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}x³ + ${p.b}x² + ${p.c}x + ${p.d}`,
      build: p=>`(${p.a})*x**3+(${p.b})*x**2+(${p.c})*x+(${p.d})` },
    { key:'power',     label:'거듭제곱',    params:[{k:'a',v:1,s:.5},{k:'n',v:3,s:1}],
      display: p=>`y = ${p.a}x^${p.n}`,
      build: p=>`(${p.a})*pow(x,${p.n})` },
    { key:'sin',       label:'사인',        params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.1},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}·sin(${p.b}x + ${p.c}) + ${p.d}`,
      build: p=>`(${p.a})*sin((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'cos',       label:'코사인',      params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.1},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}·cos(${p.b}x + ${p.c}) + ${p.d}`,
      build: p=>`(${p.a})*cos((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'tan',       label:'탄젠트',      params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.1},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}·tan(${p.b}x + ${p.c}) + ${p.d}`,
      build: p=>`(${p.a})*tan((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'exp',       label:'지수함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:2,s:1},{k:'c',v:0,s:.5}],
      display: p=>`y = ${p.a}·${p.b}^x + ${p.c}`,
      build: p=>`(${p.a})*pow(${p.b},x)+(${p.c})` },
    { key:'log',       label:'로그함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:10,s:1},{k:'c',v:0,s:.5}],
      display: p=>`y = ${p.a}·log_${p.b}(x) + ${p.c}`,
      build: p=>`(${p.a})*log(x)/log(${p.b})+(${p.c})` },
    { key:'sqrt',      label:'제곱근',      params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.5},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}·√(${p.b}x + ${p.c}) + ${p.d}`,
      build: p=>`(${p.a})*sqrt((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'rational',  label:'분수함수',    params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.5},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}/( ${p.b}x + ${p.c}) + ${p.d}`,
      build: p=>`(${p.a})/((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'abs',       label:'절댓값',      params:[{k:'a',v:1,s:.5},{k:'b',v:1,s:.5},{k:'c',v:0,s:.5},{k:'d',v:0,s:.5}],
      display: p=>`y = ${p.a}|${p.b}x + ${p.c}| + ${p.d}`,
      build: p=>`(${p.a})*abs((${p.b})*x+(${p.c}))+(${p.d})` },
    { key:'custom',    label:'직접 입력',   params:[], display:null, build:null },
  ];

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
  function setStrokeEnabled(v) { strokeEnabled = v; }

  // Polygon tool state
  let polygonVertices   = [];
  let polygonPreviewObj = null;
  let polygonSnapMarker = null;
  const POLY_SNAP_RADIUS = 18;

  // Label tool state
  let currentLabel = 'A';

  // Line 2-click state
  let linePhase     = 0;
  let lineStartPt   = null;
  let linePreviewObj = null;

  // Arc tool state (3-click: center → start-point → end-point)
  let arcPhase      = 0;   // 0: idle, 1: waiting start-point, 2: waiting end-point
  let arcCenter     = null;
  let arcRadius     = 0;
  let arcStartAngle = 0;
  let arcPreviewObj = null;

  // Text/angle modal callbacks
  let textCallback = null;
  let angleCallback = null;

  function init(c) {
    canvas = c;
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
    if (currentTool === 'line') _cancelLine();
    if (currentTool === 'polygon') _cancelPolygon();
    if (currentTool === 'arc') _cancelArc();
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
  function setLineStyle(v)  { lineStyle  = v; }
  function setArrowStyle(v) { arrowStyle = v; }
  function setPointStyle(v) { pointStyle = v; }
  function setShapeFillEnabled(v) { shapeFillEnabled = v; }
  function setShapeFillColor(v)   { shapeFillColor   = v; }
  function setCurrentLabel(v)     { currentLabel = v || 'A'; _syncLabelUI(); }
  function getCurrentLabel()      { return currentLabel; }
  function getCurrentTool() { return currentTool; }

  function _syncLabelUI() {
    const el = document.getElementById('label-current');
    if (el) el.value = currentLabel;
  }

  function _advanceLabel() {
    if (/^[A-Z]$/.test(currentLabel)) {
      currentLabel = currentLabel === 'Z' ? 'A' : String.fromCharCode(currentLabel.charCodeAt(0) + 1);
    } else if (/^[a-z]$/.test(currentLabel)) {
      currentLabel = currentLabel === 'z' ? 'a' : String.fromCharCode(currentLabel.charCodeAt(0) + 1);
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

    if (currentTool === 'text') {
      showTextModal(p);
      return;
    }

    if (currentTool === 'line') {
      if (linePhase === 0) {
        lineStartPt = { x: p.x, y: p.y };
        linePhase = 1;
        _updateLinePreview(p);
      } else {
        _finishLine(p);
      }
      return;
    }

    if (currentTool === 'label') {
      const lbl = currentLabel;
      buildMathText(p, `\\mathrm{${lbl}}`).then(img => {
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
      createDefaultAxis(p);
      return;
    }

    if (currentTool === 'graph') {
      showGraphModal(p);
      return;
    }

    if (currentTool === 'arc') {
      if (arcPhase === 0) {
        arcCenter = { x: p.x, y: p.y };
        arcPhase = 1;
        _updateArcPreview(p);
      } else if (arcPhase === 1) {
        arcRadius = dist(arcCenter, p);
        if (arcRadius < 4) return;
        arcStartAngle = Math.atan2(p.y - arcCenter.y, p.x - arcCenter.x);
        arcPhase = 2;
        _updateArcPreview(p);
      } else if (arcPhase === 2) {
        _finishArc(p);
      }
      return;
    }

    if (currentTool === 'polygon') {
      if (polygonVertices.length >= 3 && dist(p, polygonVertices[0]) < POLY_SNAP_RADIUS) {
        _finishPolygon();
        return;
      }
      polygonVertices.push({ x: p.x, y: p.y });
      _updatePolygonPreview(p);
      return;
    }

    isDrawing = true;
    startPt = p;
  }

  function onMouseMove(e) {
    if (currentTool === 'line' && linePhase === 1) {
      _updateLinePreview(snapAngle(lineStartPt, ptSnap(e), e));
      return;
    }
    if (currentTool === 'arc' && arcPhase > 0) {
      _updateArcPreview(ptSnap(e));
      return;
    }
    if (currentTool === 'polygon' && polygonVertices.length > 0) {
      _updatePolygonPreview(ptSnap(e));
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
      showGraphEditModal(e.target);
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

    const group = new fabric.Group([axesPath, ...tickObjs], { lockUniScaling: true });
    group._type   = 'axis';
    group._axisId = `ax-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    group.on('rotating', function () {
      this._objects.forEach(o => {
        if (o._type === 'math-label' || o.type === 'text') o.set({ angle: -this.angle });
      });
      this.set({ dirty: true });
    });

    // O·x·y 레이블을 그룹 밖 독립 객체로 설정 (원위치 기준 반경 내 드래그 가능)
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
      canvas.add(group);
      labels.forEach(lbl => canvas.add(lbl));
      canvas.renderAll();
      switchToSelect();
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
    canvas.add(group);
    labels.forEach(lbl => canvas.add(lbl));
    canvas.setActiveObject(group);
    canvas.renderAll();
    switchToSelect();
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
    // 기존 독립 레이블 제거
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
    canvas.remove(group);
    canvas.add(newGroup);
    labels.forEach(lbl => canvas.add(lbl));
    canvas.setActiveObject(newGroup);
    canvas.renderAll();
  }

  function confirmAxisRatio() { axisRatioCallback = null; }
  function cancelAxisRatio()  { axisRatioCallback = null; }

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
          document.getElementById('graph-scale').value  = Math.round(pxPerUnit);
          document.getElementById('graph-yscale').value = Math.round(pxPerUnit);
          document.getElementById('graph-scale-hint').textContent = `축 감지`;
          document.getElementById('graph-xmin').value = -Math.floor(data.xNegLen / tick.spacing);
          document.getElementById('graph-xmax').value =  Math.floor(data.xLen    / tick.spacing);
        } else {
          document.getElementById('graph-scale').value  = 40;
          document.getElementById('graph-yscale').value = 40;
          document.getElementById('graph-scale-hint').textContent = '(눈금 없음)';
          document.getElementById('graph-xmin').value = -5;
          document.getElementById('graph-xmax').value =  5;
        }
      }
    }

    if (axisGroups.length === 0) {
      document.getElementById('graph-scale').value  = 40;
      document.getElementById('graph-yscale').value = 40;
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
  const _SAFE_RE    = /^[0-9x\s\+\-\*\/().,\*\*%]+$/; // ^ 제거(XOR 오해석), ! 제거(NaN)
  function _isSafeMathExpr(expr) {
    return _SAFE_RE.test(expr.replace(_MATH_NAMES, '1'));
  }

  function buildGraphPath(exprStr, xMin, xMax, xScale, yScale, origin, xDir, yDir) {
    if (!_isSafeMathExpr(exprStr)) return null;
    const fnBody = `const {abs,acos,asin,atan,atan2,ceil,cos,exp,floor,log,log2,max,min,pow,round,sign,sin,sqrt,tan,PI,E}=Math; return (${exprStr});`;
    let fn;
    try { fn = new Function('x', fnBody); } catch (_) { return null; }

    const steps   = Math.min(Math.ceil(Math.abs(xMax - xMin) * xScale), 2000);
    const maxJump = yScale * 10;
    let d         = '';
    let prevCy    = null;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + (i / steps) * (xMax - xMin);
      let y;
      try { y = fn(x); } catch (_) { prevCy = null; continue; }
      if (!isFinite(y) || isNaN(y)) { prevCy = null; continue; }

      const cx = origin.x + x * xScale * xDir.x + y * yScale * yDir.x;
      const cy = origin.y + x * xScale * xDir.y + y * yScale * yDir.y;

      if (prevCy !== null && Math.abs(cy - prevCy) > maxJump) { prevCy = null; }
      d += prevCy === null ? `M ${cx} ${cy} ` : `L ${cx} ${cy} `;
      prevCy = cy;
    }

    if (!d.trim()) return null;

    const path = new fabric.Path(d, { stroke: color, strokeWidth, fill: '', lockUniScaling: true });
    path._type        = 'graph';
    path._graphExpr   = exprStr;
    path._graphXMin   = xMin;
    path._graphXMax   = xMax;
    path._graphScale  = xScale;
    path._graphYScale = yScale;
    return path;
  }

  function confirmGraph() {
    const ctx    = _pendingGraphCtx;
    if (!ctx) return;
    const fnKey  = document.getElementById('graph-fn-type').value;
    const def    = GRAPH_FN_DEFS.find(d => d.key === fnKey);
    const xMin   = parseFloat(document.getElementById('graph-xmin').value);
    const xMax   = parseFloat(document.getElementById('graph-xmax').value);
    const xScale = parseFloat(document.getElementById('graph-scale').value)  || 40;
    const yScale = parseFloat(document.getElementById('graph-yscale').value) || xScale;
    if (isNaN(xMin) || isNaN(xMax) || xMin >= xMax) return;

    let exprStr, savedParams = null;
    if (!def || !def.build) {
      exprStr = document.getElementById('graph-expr').value.trim();
      if (!exprStr) return;
    } else {
      const p = {};
      document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
        p[inp.dataset.key] = parseFloat(inp.value);
        if (isNaN(p[inp.dataset.key])) p[inp.dataset.key] = 0;
      });
      savedParams = p;
      exprStr = def.build(p);
    }

    const path = buildGraphPath(exprStr, xMin, xMax, xScale, yScale, ctx.axisOrigin, ctx.axisXDir, ctx.axisYDir);
    if (!path) {
      const target = fnKey === 'custom'
        ? document.getElementById('graph-expr')
        : document.getElementById('graph-params-area');
      target.style.outline = '2px solid #f38ba8';
      setTimeout(() => { target.style.outline = ''; }, 800);
      return;
    }
    path._graphOriginX = ctx.axisOrigin.x;
    path._graphOriginY = ctx.axisOrigin.y;
    path._graphXDirX   = ctx.axisXDir.x;
    path._graphXDirY   = ctx.axisXDir.y;
    path._graphFnKey   = fnKey;
    path._graphParams  = savedParams;

    document.getElementById('graph-modal').classList.add('hidden');
    if (ctx.existingPath) canvas.remove(ctx.existingPath);
    _pendingGraphCtx = null;
    canvas.add(path);
    canvas.setActiveObject(path);
    canvas.renderAll();
    switchToSelect();
  }

  function cancelGraph() {
    document.getElementById('graph-modal').classList.add('hidden');
    _pendingGraphCtx = null;
  }

  function showGraphEditModal(existing) {
    const axisOrigin = { x: existing._graphOriginX || 0, y: existing._graphOriginY || 0 };
    const axisXDir   = { x: existing._graphXDirX !== undefined ? existing._graphXDirX : 1,
                         y: existing._graphXDirY !== undefined ? existing._graphXDirY : 0 };
    const axisYDir   = { x: axisXDir.y, y: -axisXDir.x };
    _pendingGraphCtx = { axisOrigin, axisXDir, axisYDir, existingPath: existing };

    // fn-type 설정 → app.js change 리스너가 params area를 기본값으로 재생성
    const fnKey  = existing._graphFnKey || 'custom';
    const select = document.getElementById('graph-fn-type');
    select.value = fnKey;
    select.dispatchEvent(new Event('change')); // 동기 실행 → params area 재생성됨

    // 저장된 파라미터 값으로 덮어쓰기
    if (existing._graphParams) {
      document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
        const v = existing._graphParams[inp.dataset.key];
        if (v !== undefined) inp.value = v;
      });
      // 프리뷰 갱신 트리거
      const first = document.querySelector('#graph-params-area .graph-param');
      if (first) first.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (fnKey === 'custom') {
      document.getElementById('graph-expr').value = existing._graphExpr || '';
      document.getElementById('graph-expr').dispatchEvent(new Event('input'));
    }

    document.getElementById('graph-xmin').value   = existing._graphXMin  !== undefined ? existing._graphXMin  : -5;
    document.getElementById('graph-xmax').value   = existing._graphXMax  !== undefined ? existing._graphXMax  : 5;
    document.getElementById('graph-scale').value  = existing._graphScale  || 40;
    document.getElementById('graph-yscale').value = existing._graphYScale || existing._graphScale || 40;
    document.getElementById('graph-scale-hint').textContent = '';
    document.getElementById('graph-modal').classList.remove('hidden');
    setTimeout(() => {
      const target = fnKey === 'custom'
        ? document.getElementById('graph-expr')
        : document.querySelector('#graph-params-area .graph-param');
      if (target) { target.select && target.select(); target.focus(); }
    }, 50);
  }

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

  // ── Line 2-click tool ──
  function _updateLinePreview(endPt) {
    CanvasManager.setHistoryLock(true);
    if (linePreviewObj) { canvas.remove(linePreviewObj); linePreviewObj = null; }
    const obj = buildObject(lineStartPt, endPt, null);
    if (obj) {
      obj._isTempPreview = true;
      obj.set({ opacity: 0.5, selectable: false, evented: false });
      canvas.add(obj);
      canvas.renderAll();
      linePreviewObj = obj;
    }
    CanvasManager.setHistoryLock(false);
  }

  function _finishLine(endPt) {
    CanvasManager.setHistoryLock(true);
    if (linePreviewObj) { canvas.remove(linePreviewObj); linePreviewObj = null; }
    CanvasManager.setHistoryLock(false);
    linePhase = 0;
    if (dist(lineStartPt, endPt) < 4) { lineStartPt = null; return; }
    const obj = buildObject(lineStartPt, endPt, null);
    lineStartPt = null;
    if (obj) { canvas.add(obj); canvas.setActiveObject(obj); canvas.renderAll(); }
  }

  function _cancelLine() {
    CanvasManager.setHistoryLock(true);
    if (linePreviewObj) { canvas.remove(linePreviewObj); linePreviewObj = null; }
    CanvasManager.setHistoryLock(false);
    linePhase = 0; lineStartPt = null;
    canvas.renderAll();
  }

  // ── Polygon tool ──
  function _updatePolygonPreview(mousePt) {
    CanvasManager.setHistoryLock(true);
    if (polygonPreviewObj) { canvas.remove(polygonPreviewObj); polygonPreviewObj = null; }
    if (polygonSnapMarker) { canvas.remove(polygonSnapMarker); polygonSnapMarker = null; }
    if (polygonVertices.length === 0) { CanvasManager.setHistoryLock(false); return; }

    const pts = [...polygonVertices, mousePt];
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
    d += ` Z`;
    polygonPreviewObj = new fabric.Path(d, {
      stroke: color, strokeWidth, fill: '',
      strokeDashArray: [4, 4],
      selectable: false, evented: false, opacity: 0.6,
      _isTempPreview: true,
    });
    canvas.add(polygonPreviewObj);

    // 첫 꼭짓점 스냅 마커 (꼭짓점 2개 이상일 때 표시)
    if (polygonVertices.length >= 2) {
      const v0 = polygonVertices[0];
      const near = dist(mousePt, v0) < POLY_SNAP_RADIUS;
      polygonSnapMarker = new fabric.Circle({
        left: v0.x, top: v0.y,
        radius: near ? 8 : 5,
        originX: 'center', originY: 'center',
        fill: near ? color : 'transparent',
        stroke: color, strokeWidth: near ? 2 : 1.5,
        opacity: near ? 1 : 0.7,
        selectable: false, evented: false,
        _isTempPreview: true,
      });
      canvas.add(polygonSnapMarker);
    }

    canvas.renderAll();
    CanvasManager.setHistoryLock(false);
  }

  function _finishPolygon() {
    CanvasManager.setHistoryLock(true);
    if (polygonPreviewObj) { canvas.remove(polygonPreviewObj); polygonPreviewObj = null; }
    if (polygonSnapMarker) { canvas.remove(polygonSnapMarker); polygonSnapMarker = null; }
    CanvasManager.setHistoryLock(false);
    const verts = [...polygonVertices];
    polygonVertices = [];
    if (verts.length < 3) { canvas.renderAll(); return; }
    const poly = new fabric.Polygon(verts, {
      fill: _shapeFill(), stroke: _strokeVal(), strokeWidth,
    });
    canvas.add(poly);
    canvas.setActiveObject(poly);
    canvas.renderAll();
    currentTool = 'select'; // H-5: switchToSelect 전에 변경해 이중 cancel 방지
    switchToSelect();
  }

  function _cancelPolygon() {
    CanvasManager.setHistoryLock(true);
    if (polygonPreviewObj) { canvas.remove(polygonPreviewObj); polygonPreviewObj = null; }
    if (polygonSnapMarker) { canvas.remove(polygonSnapMarker); polygonSnapMarker = null; }
    CanvasManager.setHistoryLock(false);
    polygonVertices = [];
    canvas.renderAll();
  }

  function confirmPolygon() { _finishPolygon(); }
  function cancelPolygon()  { _cancelPolygon(); switchToSelect(); }

  // ── Arc/Sector tool ──
  function _buildArcPathData(endAngle) {
    let sweep = endAngle - arcStartAngle;
    // always go clockwise (positive sweep on screen)
    if (sweep <= 0) sweep += 2 * Math.PI;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const sx = arcCenter.x + arcRadius * Math.cos(arcStartAngle);
    const sy = arcCenter.y + arcRadius * Math.sin(arcStartAngle);
    const ex = arcCenter.x + arcRadius * Math.cos(endAngle);
    const ey = arcCenter.y + arcRadius * Math.sin(endAngle);
    if (shapeFillEnabled) {
      // 부채꼴: 중심 → 시작점 → 호 → 닫기
      return `M ${arcCenter.x} ${arcCenter.y} L ${sx} ${sy} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${ex} ${ey} Z`;
    } else {
      // 호만
      return `M ${sx} ${sy} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${ex} ${ey}`;
    }
  }

  function _updateArcPreview(mousePt) {
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }

    let d;
    if (arcPhase === 1) {
      // 반지름 가이드 선
      d = `M ${arcCenter.x} ${arcCenter.y} L ${mousePt.x} ${mousePt.y}`;
    } else {
      const endAngle = Math.atan2(mousePt.y - arcCenter.y, mousePt.x - arcCenter.x);
      d = _buildArcPathData(endAngle);
    }

    arcPreviewObj = new fabric.Path(d, {
      stroke: color, strokeWidth, fill: arcPhase === 2 && shapeFillEnabled ? _shapeFill() : '',
      strokeDashArray: [4, 4],
      selectable: false, evented: false, opacity: 0.6,
      _isTempPreview: true,
    });
    canvas.add(arcPreviewObj);
    canvas.renderAll();
    CanvasManager.setHistoryLock(false);
  }

  function _finishArc(endPt) {
    const endAngle = Math.atan2(endPt.y - arcCenter.y, endPt.x - arcCenter.x);
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }
    CanvasManager.setHistoryLock(false);

    const d = _buildArcPathData(endAngle);
    const obj = new fabric.Path(d, {
      fill: shapeFillEnabled ? _shapeFill() : '', stroke: _strokeVal(), strokeWidth,
    });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();

    arcPhase = 0; arcCenter = null;
    currentTool = 'select'; // H-5: 이중 cancel 방지
    switchToSelect();
  }

  function _cancelArc() {
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }
    CanvasManager.setHistoryLock(false);
    arcPhase = 0; arcCenter = null;
    canvas.renderAll();
  }

  function cancelArc() { _cancelArc(); switchToSelect(); }

  return {
    init, setTool,
    setColor, setStrokeWidth, setFillOpacity, setFontSize, setDashPattern,
    setLineStyle, setArrowStyle, setPointStyle,
    setShapeFillEnabled, setShapeFillColor,
    setStrokeEnabled,
    setCoverFillColor, getCoverFillColor,
    setCurrentLabel, getCurrentLabel,
    getCurrentTool,
    confirmText, cancelText,
    confirmAngle, cancelAngle,
    rebuildAxis, rebuildMathTextSize,
    confirmAxisRatio, cancelAxisRatio,
    confirmGraph, cancelGraph, GRAPH_FN_DEFS,
    confirmPolygon, cancelPolygon,
    cancelArc,
    toggleGridSnap, setGridSize,
    toggleLock,
  };
})();
