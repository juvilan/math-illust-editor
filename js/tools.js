const Tools = (() => {
  let canvas = null;
  let currentTool = 'select';

  // Drawing state
  let isDrawing = false;
  let startPt   = null;
  let previewObj = null;

  // Grid snap
  let gridSnapEnabled = false;
  let gridSize = 10;

  // Drawing options (kept in sync with ToolState via setters)
  let color          = '#000000';
  let strokeWidth    = 2;
  let fillOpacity    = 0.3;
  let fontSize       = 18;
  let dashPattern    = [8, 6];
  let lineStyle      = 'solid';
  let arrowStyle     = 'none';
  let pointStyle     = 'closed';
  let shapeFillEnabled = false;
  let shapeFillColor   = '#aaaaaa';
  let strokeEnabled    = true;

  // ── Setters (sync local vars + ToolState) ──
  function setColor(c)           { color          = c;                  ToolState.color          = c; }
  function setStrokeWidth(w)     { strokeWidth    = parseInt(w);        ToolState.strokeWidth    = strokeWidth; }
  function setFillOpacity(o)     { fillOpacity    = parseFloat(o) / 100; ToolState.fillOpacity   = fillOpacity; }
  function setFontSize(s)        { fontSize       = parseInt(s);        ToolState.fontSize       = fontSize; }
  function setDashPattern(v)     { dashPattern    = v.split(',').map(Number); ToolState.dashPattern = dashPattern; }
  function setLineStyle(v)       { lineStyle      = v;                  ToolState.lineStyle      = v; }
  function setArrowStyle(v)      { arrowStyle     = v;                  ToolState.arrowStyle     = v; }
  function setPointStyle(v)      { pointStyle     = v;                  ToolState.pointStyle     = v; }
  function setShapeFillEnabled(v){ shapeFillEnabled = v;                ToolState.shapeFillEnabled = v; }
  function setShapeFillColor(v)  { shapeFillColor = v;                  ToolState.shapeFillColor = v; }
  function setStrokeEnabled(v)   { strokeEnabled  = v;                  ToolState.strokeEnabled  = v; }

  // Delegates to MathTextTools
  function setLabelMode(v)  { MathTextTools.setLabelMode(v); }
  function setLabelValue(v) { MathTextTools.setLabelValue(v); }
  function getLabelMode()   { return MathTextTools.getLabelMode(); }
  function getLabelValue()  { return MathTextTools.getLabelValue(); }

  // Delegates to ShapeTools
  function setCoverFillColor(c) { ShapeTools.setCoverFillColor(c); }
  function getCoverFillColor()  { return ShapeTools.getCoverFillColor(); }

  function getCurrentTool() { return currentTool; }

  function init(c) {
    canvas = c;
    ToolState.canvas = c;
    canvas.on('mouse:down',    onMouseDown);
    canvas.on('mouse:move',    onMouseMove);
    canvas.on('mouse:up',      onMouseUp);
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
    if (currentTool === 'arc')     ArcTools.cancel();
    currentTool = tool;
    isDrawing   = false;
    startPt     = null;
    removePreview();

    const isSelect = tool === 'select';
    canvas.isDrawingMode = false;
    canvas.selection     = isSelect;
    canvas.defaultCursor = isSelect ? 'default' : 'crosshair';

    canvas.getObjects().forEach(obj => {
      obj.selectable = isSelect;
      obj.evented    = isSelect;
    });
    canvas.renderAll();
  }

  function switchToSelect() {
    setTool('select');
    document.dispatchEvent(new CustomEvent('tool:switch', { detail: 'select' }));
  }

  // ── Pointer helpers ──
  function ptr(e)  { return canvas.getPointer(e.e); }
  function ptSnap(e) {
    const p = ptr(e);
    if (!gridSnapEnabled) return p;
    return { x: Math.round(p.x / gridSize) * gridSize, y: Math.round(p.y / gridSize) * gridSize };
  }

  function snapAngle(start, raw, e) {
    if (!e.e || !e.e.shiftKey) return raw;
    const dx      = raw.x - start.x;
    const dy      = raw.y - start.y;
    const angle   = Math.atan2(dy, dx);
    const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
    const r       = Math.sqrt(dx * dx + dy * dy);
    return { x: start.x + r * Math.cos(snapped), y: start.y + r * Math.sin(snapped) };
  }

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
      MathTextTools.showTextModal(p);
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
      MathTextTools.placeLabelAt(p);
      return;
    }

    if (currentTool === 'bucket') {
      ShapeTools.applyBucketFill(p);
      return;
    }

    if (currentTool === 'point') {
      canvas.add(ShapeTools.buildPoint(p, pointStyle === 'open'));
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
    startPt   = p;
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
      AnnotationTools.startAngle(startPt, p);
      startPt = null;
      return;
    }

    if (currentTool === 'arc-dim') {
      AnnotationTools.startArcDim(startPt, p);
      startPt = null;
      return;
    }

    if (currentTool === 'projection') {
      const obj = ShapeTools.buildProjection(startPt, p);
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

    if (e.target && e.target._type === 'graph') {
      GraphTools.showGraphEditModal(e.target);
      return;
    }

    if (e.target && e.target._type === 'axis') {
      return;
    }

    if (e.target && e.target._type === 'math-text') {
      MathTextTools.openMathTextEdit(e.target);
      return;
    }

    if (e.target && e.target._type === 'angle') {
      AnnotationTools.openAngleEdit(e.target);
      return;
    }

    if (e.target && e.target._type === 'arc-dim') {
      MathTextTools.openArcDimEdit(e.target);
    }
  }

  // ── Build object dispatcher ──
  function buildObject(start, end, e) {
    switch (currentTool) {
      case 'line':
        if (arrowStyle === 'none') return ShapeTools.buildLine(start, end, lineStyle === 'dashed');
        return ShapeTools.buildArrow(start, end, arrowStyle === 'both', lineStyle === 'dashed');
      case 'arc-dim':    return AnnotationTools.buildArcDimPreview(start, end);
      case 'projection': return ShapeTools.buildProjectionPreview(start, end);
      case 'circle':     return ShapeTools.buildCircleOrEllipse(start, end, true,  e);
      case 'ellipse':    return ShapeTools.buildCircleOrEllipse(start, end, false, e);
      case 'rect':       return ShapeTools.buildRect(start, end, e);
      case 'cover':      return ShapeTools.buildCoverRect(start, end, e);
      default:           return null;
    }
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
    const lock    = !obj._locked;
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

  return {
    init, setTool,
    setColor, setStrokeWidth, setFillOpacity, setFontSize, setDashPattern,
    setLineStyle, setArrowStyle, setPointStyle,
    setShapeFillEnabled, setShapeFillColor,
    setStrokeEnabled,
    setCoverFillColor, getCoverFillColor,
    setLabelMode, setLabelValue, getLabelMode, getLabelValue,
    getCurrentTool,
    switchToSelect,
    toggleGridSnap, setGridSize,
    toggleLock,
    // MathTextTools delegates
    buildMathLabel:      (...args) => MathTextTools.buildMathLabel(...args),
    rebuildLabel:        (...args) => MathTextTools.rebuildLabel(...args),
    rebuildMathTextSize: (...args) => MathTextTools.rebuildMathTextSize(...args),
    confirmText:         ()        => MathTextTools.confirmText(),
    cancelText:          ()        => MathTextTools.cancelText(),
    // AnnotationTools delegates
    confirmAngle: () => AnnotationTools.confirmAngle(),
    cancelAngle:  () => AnnotationTools.cancelAngle(),
    // AxisTools delegates
    rebuildAxis:      (...args) => AxisTools.rebuildAxis(...args),
    confirmAxisRatio: ()        => AxisTools.confirmAxisRatio(),
    cancelAxisRatio:  ()        => AxisTools.cancelAxisRatio(),
    // GraphTools delegates
    confirmGraph:              ()        => GraphTools.confirmGraph(),
    cancelGraph:               ()        => GraphTools.cancelGraph(),
    rebuildGraphFromInspector: (...args) => GraphTools.rebuildGraphFromInspector(...args),
    GRAPH_FN_DEFS,
    // PolygonTools delegates
    confirmPolygon: () => PolygonTools.confirmPolygon(),
    cancelPolygon:  () => PolygonTools.cancelPolygon(),
    // ArcTools delegates
    cancelArc: () => ArcTools.cancelArc(),
  };
})();
