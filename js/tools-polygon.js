const PolygonTools = (() => {
  let polygonVertices   = [];
  let polygonPreviewObj = null;
  let polygonSnapMarker = null;
  const POLY_SNAP_RADIUS = 18;

  function _updatePolygonPreview(mousePt) {
    const { canvas, color, strokeWidth } = ToolState;
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
    const { canvas, strokeWidth } = ToolState;
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
    Tools.switchToSelect();
  }

  function _cancelPolygon() {
    const { canvas } = ToolState;
    CanvasManager.setHistoryLock(true);
    if (polygonPreviewObj) { canvas.remove(polygonPreviewObj); polygonPreviewObj = null; }
    if (polygonSnapMarker) { canvas.remove(polygonSnapMarker); polygonSnapMarker = null; }
    CanvasManager.setHistoryLock(false);
    polygonVertices = [];
    canvas.renderAll();
  }

  function handleMouseDown(p) {
    if (polygonVertices.length >= 3 && dist(p, polygonVertices[0]) < POLY_SNAP_RADIUS) {
      _finishPolygon();
      return;
    }
    polygonVertices.push({ x: p.x, y: p.y });
    _updatePolygonPreview(p);
  }

  function handleMouseMove(p) { _updatePolygonPreview(p); }
  function isActive() { return polygonVertices.length > 0; }
  function cancel() { _cancelPolygon(); }
  function confirmPolygon() { _finishPolygon(); }
  function cancelPolygon() { _cancelPolygon(); Tools.switchToSelect(); }

  return { handleMouseDown, handleMouseMove, isActive, cancel, confirmPolygon, cancelPolygon };
})();
