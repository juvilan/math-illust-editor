document.addEventListener('DOMContentLoaded', () => {
  const canvas = CanvasManager.init();
  Tools.init(canvas);
  CloneTool.init(canvas);

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
      const prev = Tools.getCurrentTool();
      if (prev === 'clone') CloneTool.deactivate();
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const next = btn.dataset.tool;
      Tools.setTool(next);
      if (next === 'clone') {
        CloneTool.activate();
        document.getElementById('clone-hint').classList.remove('hidden');
      } else {
        document.getElementById('clone-hint').classList.add('hidden');
      }
    });
  });

  // 도구 자동 복귀 이벤트 (텍스트/각도/호치수 배치 후 select로)
  document.addEventListener('tool:switch', (e) => {
    if (Tools.getCurrentTool() === 'clone') CloneTool.deactivate();
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${e.detail}"]`);
    if (btn) btn.classList.add('active');
  });

  // ── Clone brush size ──
  document.getElementById('clone-brush').addEventListener('input', (e) => {
    document.getElementById('clone-brush-val').textContent = e.target.value;
    CloneTool.setBrushSize(e.target.value);
  });

  // 단일/그룹/다중선택 모두 처리하는 헬퍼
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

  // ── Color ──
  document.getElementById('color-picker').addEventListener('input', (e) => {
    const c = e.target.value;
    Tools.setColor(c);
    eachLeaf((child) => {
      if (child.type === 'image') return; // math-text/label은 SVG가 색 고정 — 건너뜀
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c, fill: c });
    });
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
  });

  // ── Dash pattern ──
  document.getElementById('dash-pattern').addEventListener('change', (e) => {
    Tools.setDashPattern(e.target.value);
    const pattern = e.target.value.split(',').map(Number);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.strokeDashArray) child.set({ strokeDashArray: pattern });
    });
  });

  // ── Opacity (영역 채우기에 반영) ──
  document.getElementById('opacity-input').addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('opacity-val').textContent = val + '%';
    Tools.setFillOpacity(val);
    const active = canvas.getActiveObject();
    if (active && active.type === 'polygon') {
      active.set({ opacity: val / 100 });
      canvas.renderAll();
    }
  });

  // ── Actions ──
  document.getElementById('btn-export').addEventListener('click', () => CanvasManager.exportPNG());
  document.getElementById('btn-export-svg').addEventListener('click', () => CanvasManager.exportSVG());
  document.getElementById('btn-save').addEventListener('click', () => CanvasManager.saveJSON());
  document.getElementById('btn-undo').addEventListener('click', () => CanvasManager.undo());
  document.getElementById('btn-redo').addEventListener('click', () => CanvasManager.redo());

  document.getElementById('btn-lock').addEventListener('click', () => {
    const locked = Tools.toggleLock();
    document.getElementById('btn-lock').textContent = locked ? '🔓 잠금해제' : '🔒 잠금';
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
    if (obj.type === 'activeSelection') {
      canvas.getActiveObjects().forEach(o => canvas.remove(o));
      canvas.discardActiveObject();
    } else {
      canvas.remove(obj);
    }
    canvas.renderAll();
  }

  document.getElementById('btn-delete').addEventListener('click', deleteActive);

  // ── 대칭 / 회전 ──
  function transformActive(fn) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    fn(obj);
    obj.setCoords();
    canvas.renderAll();
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

  function applyRotateDeg() {
    const deg = parseFloat(document.getElementById('rotate-deg-input').value) || 0;
    transformActive(obj => obj.set({ angle: ((obj.angle || 0) + deg) % 360 }));
  }

  document.getElementById('btn-rotate-deg').addEventListener('click', applyRotateDeg);
  document.getElementById('rotate-deg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyRotateDeg();
  });

  // ── Shortcut overlay ──
  document.getElementById('shortcut-close').addEventListener('click', () => {
    document.getElementById('shortcut-modal').classList.add('hidden');
  });

  // ── Graph modal — dropdown setup ──
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
    if (!def || !def.build) { customRow.classList.remove('hidden'); return; }
    customRow.classList.add('hidden');
    const row = document.createElement('div');
    row.className = 'modal-row';
    row.style.flexWrap = 'wrap';
    row.style.gap = '6px';
    def.params.forEach(({k, v, s}) => {
      const lbl  = document.createElement('label');
      lbl.textContent = k + ' =';
      lbl.style.cssText = 'white-space:nowrap;margin-right:2px';
      const inp  = document.createElement('input');
      inp.type   = 'number';
      inp.className = 'graph-param';
      inp.dataset.key = k;
      inp.value  = v;
      inp.step   = s;
      inp.style.width = '52px';
      row.appendChild(lbl);
      row.appendChild(inp);
    });
    area.appendChild(row);
  }

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

  // 초기 params area 생성 (기본 선택 함수)
  _updateGraphParamsArea(_graphFnSelect.value);
  _updateGraphPreview();

  // ── Graph modal — buttons ──
  document.getElementById('graph-ok').addEventListener('click', () => Tools.confirmGraph());
  document.getElementById('graph-cancel').addEventListener('click', () => Tools.cancelGraph());

  document.getElementById('graph-expr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });

  // ── Axis ratio modal ──
  document.getElementById('axis-ratio-ok').addEventListener('click', () => Tools.confirmAxisRatio());
  document.getElementById('axis-ratio-cancel').addEventListener('click', () => Tools.cancelAxisRatio());

  document.getElementById('axis-x-len').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAxisRatio();
    if (e.key === 'Escape') Tools.cancelAxisRatio();
  });
  document.getElementById('axis-y-len').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmAxisRatio();
    if (e.key === 'Escape') Tools.cancelAxisRatio();
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

  // ── Font size (in text modal) ──
  document.getElementById('font-size-input').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });

  // ── Copy / Paste ──
  let _clipboard = null;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      const active = canvas.getActiveObject();
      if (!active) return;
      active.clone((cloned) => { _clipboard = cloned; },
        ['_type', '_latex', '_axisData', '_isTempPreview']);
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
      }, ['_type', '_latex', '_axisData', '_isTempPreview']);
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

    const toolMap = { v: 'select', l: 'line', d: 'dashed-line', a: 'arrow', t: 'text', g: 'angle', f: 'bucket', r: 'arc-dim', x: 'axis', e: 'graph', o: 'circle', p: 'projection', c: 'clone' };
    const key = e.key.toLowerCase();

    if (toolMap[key] && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.querySelector(`.tool-btn[data-tool="${toolMap[key]}"]`);
      if (btn) btn.click();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      deleteActive();
    }

    // 화살표 키 — 선택 객체 이동 (Shift: 10px, 기본: 1px)
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

    if (e.key === 'Escape') {
      Tools.cancelText();
      Tools.cancelAngle();
      Tools.cancelAxisRatio();
      Tools.cancelGraph();
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
