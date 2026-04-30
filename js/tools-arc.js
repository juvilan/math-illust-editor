const ArcTools = (() => {
  let arcPhase      = 0;
  let arcCenter     = null;
  let arcRadius     = 0;
  let arcStartAngle = 0;
  let arcPreviewObj = null;

  function _buildArcPathData(endAngle) {
    let sweep = endAngle - arcStartAngle;
    if (sweep <= 0) sweep += 2 * Math.PI;
    const largeArc = sweep > Math.PI ? 1 : 0;
    const sx = arcCenter.x + arcRadius * Math.cos(arcStartAngle);
    const sy = arcCenter.y + arcRadius * Math.sin(arcStartAngle);
    const ex = arcCenter.x + arcRadius * Math.cos(endAngle);
    const ey = arcCenter.y + arcRadius * Math.sin(endAngle);
    if (ToolState.shapeFillEnabled) {
      return `M ${arcCenter.x} ${arcCenter.y} L ${sx} ${sy} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${ex} ${ey} Z`;
    } else {
      return `M ${sx} ${sy} A ${arcRadius} ${arcRadius} 0 ${largeArc} 1 ${ex} ${ey}`;
    }
  }

  function _updateArcPreview(mousePt) {
    const { canvas, color, strokeWidth } = ToolState;
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }

    let d;
    if (arcPhase === 1) {
      d = `M ${arcCenter.x} ${arcCenter.y} L ${mousePt.x} ${mousePt.y}`;
    } else {
      const endAngle = Math.atan2(mousePt.y - arcCenter.y, mousePt.x - arcCenter.x);
      d = _buildArcPathData(endAngle);
    }

    arcPreviewObj = new fabric.Path(d, {
      stroke: color, strokeWidth,
      fill: arcPhase === 2 && ToolState.shapeFillEnabled ? _shapeFill() : '',
      strokeDashArray: [4, 4],
      selectable: false, evented: false, opacity: 0.6,
      _isTempPreview: true,
    });
    canvas.add(arcPreviewObj);
    canvas.renderAll();
    CanvasManager.setHistoryLock(false);
  }

  function _finishArc(endPt) {
    const { canvas, color, strokeWidth } = ToolState;
    const endAngle = Math.atan2(endPt.y - arcCenter.y, endPt.x - arcCenter.x);
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }
    CanvasManager.setHistoryLock(false);

    const d = _buildArcPathData(endAngle);
    const obj = new fabric.Path(d, {
      fill: _shapeFill(), stroke: _strokeVal(), strokeWidth,
    });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.renderAll();

    arcPhase = 0; arcCenter = null;
    Tools.switchToSelect();
  }

  function _cancelArc() {
    const { canvas } = ToolState;
    CanvasManager.setHistoryLock(true);
    if (arcPreviewObj) { canvas.remove(arcPreviewObj); arcPreviewObj = null; }
    CanvasManager.setHistoryLock(false);
    arcPhase = 0; arcCenter = null;
    canvas.renderAll();
  }

  function handleMouseDown(p) {
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
  }

  function handleMouseMove(p) { _updateArcPreview(p); }
  function isActive() { return arcPhase > 0; }
  function cancel() { _cancelArc(); }
  function cancelArc() { _cancelArc(); Tools.switchToSelect(); }

  return { handleMouseDown, handleMouseMove, isActive, cancel, cancelArc };
})();
