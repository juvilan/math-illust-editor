const GraphTools = (() => {
  let _pendingGraphCtx = null;

  const _MATH_NAMES = /\b(abs|acos|asin|atan2|atan|ceil|cos|exp|floor|log2|log|max|min|pow|round|sign|sin|sqrt|tan|PI|E)\b/g;
  const _SAFE_RE    = /^[0-9x\s\+\-\*\/().,\*\*%]+$/;
  function _isSafeMathExpr(expr) {
    return _SAFE_RE.test(expr.replace(_MATH_NAMES, '1'));
  }

  function showGraphModal(clickPt) {
    const { canvas } = ToolState;
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

  function buildGraphPath(exprStr, xMin, xMax, xScale, yScale, origin, xDir, yDir) {
    const { color, strokeWidth } = ToolState;
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
    const { canvas } = ToolState;
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
    path._graphXMin    = xMin;
    path._graphXMax    = xMax;
    path._graphScale   = xScale;
    path._graphYScale  = yScale;
    if (fnKey === 'custom') path._graphExpr = exprStr;

    document.getElementById('graph-modal').classList.add('hidden');
    if (ctx.existingPath) canvas.remove(ctx.existingPath);
    _pendingGraphCtx = null;
    canvas.add(path);
    canvas.setActiveObject(path);
    canvas.renderAll();
    Tools.switchToSelect();
  }

  function cancelGraph() {
    document.getElementById('graph-modal').classList.add('hidden');
    _pendingGraphCtx = null;
  }

  function rebuildGraphFromInspector(obj, xMin, xMax, xScale, yScale) {
    const { canvas } = ToolState;
    const axisOrigin = { x: obj._graphOriginX || 0, y: obj._graphOriginY || 0 };
    const axisXDir   = { x: obj._graphXDirX !== undefined ? obj._graphXDirX : 1,
                         y: obj._graphXDirY !== undefined ? obj._graphXDirY : 0 };
    const axisYDir   = { x: axisXDir.y, y: -axisXDir.x };

    let exprStr;
    const fnKey = obj._graphFnKey || 'custom';
    const def   = GRAPH_FN_DEFS.find(d => d.key === fnKey);
    if (def && def.build && obj._graphParams) {
      exprStr = def.build(obj._graphParams);
    } else {
      exprStr = obj._graphExpr || '';
    }
    if (!exprStr) return;

    const newPath = buildGraphPath(exprStr, xMin, xMax, xScale, yScale, axisOrigin, axisXDir, axisYDir);
    if (!newPath) return;

    newPath._graphOriginX = obj._graphOriginX;
    newPath._graphOriginY = obj._graphOriginY;
    newPath._graphXDirX   = obj._graphXDirX;
    newPath._graphXDirY   = obj._graphXDirY;
    newPath._graphFnKey   = fnKey;
    newPath._graphParams  = obj._graphParams;
    newPath._graphExpr    = obj._graphExpr;
    newPath._graphXMin    = xMin;
    newPath._graphXMax    = xMax;
    newPath._graphScale   = xScale;
    newPath._graphYScale  = yScale;
    newPath.set({ stroke: obj.stroke, strokeWidth: obj.strokeWidth,
                  strokeDashArray: obj.strokeDashArray });

    canvas.remove(obj);
    canvas.add(newPath);
    canvas.setActiveObject(newPath);
    canvas.renderAll();
    CanvasManager.snapshot();
    return newPath;
  }

  function showGraphEditModal(existing) {
    const axisOrigin = { x: existing._graphOriginX || 0, y: existing._graphOriginY || 0 };
    const axisXDir   = { x: existing._graphXDirX !== undefined ? existing._graphXDirX : 1,
                         y: existing._graphXDirY !== undefined ? existing._graphXDirY : 0 };
    const axisYDir   = { x: axisXDir.y, y: -axisXDir.x };
    _pendingGraphCtx = { axisOrigin, axisXDir, axisYDir, existingPath: existing };

    const fnKey  = existing._graphFnKey || 'custom';
    const select = document.getElementById('graph-fn-type');
    select.value = fnKey;
    select.dispatchEvent(new Event('change'));

    if (existing._graphParams) {
      document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
        const v = existing._graphParams[inp.dataset.key];
        if (v !== undefined) inp.value = v;
      });
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

  return {
    showGraphModal,
    confirmGraph,
    cancelGraph,
    rebuildGraphFromInspector,
    showGraphEditModal,
  };
})();
