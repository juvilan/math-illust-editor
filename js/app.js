document.addEventListener('DOMContentLoaded', () => {
  const canvas = CanvasManager.init();
  Tools.init(canvas);

  // ── File load ──
  document.getElementById('file-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) { e.target.value = ''; return; }
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))
      await CanvasManager.loadSVG(file);
    else
      await CanvasManager.loadImage(file);
    e.target.value = '';
  });

  document.getElementById('btn-load-json').addEventListener('click', () => {
    document.getElementById('json-input').click();
  });

  document.getElementById('json-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) await CanvasManager.loadJSON(file);
    e.target.value = '';
  });

  // ── Tool buttons ──
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      Tools.setTool(tool);
      _updateToolOpts(tool);
    });
  });

  // 도구 자동 복귀 이벤트 (텍스트/각도/호치수 배치 후 select로)
  document.addEventListener('tool:switch', (e) => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${e.detail}"]`);
    if (btn) btn.classList.add('active');
    _updateToolOpts(e.detail);
  });

  // ── Tool-Options Bar: 도구에 맞는 옵션만 표시 ──
  function _updateToolOpts(tool) {
    document.querySelectorAll('#tool-options-bar .topt, #tool-options-bar .topt-sep').forEach(el => {
      const tools = el.dataset.tools ? el.dataset.tools.split(',') : [];
      el.classList.toggle('hidden', !tools.includes(tool));
    });
  }
  // 초기 상태: select 도구
  _updateToolOpts('select');

  // ── Toast 알림 ──
  let _toastTimer = null;
  const _toastEl = document.getElementById('toast');
  document.addEventListener('ui:toast', (e) => {
    clearTimeout(_toastTimer);
    _toastEl.textContent = e.detail;
    _toastEl.classList.remove('hidden', 'toast-fade-out');
    _toastTimer = setTimeout(() => {
      _toastEl.classList.add('toast-fade-out');
      setTimeout(() => _toastEl.classList.add('hidden'), 260);
    }, 3000);
  });

  // ── Tool Rail 스크롤 힌트 ──
  const railEl = document.getElementById('tool-rail');
  const railHint = document.getElementById('rail-scroll-hint');
  function _updateRailHint() {
    const atBottom = railEl.scrollTop + railEl.clientHeight >= railEl.scrollHeight - 4;
    railHint.style.opacity = atBottom ? '0' : '1';
  }
  railEl.addEventListener('scroll', _updateRailHint, { passive: true });
  requestAnimationFrame(_updateRailHint);

  // ── eachLeaf: 단일/그룹/다중선택 처리 ──
  function eachLeaf(fn) {
    const active = canvas.getActiveObject();
    if (!active) return;
    const tops = active.type === 'activeSelection' ? active._objects : [active];
    tops.forEach(obj => {
      if (obj.type === 'group') {
        obj._objects.forEach(child => fn(child, obj));
        obj.set({ dirty: true });
      } else {
        fn(obj, null);
      }
    });
    canvas.renderAll();
  }

  // ── rgba 헬퍼 ──
  function _hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  // ── Color ──
  document.getElementById('color-picker').addEventListener('input', (e) => {
    const c = e.target.value;
    Tools.setColor(c);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    // Inspector 동기화 (Issue #3)
    document.getElementById('insp-stroke-color').value = c;
    CanvasManager.snapshot();
  });

  // ── Stroke width ──
  document.getElementById('stroke-width').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('stroke-width-val').textContent = val;
    Tools.setStrokeWidth(val);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type !== 'text' && child.type !== 'i-text') child.set({ strokeWidth: val });
    });
    CanvasManager.snapshot();
  });

  // ── 화살표·점 스타일 ──
  document.getElementById('arrow-style').addEventListener('change', (e) => Tools.setArrowStyle(e.target.value));
  document.getElementById('point-style').addEventListener('change', (e) => Tools.setPointStyle(e.target.value));

  // ── Label ──
  document.getElementById('label-current').addEventListener('change', (e) => {
    Tools.setCurrentLabel(e.target.value.trim() || 'A');
  });
  document.getElementById('label-current').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  document.getElementById('btn-label-reset').addEventListener('click', () => {
    Tools.setCurrentLabel('A');
  });

  // ── Cover 가리기 색상 + 스포이드 ──
  document.getElementById('cover-fill-color').addEventListener('input', (e) => {
    Tools.setCoverFillColor(e.target.value);
  });

  let _eyedropperActive = false;

  function _handleEyedropperClick(e) {
    _eyedropperActive = false;
    e.stopImmediatePropagation();
    document.getElementById('cover-eyedropper-btn').style.outline = '';

    const canvasEl = canvas.lowerCanvasEl;
    const rect = canvasEl.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const px = canvasEl.getContext('2d').getImageData(x, y, 1, 1).data;
    const hex = '#' + [px[0], px[1], px[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    document.getElementById('cover-fill-color').value = hex;
    Tools.setCoverFillColor(hex);
  }

  document.getElementById('cover-eyedropper-btn').addEventListener('click', () => {
    _eyedropperActive = true;
    document.getElementById('cover-eyedropper-btn').style.outline = '2px solid var(--blue)';
    canvas.lowerCanvasEl.addEventListener('mousedown', _handleEyedropperClick, { once: true, capture: true });
  });

  // ── Actions ──
  document.getElementById('btn-export').addEventListener('click', () => CanvasManager.exportPNG());
  document.getElementById('btn-export-svg').addEventListener('click', () => CanvasManager.exportSVG());
  document.getElementById('btn-save').addEventListener('click', () => CanvasManager.saveJSON());
  document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

  document.getElementById('btn-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    // Inspector 잠금 버튼도 동기화 (Issue #4)
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';
    CanvasManager.snapshot();
  });

  const _gridOverlay = document.getElementById('grid-overlay');
  document.getElementById('btn-grid-snap').addEventListener('click', () => {
    const on = Tools.toggleGridSnap();
    document.getElementById('btn-grid-snap').classList.toggle('active', on);
    _gridOverlay.classList.toggle('hidden', !on);
  });
  document.getElementById('grid-size-input').addEventListener('change', (e) => {
    const sz = Math.max(2, parseInt(e.target.value) || 10);
    Tools.setGridSize(sz);
    _gridOverlay.style.backgroundSize = `${sz}px ${sz}px`;
  });

  function deleteActive() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    const targets = obj.type === 'activeSelection' ? canvas.getActiveObjects() : [obj];
    targets.forEach(o => {
      canvas.remove(o);
      // 좌표축 삭제 시 연동된 독립 레이블도 함께 제거
      if (o._type === 'axis' && o._axisId) {
        canvas.getObjects()
          .filter(lbl => lbl._type === 'axis-label' && lbl._axisId === o._axisId)
          .forEach(lbl => canvas.remove(lbl));
      }
    });
    if (obj.type === 'activeSelection') canvas.discardActiveObject();
    canvas.renderAll();
  }

  document.getElementById('btn-delete').addEventListener('click', deleteActive);

  // ── Z-order ──
  document.getElementById('btn-bring-forward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.bringForward(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });
  document.getElementById('btn-send-backward').addEventListener('click', () => {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    canvas.sendBackwards(obj);
    canvas.renderAll();
    CanvasManager.snapshot();
  });

  // ── 대칭 / 회전 ──
  function transformActive(fn) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    fn(obj);
    obj.setCoords();
    canvas.renderAll();
    CanvasManager.snapshot();
  }

  document.getElementById('btn-flip-x').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipX: !obj.flipX }));
  });
  document.getElementById('btn-flip-y').addEventListener('click', () => {
    transformActive(obj => obj.set({ flipY: !obj.flipY }));
  });
  document.getElementById('btn-rotate-ccw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) - 90 + 360) % 360 }));
  });
  document.getElementById('btn-rotate-cw').addEventListener('click', () => {
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) + 90) % 360 }));
  });

  // ── Inspector Panel ──
  const _inspPanel  = document.getElementById('inspector-panel');
  const _inspEmpty  = document.getElementById('insp-empty');
  const _inspObj    = document.getElementById('insp-obj');
  const _main       = document.getElementById('main');

  // Inspector 열기/닫기
  document.getElementById('btn-inspector-toggle').addEventListener('click', () => {
    const hidden = _main.classList.toggle('inspector-hidden');
    document.getElementById('btn-inspector-toggle').classList.toggle('active', !hidden);
  });

  // 객체 타입 한글 이름
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

  function _syncInspector(obj) {
    if (!obj || obj._isTempPreview) { _clearInspector(); return; }
    _inspEmpty.classList.add('hidden');
    _inspObj.classList.remove('hidden');

    // 타입 이름
    const metaName = obj._type ? _TYPE_META[obj._type] : null;
    const typeName = metaName || TYPE_NAMES[obj.type] || obj.type;
    document.getElementById('insp-type').textContent = typeName;

    // 위치
    document.getElementById('insp-x').textContent = Math.round(obj.left || 0);
    document.getElementById('insp-y').textContent = Math.round(obj.top  || 0);

    // 외곽선 (이미지 제외)
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
      // 선 스타일 / 점선 패턴
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
      // 툴바 동기화 (Issue #2/#3)
      if (!noStroke) {
        document.getElementById('color-picker').value = scHex;
        document.getElementById('stroke-width').value = obj.strokeWidth || 1;
        document.getElementById('stroke-width-val').textContent = obj.strokeWidth || 1;
      }
    }

    // 잠금 상태 (Issue #4)
    const locked = !!obj._locked;
    const inspLock = document.getElementById('insp-lock');
    inspLock.textContent = locked ? '🔓 해제' : '🔒 잠금';
    inspLock.style.borderColor = locked ? 'var(--yellow)' : '';
    inspLock.style.color = locked ? 'var(--yellow)' : '';

    // 글자 크기 섹션 (레이블/텍스트)
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

    // 좌표축 설정 섹션
    const axisSection = document.getElementById('insp-axis-section');
    if (obj._type === 'axis' && obj._axisData) {
      axisSection.classList.remove('hidden');
      const d = obj._axisData;
      const sc = obj.scaleX || 1;
      document.getElementById('insp-axis-x-len').value   = Math.round(d.xLen    * sc);
      document.getElementById('insp-axis-y-len').value   = Math.round(d.yLen    * sc);
      document.getElementById('insp-axis-x-neg').value   = Math.round((d.xNegLen || 0) * sc);
      document.getElementById('insp-axis-y-neg').value   = Math.round((d.yNegLen || 0) * sc);
      document.getElementById('insp-axis-label-size').value  = Math.round(d.labelSize || 18);
      const tick = d.tickOpts || {};
      document.getElementById('insp-axis-tick-spacing').value = Math.round((tick.spacing || 0) * sc);
      document.getElementById('insp-axis-show-ticks').checked   = tick.showTicks   !== false;
      document.getElementById('insp-axis-show-numbers').checked = tick.showNumbers !== false;
    } else {
      axisSection.classList.add('hidden');
    }

    // 채우기 (닫힌 도형)
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

  // hex → rgb 변환 (Inspector 색상 피커용)
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

  // Fabric 선택 이벤트
  canvas.on('selection:created', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:updated', (e) => _syncInspector(e.selected?.[0] || canvas.getActiveObject()));
  canvas.on('selection:cleared', () => _clearInspector());
  canvas.on('object:modified', () => {
    const obj = canvas.getActiveObject();
    if (obj) _syncInspector(obj);
  });

  // Inspector 외곽선 없음
  document.getElementById('insp-no-stroke').addEventListener('change', (e) => {
    const hide = e.target.checked;
    Tools.setStrokeEnabled(!hide);
    document.getElementById('insp-stroke-color-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-stroke-width-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-line-style-row').style.display = hide ? 'none' : '';
    document.getElementById('insp-dash-pattern-row').style.display = 'none';
    const strokeVal = hide ? 'transparent' : document.getElementById('insp-stroke-color').value;
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      child.set({ stroke: strokeVal });
    });
    CanvasManager.snapshot();
  });

  // Inspector 색상 변경
  document.getElementById('insp-stroke-color').addEventListener('input', (e) => {
    const c = e.target.value;
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    // 툴바 동기화 (Issue #3)
    document.getElementById('color-picker').value = c;
    Tools.setColor(c);
    CanvasManager.snapshot();
  });

  document.getElementById('insp-stroke-width').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('insp-stroke-width-val').textContent = val;
    eachLeaf((child) => {
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
      eachLeaf((child) => {
        if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
        child.set({ fill: _hexToRgba(fc, pct) });
      });
    } else {
      eachLeaf((child) => {
        if (child.type !== 'image') child.set({ fill: '' });
      });
    }
    CanvasManager.snapshot();
  });

  document.getElementById('insp-fill-color').addEventListener('input', (e) => {
    Tools.setShapeFillColor(e.target.value);
    const pct = parseInt(document.getElementById('insp-opacity').value) / 100;
    const rgba = _hexToRgba(e.target.value, pct);
    eachLeaf((child) => {
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
    eachLeaf((child) => {
      if (child.type === 'image' || child.type === 'text' || child.type === 'i-text') return;
      if (child.fill && child.fill !== '') child.set({ fill: rgba });
    });
    canvas.renderAll();
  });

  // Inspector 선 스타일 / 점선 패턴
  document.getElementById('insp-line-style').addEventListener('change', (e) => {
    const val = e.target.value;
    Tools.setLineStyle(val);
    const isDashed = val === 'dashed';
    document.getElementById('insp-dash-pattern-row').style.display = isDashed ? '' : 'none';
    const pattern = isDashed
      ? document.getElementById('insp-dash-pattern').value.split(',').map(Number)
      : null;
    eachLeaf((child) => {
      if (child.type === 'image' || child._isRightAngleMark) return;
      child.set({ strokeDashArray: pattern });
    });
    CanvasManager.snapshot();
  });

  document.getElementById('insp-dash-pattern').addEventListener('change', (e) => {
    Tools.setDashPattern(e.target.value);
    const pattern = e.target.value.split(',').map(Number);
    eachLeaf((child) => {
      if (child.type === 'image' || child._isRightAngleMark) return;
      if (child.strokeDashArray) child.set({ strokeDashArray: pattern });
    });
    CanvasManager.snapshot();
  });

  // Inspector 레이어 버튼
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

  // Inspector 잠금 (Issue #4)
  document.getElementById('insp-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    if (locked === undefined) return;
    const btn = document.getElementById('insp-lock');
    btn.textContent = locked ? '🔓 해제' : '🔒 잠금';
    btn.style.borderColor = locked ? 'var(--yellow)' : '';
    btn.style.color = locked ? 'var(--yellow)' : '';
    // 상단 잠금 버튼도 동기화
    document.getElementById('btn-lock').textContent = locked ? '🔓 해제' : '🔒 잠금';
    CanvasManager.snapshot();
  });

  // Inspector 삭제
  document.getElementById('insp-delete').addEventListener('click', deleteActive);

  // ── Shortcut overlay ──
  document.getElementById('shortcut-close').addEventListener('click', () => {
    document.getElementById('shortcut-modal').classList.add('hidden');
  });

  // ── Graph modal ──
  const _graphFnSelect = document.getElementById('graph-fn-type');
  Tools.GRAPH_FN_DEFS.forEach(def => {
    const opt = document.createElement('option');
    opt.value = def.key;
    opt.textContent = def.label;
    _graphFnSelect.appendChild(opt);
  });

  function _updateGraphParamsArea(fnKey) {
    const def       = Tools.GRAPH_FN_DEFS.find(d => d.key === fnKey);
    const area      = document.getElementById('graph-params-area');
    const customRow = document.getElementById('graph-custom-row');
    area.innerHTML  = '';
    // 삼차함수 극값 섹션 토글
    document.getElementById('cubic-extrema-area').classList.toggle('hidden', fnKey !== 'cubic');
    document.getElementById('cubic-inflection-row').style.display = 'none';
    if (!def || !def.build) { customRow.classList.remove('hidden'); return; }
    customRow.classList.add('hidden');
    const row = document.createElement('div');
    row.className = 'modal-row';
    row.style.flexWrap = 'wrap';
    row.style.gap = '6px';
    def.params.forEach(({k, v, s}) => {
      const lbl = document.createElement('label');
      lbl.textContent = k + ' =';
      lbl.style.cssText = 'white-space:nowrap;margin-right:2px';
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.className = 'graph-param';
      inp.dataset.key = k;
      inp.value = v;
      inp.step = s;
      inp.style.width = '52px';
      row.appendChild(lbl);
      row.appendChild(inp);
    });
    area.appendChild(row);
  }

  // ── 공용 그래프 개형 맞춤 ──
  function _autoFitGraphScale() {
    const fnKey = _graphFnSelect.value;
    const def   = Tools.GRAPH_FN_DEFS.find(d => d.key === fnKey);
    let exprStr;
    if (!def || !def.build) {
      exprStr = document.getElementById('graph-expr').value.trim();
    } else {
      const p = {};
      document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
        p[inp.dataset.key] = parseFloat(inp.value) || 0;
      });
      exprStr = def.build(p);
    }
    if (!exprStr) return;

    const xMin = parseFloat(document.getElementById('graph-xmin').value);
    const xMax = parseFloat(document.getElementById('graph-xmax').value);
    if (isNaN(xMin) || isNaN(xMax) || xMin >= xMax) return;

    // 함수 샘플링
    let fn;
    try {
      const body = `const {abs,acos,asin,atan,atan2,ceil,cos,exp,floor,log,log2,max,min,pow,round,sign,sin,sqrt,tan,PI,E}=Math; return (${exprStr});`;
      fn = new Function('x', body);
    } catch (_) { return; }

    let yMin = Infinity, yMax = -Infinity;
    const steps = 300;
    for (let i = 0; i <= steps; i++) {
      const x = xMin + (xMax - xMin) * i / steps;
      let y;
      try { y = fn(x); } catch (_) { continue; }
      if (!isFinite(y) || isNaN(y)) continue;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }
    if (!isFinite(yMin) || !isFinite(yMax)) return;

    const targetPx = 260;
    const yRange = yMax - yMin || 1;
    const yscale = Math.round(Math.max(1, Math.min(500, targetPx / yRange)));
    document.getElementById('graph-yscale').value = yscale;

    const xRange = xMax - xMin || 1;
    const xscale = Math.round(Math.max(1, Math.min(500, targetPx / xRange)));
    document.getElementById('graph-scale').value = xscale;
  }

  document.getElementById('graph-autofit-btn').addEventListener('click', _autoFitGraphScale);

  // ── 삼차함수 극값 → 계수 계산 ──
  function _cubicFromExtrema() {
    const x1 = parseFloat(document.getElementById('cubic-max-x').value);
    const y1 = parseFloat(document.getElementById('cubic-max-y').value);
    const x2 = parseFloat(document.getElementById('cubic-min-x').value);
    const y2 = parseFloat(document.getElementById('cubic-min-y').value);
    if ([x1, y1, x2, y2].some(isNaN) || Math.abs(x1 - x2) < 0.001) return null;

    const dx = x1 - x2;
    const a  = 2 * (y2 - y1) / (dx * dx * dx);
    const b  = -1.5 * a * (x1 + x2);
    const c  = 3 * a * x1 * x2;
    const d  = y1 - a * x1 ** 3 - b * x1 ** 2 - c * x1;
    return { a, b, c, d, x1, y1, x2, y2 };
  }

  function _setCubicParams(coeffs) {
    document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
      const k = inp.dataset.key;
      if (k in coeffs) inp.value = parseFloat(coeffs[k].toFixed(4));
    });
    _updateGraphPreview();
  }

  document.getElementById('cubic-calc-btn').addEventListener('click', () => {
    const r = _cubicFromExtrema();
    if (!r) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: '극대·극소 좌표를 모두 입력하세요.' }));
      return;
    }
    _setCubicParams(r);
    // 변곡점 표시
    const ix = (r.x1 + r.x2) / 2;
    const iy = r.a * ix ** 3 + r.b * ix ** 2 + r.c * ix + r.d;
    document.getElementById('cubic-inflection-display').textContent =
      `(${parseFloat(ix.toFixed(3))}, ${parseFloat(iy.toFixed(3))})`;
    document.getElementById('cubic-inflection-row').style.display = '';
  });

  document.getElementById('cubic-autofit-btn').addEventListener('click', () => {
    const r = _cubicFromExtrema();
    if (!r) {
      document.dispatchEvent(new CustomEvent('ui:toast', { detail: '극대·극소 좌표를 모두 입력하세요.' }));
      return;
    }
    _setCubicParams(r);

    // x 범위: 극값 간격의 0.7배 여백
    const margin = Math.abs(r.x2 - r.x1) * 0.7;
    const xMin = Math.min(r.x1, r.x2) - margin;
    const xMax = Math.max(r.x1, r.x2) + margin;
    document.getElementById('graph-xmin').value = parseFloat(xMin.toFixed(2));
    document.getElementById('graph-xmax').value = parseFloat(xMax.toFixed(2));

    // x 비율: x범위에 맞게
    const xscale = Math.round(Math.max(1, Math.min(500, 260 / (xMax - xMin))));
    document.getElementById('graph-scale').value = xscale;

    // 변곡점 표시
    const ix = (r.x1 + r.x2) / 2;
    const iy = r.a * ix ** 3 + r.b * ix ** 2 + r.c * ix + r.d;
    document.getElementById('cubic-inflection-display').textContent =
      `(${parseFloat(ix.toFixed(3))}, ${parseFloat(iy.toFixed(3))})`;
    document.getElementById('cubic-inflection-row').style.display = '';

    // y 비율은 공용 함수로 처리
    _autoFitGraphScale();
  });

  function _updateGraphPreview() {
    const fnKey   = _graphFnSelect.value;
    const def     = Tools.GRAPH_FN_DEFS.find(d => d.key === fnKey);
    const preview = document.getElementById('graph-expr-preview');
    if (!def || !def.display) {
      const expr = document.getElementById('graph-expr').value.trim();
      preview.textContent = expr ? `y = ${expr}` : '';
      return;
    }
    const p = {};
    document.querySelectorAll('#graph-params-area .graph-param').forEach(inp => {
      p[inp.dataset.key] = parseFloat(inp.value);
      if (isNaN(p[inp.dataset.key])) p[inp.dataset.key] = 0;
    });
    preview.textContent = def.display(p);
  }

  _graphFnSelect.addEventListener('change', (e) => {
    _updateGraphParamsArea(e.target.value);
    _updateGraphPreview();
  });
  document.getElementById('graph-params-area').addEventListener('input', (e) => {
    if (e.target.classList.contains('graph-param')) _updateGraphPreview();
  });
  document.getElementById('graph-params-area').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });
  document.getElementById('graph-expr').addEventListener('input', _updateGraphPreview);
  _updateGraphParamsArea(_graphFnSelect.value);
  _updateGraphPreview();

  document.getElementById('graph-ok').addEventListener('click', () => Tools.confirmGraph());
  document.getElementById('graph-cancel').addEventListener('click', () => Tools.cancelGraph());
  document.getElementById('graph-expr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });

  // ── Inspector 글자 크기 ──
  document.getElementById('insp-font-size').addEventListener('input', async (e) => {
    const sz = parseInt(e.target.value);
    document.getElementById('insp-font-size-val').textContent = sz;
    Tools.setFontSize(sz);  // 다음 레이블에도 적용
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

  // ── Inspector 좌표축 적용 ──
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

  // ── Text modal ──
  document.getElementById('text-ok').addEventListener('click', () => Tools.confirmText());
  document.getElementById('text-cancel').addEventListener('click', () => Tools.cancelText());
  document.getElementById('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmText();
    if (e.key === 'Escape') Tools.cancelText();
  });

  // ── Angle modal ──
  document.getElementById('angle-font-size-input').addEventListener('input', (e) => {
    document.getElementById('angle-font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });
  document.getElementById('angle-ok').addEventListener('click', () => Tools.confirmAngle());
  document.getElementById('angle-cancel').addEventListener('click', () => Tools.cancelAngle());
  document.getElementById('angle-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAngle();
    if (e.key === 'Escape') Tools.cancelAngle();
  });

  // ── Font size (text modal) ──
  document.getElementById('font-size-input').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });

  // ── Copy / Paste ──
  let _clipboard = null;
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.clone((cloned) => { _clipboard = cloned; },
        ['_type', '_latex', '_axisData']);
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if (!_clipboard) return;
      _clipboard.clone((cloned) => {
        canvas.discardActiveObject();
        cloned.set({ left: (_clipboard.left || 0) + 20, top: (_clipboard.top || 0) + 20, evented: true });
        if (cloned.type === 'activeSelection') {
          cloned.canvas = canvas;
          cloned.forEachObject(obj => canvas.add(obj));
          cloned.setCoords();
        } else {
          canvas.add(cloned);
        }
        canvas.setActiveObject(cloned);
        canvas.requestRenderAll();
        _clipboard = cloned;
      }, ['_type', '_latex', '_axisData']);
      return;
    }
  });

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (inInput) return;

    if (e.key === '?') {
      document.getElementById('shortcut-modal').classList.toggle('hidden');
      return;
    }

    const toolMap = {
      v: 'select', l: 'line', t: 'text', g: 'angle', f: 'bucket',
      r: 'arc-dim', x: 'axis', e: 'graph', o: 'circle', s: 'rect',
      p: 'projection', n: 'polygon', a: 'arc', q: 'label', w: 'cover',
    };
    const key = e.key.toLowerCase();
    if (toolMap[key] && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
      if (btn) btn.click();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteActive();
    }

    // 화살표 키 이동
    const arrowMap = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (arrowMap[e.key] && Tools.getCurrentTool() === 'select') {
      e.preventDefault();
      const active = canvas.getActiveObject();
      if (!active) return;
      const step = e.shiftKey ? 10 : 1;
      const [dx, dy] = arrowMap[e.key];
      active.set({ left: active.left + dx * step, top: active.top + dy * step });
      active.setCoords();
      canvas.renderAll();
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault();
      CanvasManager.undo();
    }
    if ((e.key === 'z' && e.shiftKey && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      CanvasManager.redo();
    }

    if (e.key === 'Enter' && Tools.getCurrentTool() === 'polygon') {
      e.preventDefault();
      Tools.confirmPolygon();
      return;
    }
    if (e.key === 'Enter' && Tools.getCurrentTool() === 'arc') {
      e.preventDefault();
      Tools.cancelArc();
      return;
    }

    if (e.key === 'Escape') {
      if (_eyedropperActive) {
        _eyedropperActive = false;
        canvas.lowerCanvasEl.removeEventListener('mousedown', _handleEyedropperClick, { capture: true });
        document.getElementById('cover-eyedropper-btn').style.outline = '';
      }
      Tools.cancelText();
      Tools.cancelAngle();
      Tools.cancelAxisRatio();
      Tools.cancelGraph();
      Tools.cancelPolygon();
      Tools.cancelArc();
      document.getElementById('shortcut-modal').classList.add('hidden');
    }
  });

  // ── Drag & drop ──
  document.getElementById('canvas-container').addEventListener('dragover', (e) => e.preventDefault());
  document.getElementById('canvas-container').addEventListener('drop', async (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg'))
      await CanvasManager.loadSVG(file);
    else if (file.type.startsWith('image/')) await CanvasManager.loadImage(file);
    else if (file.name.endsWith('.json')) await CanvasManager.loadJSON(file);
  });
});
