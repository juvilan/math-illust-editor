function initInspector(canvas) {
  const _inspPanel = document.getElementById('inspector-panel');
  const _inspEmpty = document.getElementById('insp-empty');
  const _inspObj   = document.getElementById('insp-obj');
  const _main      = document.getElementById('main');

  document.getElementById('btn-inspector-toggle').addEventListener('click', () => {
    const hidden = _main.classList.toggle('inspector-hidden');
    document.getElementById('btn-inspector-toggle').classList.toggle('active', !hidden);
  });

  const TYPE_NAMES = {
    'line': '선', 'path': '경로', 'ellipse': '타원', 'rect': '직사각형',
    'polygon': '다각형', 'circle': '원', 'image': '이미지', 'text': '텍스트',
    'i-text': '텍스트', 'group': '그룹',
  };
  const _TYPE_META = {
    'math-text': '수식', 'math-label': '레이블', 'bg-image': '배경 이미지',
    'axis': '좌표축', 'graph': '그래프', 'angle': '각도', 'arc-dim': '호치수',
    'projection': '수선의 발', 'axis-label': '축 레이블', 'cover-rect': '가리기',
  };

  function _toHex(color) {
    if (!color || color === 'transparent') return '#000000';
    if (color.startsWith('#')) return color.slice(0, 7);
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!m) return '#000000';
    return '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
  }

  function _parseRgba(color) {
    if (!color) return { hex: '#aaaaaa', alpha: 0.3 };
    const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (m) {
      const hex = '#' + [m[1], m[2], m[3]].map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
      return { hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
    }
    if (color.startsWith('#')) return { hex: color.slice(0, 7), alpha: 1 };
    return { hex: '#aaaaaa', alpha: 0.3 };
  }

  function _syncInspector(obj) {
    if (!obj || obj._isTempPreview) { _clearInspector(); return; }
    _inspEmpty.classList.add('hidden');
    _inspObj.classList.remove('hidden');

    const metaName = obj._type ? _TYPE_META[obj._type] : null;
    const typeName = metaName || TYPE_NAMES[obj.type] || obj.type;
    document.getElementById('insp-type').textContent = typeName;

    document.getElementById('insp-x').textContent = Math.round(obj.left || 0);
    document.getElementById('insp-y').textContent = Math.round(obj.top  || 0);

    const strokeSection = document.getElementById('insp-stroke-section');
    if (obj.type === 'image') {
      strokeSection.style.display = 'none';
    } else {
      strokeSection.style.display = '';
      const sc = obj.stroke || '#000000';
      const noStroke = !sc || sc === 'transparent';
      document.getElementById('insp-no-stroke').checked = noStroke;
      document.getElementById('insp-stroke-color-row').style.display = noStroke ? 'none' : '';
      document.getElementById('insp-stroke-width-row').style.display = noStroke ? 'none' : '';
      const scHex = noStroke ? '#000000' : _toHex(sc);
      document.getElementById('insp-stroke-color').value = scHex;
      document.getElementById('insp-stroke-width').value = obj.strokeWidth || 1;
      document.getElementById('insp-stroke-width-val').textContent = obj.strokeWidth || 1;
      const isTextLike = obj.type === 'text' || obj.type === 'i-text'
        || obj._type === 'math-text' || obj._type === 'math-label' || obj._type === 'axis-label';
      const lineStyleRow = document.getElementById('insp-line-style-row');
      const dashPatternRow = document.getElementById('insp-dash-pattern-row');
      if (isTextLike || obj._type === 'cover-rect' || obj._type === 'bg-image' || noStroke) {
        lineStyleRow.style.display = 'none';
        dashPatternRow.style.display = 'none';
      } else {
        lineStyleRow.style.display = '';
        let dashArr = obj.strokeDashArray;
        if (!dashArr && obj.type === 'group' && obj._objects?.length) {
          dashArr = obj._objects[0].strokeDashArray;
        }
        const isDashed = !!(dashArr && dashArr.length);
        document.getElementById('insp-line-style').value = isDashed ? 'dashed' : 'solid';
        if (isDashed) {
          const patStr = dashArr.join(',');
          const sel = document.getElementById('insp-dash-pattern');
          const matchOpt = [...sel.options].find(o => o.value === patStr);
          if (matchOpt) sel.value = patStr;
        }
        dashPatternRow.style.display = isDashed ? '' : 'none';
      }
      if (!noStroke) {
        document.getElementById('color-picker').value = scHex;
        document.getElementById('stroke-width').value = obj.strokeWidth || 1;
        document.getElementById('stroke-width-val').textContent = obj.strokeWidth || 1;
      }
    }

    const locked = !!obj._locked;
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';

    const fontSection = document.getElementById('insp-font-section');
    const _isTextType = (o) => o._type === 'math-text' || o.type === 'i-text' || o.type === 'text';
    const textObjs = obj.type === 'activeSelection'
      ? (obj._objects || []).filter(_isTextType)
      : (_isTextType(obj) ? [obj] : []);
    if (textObjs.length > 0) {
      fontSection.classList.remove('hidden');
      const sz = textObjs[0]._fontSize || textObjs[0].fontSize || 18;
      document.getElementById('insp-font-size').value = sz;
      document.getElementById('insp-font-size-val').textContent = sz;
    } else {
      fontSection.classList.add('hidden');
    }

    const textSection = document.getElementById('insp-text-section');
    if (obj._type === 'plain-text') {
      textSection.classList.remove('hidden');
      document.getElementById('insp-text-value').value = obj.text || '';
    } else {
      textSection.classList.add('hidden');
    }

    const labelSection = document.getElementById('insp-label-section');
    if (obj._labelMode !== undefined) {
      labelSection.classList.remove('hidden');
      document.getElementById('insp-label-mode').value  = obj._labelMode;
      document.getElementById('insp-label-value').value = obj._labelValue || '';
    } else {
      labelSection.classList.add('hidden');
    }

    const axisSection = document.getElementById('insp-axis-section');
    if (obj._type === 'axis' && obj._axisData) {
      axisSection.classList.remove('hidden');
      const d = obj._axisData;
      const sc = obj.scaleX || 1;
      document.getElementById('insp-axis-x-len').value       = Math.round(d.xLen    * sc);
      document.getElementById('insp-axis-y-len').value       = Math.round(d.yLen    * sc);
      document.getElementById('insp-axis-x-neg').value       = Math.round((d.xNegLen || 0) * sc);
      document.getElementById('insp-axis-y-neg').value       = Math.round((d.yNegLen || 0) * sc);
      document.getElementById('insp-axis-label-size').value  = Math.round(d.labelSize || 18);
      const tick = d.tickOpts || {};
      document.getElementById('insp-axis-tick-spacing').value  = Math.round((tick.spacing || 0) * sc);
      document.getElementById('insp-axis-show-ticks').checked   = tick.showTicks   !== false;
      document.getElementById('insp-axis-show-numbers').checked = tick.showNumbers !== false;
    } else {
      axisSection.classList.add('hidden');
    }

    const graphSection = document.getElementById('insp-graph-section');
    if (obj._type === 'graph' || (obj.type === 'path' && obj._graphFnKey !== undefined)) {
      graphSection.classList.remove('hidden');
      document.getElementById('insp-graph-xmin').value   = obj._graphXMin  !== undefined ? obj._graphXMin  : -5;
      document.getElementById('insp-graph-xmax').value   = obj._graphXMax  !== undefined ? obj._graphXMax  : 5;
      document.getElementById('insp-graph-scale').value  = obj._graphScale  || 40;
      document.getElementById('insp-graph-yscale').value = obj._graphYScale || obj._graphScale || 40;
    } else {
      graphSection.classList.add('hidden');
    }

    const fillSection = document.getElementById('insp-fill-section');
    const fillableTypes = ['ellipse', 'rect', 'polygon', 'path', 'circle'];
    if (fillableTypes.includes(obj.type)) {
      fillSection.style.display = '';
      const hasFill = obj.fill && obj.fill !== '';
      document.getElementById('insp-fill-enabled').checked = hasFill;
      if (hasFill) {
        const { hex, alpha } = _parseRgba(obj.fill);
        document.getElementById('insp-fill-color').value = hex;
        const pct = Math.round(alpha * 100);
        document.getElementById('insp-opacity').value = pct;
        document.getElementById('insp-opacity-val').textContent = pct + '%';
      }
    } else {
      fillSection.style.display = 'none';
    }
  }

  function _clearInspector() {
    _inspEmpty.classList.remove('hidden');
    _inspObj.classList.add('hidden');
  }

  AppCtx.syncInspector = _syncInspector;

  canvas.on('selection:created', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:updated', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:cleared', () => _clearInspector());
  canvas.on('object:modified', () => {
    const obj = canvas.getActiveObject();
    if (obj) _syncInspector(obj);
  });

  document.getElementById('insp-no-stroke').addEventListener('change', (e) => {
    const hide = e.target.checked;
    Tools.setStrokeEnabled(!hide);
    document.getElementById('insp-stroke-color-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-stroke-width-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-line-style-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-dash-pattern-row').style.display = 'none';
    const strokeVal = hide ? 'transparent' : document.getElementById('insp-stroke-color').value;
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      child.set({ stroke: strokeVal });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-stroke-color').addEventListener('input', (e) => {
    const c = e.target.value;
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    document.getElementById('color-picker').value = c;
    Tools.setColor(c);
    CanvasManager.snapshot();
  });

  document.getElementById('insp-stroke-width').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('insp-stroke-width-val').textContent = val;
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type !== 'text' && child.type !== 'i-text') child.set({ strokeWidth: val });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-fill-enabled').addEventListener('change', (e) => {
    const active = canvas.getActiveObject();
    if (!active) return;
    Tools.setShapeFillEnabled(e.target.checked);
    if (e.target.checked) {
      const fc  = document.getElementById('insp-fill-color').value;
      const pct = parseInt(document.getElementById('insp-opacity').value) / 100;
      AppCtx.eachLeaf((child) => {
        if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
        child.set({ fill: _hexToRgba(fc, pct) });
      });
    } else {
      AppCtx.eachLeaf((child) => {
        if (child.type !== 'image') child.set({ fill: '' });
      });
    }
    CanvasManager.snapshot();
  });

  document.getElementById('insp-fill-color').addEventListener('input', (e) => {
    Tools.setShapeFillColor(e.target.value);
    const pct = parseInt(document.getElementById('insp-opacity').value) / 100;
    const rgba = _hexToRgba(e.target.value, pct);
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  document.getElementById('insp-opacity').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('insp-opacity-val').textContent = val + '%';
    Tools.setFillOpacity(val);
    const fc = document.getElementById('insp-fill-color').value;
    const rgba = _hexToRgba(fc, val / 100);
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  document.getElementById('insp-line-style').addEventListener('change', (e) => {
    const val = e.target.value;
    Tools.setLineStyle(val);
    const isDashed = val === 'dashed';
    document.getElementById('insp-dash-pattern-row').style.display = isDashed ? '' : 'none';
    const pattern = isDashed
      ? document.getElementById('insp-dash-pattern').value.split(',').map(Number)
      : null;
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image' || child._isRightAngleMark) return;
      child.set({ strokeDashArray: pattern });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-dash-pattern').addEventListener('change', (e) => {
    Tools.setDashPattern(e.target.value);
    const pattern = e.target.value.split(',').map(Number);
    AppCtx.eachLeaf((child) => {
      if (child.type === 'image' || child._isRightAngleMark) return;
      if (child.strokeDashArray) child.set({ strokeDashArray: pattern });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-bring-fwd').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });
  document.getElementById('insp-send-back').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  document.getElementById('insp-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    const btn = document.getElementById('insp-lock');
    btn.textContent = locked ? '🔓 해제' : '🔒 잠금';
    btn.style.borderColor = locked ? 'var(--yellow)' : '';
    btn.style.color = locked ? 'var(--yellow)' : '';
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    CanvasManager.snapshot();
  });

  document.getElementById('insp-delete').addEventListener('click', () => AppCtx.deleteActive());

  document.getElementById('insp-label-apply').addEventListener('click', async () => {
    const obj = canvas.getActiveObject();
    if (!obj || obj._labelMode === undefined) return;
    const mode  = document.getElementById('insp-label-mode').value;
    const value = document.getElementById('insp-label-value').value.trim();
    if (!value) return;
    await Tools.rebuildLabel(obj, mode, value);
    CanvasManager.snapshot();
  });

  document.getElementById('insp-font-size').addEventListener('input', async (e) => {
    const sz = parseInt(e.target.value);
    document.getElementById('insp-font-size-val').textContent = sz;
    Tools.setFontSize(sz);
    const obj = canvas.getActiveObject();
    if (!obj) return;

    const _isText = (o) => o._type === 'math-text' || o.type === 'i-text' || o.type === 'text';

    if (obj.type === 'activeSelection') {
      const targets = (obj._objects || []).filter(_isText);
      if (targets.length === 0) return;
      canvas.discardActiveObject();
      const newObjs = [];
      for (const t of targets) {
        const result = await Tools.rebuildMathTextSize(t, sz);
        if (result) newObjs.push(result);
      }
      canvas.renderAll();
      CanvasManager.snapshot();
      if (newObjs.length === 1) {
        canvas.setActiveObject(newObjs[0]);
      } else if (newObjs.length > 1) {
        const sel = new fabric.ActiveSelection(newObjs, { canvas });
        canvas.setActiveObject(sel);
      }
      canvas.renderAll();
    } else {
      const result = await Tools.rebuildMathTextSize(obj, sz);
      if (result) {
        canvas.setActiveObject(result);
        canvas.renderAll();
        CanvasManager.snapshot();
        _syncInspector(result);
      }
    }
  });

  document.getElementById('insp-text-value').addEventListener('input', (e) => {
    const obj = canvas.getActiveObject();
    if (!obj || obj._type !== 'plain-text') return;
    obj.set({ text: e.target.value });
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  document.getElementById('insp-axis-apply').addEventListener('click', async () => {
    const obj = canvas.getActiveObject();
    if (!obj || obj._type !== 'axis') return;
    const xLen      = parseFloat(document.getElementById('insp-axis-x-len').value);
    const yLen      = parseFloat(document.getElementById('insp-axis-y-len').value);
    const xNegLen   = parseFloat(document.getElementById('insp-axis-x-neg').value) || 0;
    const yNegLen   = parseFloat(document.getElementById('insp-axis-y-neg').value) || 0;
    const labelSize = parseFloat(document.getElementById('insp-axis-label-size').value) || 18;
    const spacing   = parseFloat(document.getElementById('insp-axis-tick-spacing').value) || 0;
    const showTicks   = document.getElementById('insp-axis-show-ticks').checked;
    const showNumbers = document.getElementById('insp-axis-show-numbers').checked;
    if (xLen > 0 && yLen > 0) {
      await Tools.rebuildAxis(obj, xLen, yLen, xNegLen, yNegLen, labelSize, { spacing, showTicks, showNumbers });
    }
  });

  document.getElementById('insp-graph-apply').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj || obj._graphFnKey === undefined) return;
    const xMin   = parseFloat(document.getElementById('insp-graph-xmin').value);
    const xMax   = parseFloat(document.getElementById('insp-graph-xmax').value);
    const xScale = parseFloat(document.getElementById('insp-graph-scale').value)  || 40;
    const yScale = parseFloat(document.getElementById('insp-graph-yscale').value) || xScale;
    if (isNaN(xMin) || isNaN(xMax) || xMin >= xMax) return;
    const result = Tools.rebuildGraphFromInspector(obj, xMin, xMax, xScale, yScale);
    if (result) _syncInspector(result);
  });
}
