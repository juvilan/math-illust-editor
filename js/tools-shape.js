const ShapeTools = (() => {
  let coverFillColor = '#ffffff';

  function setCoverFillColor(c) { coverFillColor = c; }
  function getCoverFillColor()  { return coverFillColor; }

  function buildLine(start, end, dashed) {
    const { color, strokeWidth, dashPattern } = ToolState;
    return new fabric.Line([start.x, start.y, end.x, end.y], {
      stroke: color, strokeWidth, fill: '',
      strokeDashArray: dashed ? dashPattern : null,
      lockUniScaling: true,
      padding: 6,
    });
  }

  function buildRect(start, end, e) {
    const { color, strokeWidth } = ToolState;
    const dx    = end.x - start.x;
    const dy    = end.y - start.y;
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

  function buildCoverRect(start, end, e) {
    const dx    = end.x - start.x;
    const dy    = end.y - start.y;
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

  function buildArrow(start, end, bothSides, dashed) {
    const { color, strokeWidth, dashPattern } = ToolState;
    const sw      = strokeWidth;
    const angle   = Math.atan2(end.y - start.y, end.x - start.x);
    const headLen = Math.max(12, sw * 6);
    const headHalf = headLen * 0.24;

    const rbx = end.x - headLen * Math.cos(angle);
    const rby = end.y - headLen * Math.sin(angle);
    const rlx = rbx + headHalf * Math.cos(angle + Math.PI / 2);
    const rly = rby + headHalf * Math.sin(angle + Math.PI / 2);
    const rrx = rbx + headHalf * Math.cos(angle - Math.PI / 2);
    const rry = rby + headHalf * Math.sin(angle - Math.PI / 2);

    const lineFrom = bothSides
      ? { x: start.x + headLen * Math.cos(angle), y: start.y + headLen * Math.sin(angle) }
      : start;

    let d = `M ${lineFrom.x} ${lineFrom.y} L ${rbx} ${rby}`;
    d += ` M ${rlx} ${rly} L ${end.x} ${end.y} L ${rrx} ${rry} Z`;

    if (bothSides) {
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

  function buildPoint(p, isOpen) {
    const { color, strokeWidth } = ToolState;
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

  function buildCircleOrEllipse(start, end, forceCircle, e) {
    const { strokeWidth } = ToolState;
    const dx    = end.x - start.x;
    const dy    = end.y - start.y;
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

  function _projDash() {
    return ToolState.lineStyle === 'dashed' ? ToolState.dashPattern : null;
  }

  function buildProjectionPreview(start, end) {
    const { color, strokeWidth } = ToolState;
    const s  = Math.max(8, strokeWidth * 3);
    const sx = (end.x - start.x) >= 0 ? 1 : -1;
    const sy = (end.y - start.y) >= 0 ? 1 : -1;
    const d  = `M ${start.x} ${start.y} L ${start.x} ${end.y} ` +
               `M ${start.x} ${start.y} L ${end.x} ${start.y} ` +
               `M ${start.x+sx*s} ${end.y} L ${start.x+sx*s} ${end.y-sy*s} L ${start.x} ${end.y-sy*s} ` +
               `M ${end.x-sx*s} ${start.y} L ${end.x-sx*s} ${start.y+sy*s} L ${end.x} ${start.y+sy*s}`;
    return new fabric.Path(d, { stroke: color, strokeWidth, fill: '', strokeDashArray: _projDash() });
  }

  function buildProjection(start, end) {
    const { color, strokeWidth } = ToolState;
    const dash = _projDash();
    const s    = Math.max(8, strokeWidth * 3);
    const sx   = (end.x - start.x) >= 0 ? 1 : -1;
    const sy   = (end.y - start.y) >= 0 ? 1 : -1;

    const vLine = new fabric.Line([start.x, start.y, start.x, end.y],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: dash, selectable: false });
    const hLine = new fabric.Line([start.x, start.y, end.x, start.y],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: dash, selectable: false });
    const mark1V = new fabric.Line(
      [start.x+sx*s, end.y,      start.x+sx*s, end.y-sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
    const mark1H = new fabric.Line(
      [start.x+sx*s, end.y-sy*s, start.x,      end.y-sy*s],
      { stroke: color, strokeWidth, fill: '', strokeDashArray: null, _isRightAngleMark: true, selectable: false }
    );
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

  function applyBucketFill(p) {
    const { canvas, color, fillOpacity } = ToolState;
    FillTool.apply(canvas, p.x, p.y, color, fillOpacity, (err, img) => {
      if (err) {
        if (err === 'no-image') {
          document.dispatchEvent(new CustomEvent('ui:toast', {
            detail: '⚠️ 채우기는 배경 이미지가 있을 때만 사용할 수 있습니다. 먼저 이미지를 불러오세요.',
          }));
        } else {
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

  return {
    setCoverFillColor, getCoverFillColor,
    buildLine, buildRect, buildCoverRect, buildArrow, buildPoint,
    buildCircleOrEllipse, buildProjectionPreview, buildProjection,
    applyBucketFill,
  };
})();
