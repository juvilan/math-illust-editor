function initToolbar(canvas) {
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
  AppCtx.eachLeaf = eachLeaf;

  function _updateToolOpts(tool) {
    document.querySelectorAll('#tool-options-bar .topt, #tool-options-bar .topt-sep').forEach(el => {
      const tools = el.dataset.tools ? el.dataset.tools.split(',') : [];
      el.classList.toggle('hidden', !tools.includes(tool));
    });
  }

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tool = btn.dataset.tool;
      Tools.setTool(tool);
      _updateToolOpts(tool);
    });
  });

  document.addEventListener('tool:switch', (e) => {
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.tool-btn[data-tool="${e.detail}"]`);
    if (btn) btn.classList.add('active');
    _updateToolOpts(e.detail);
  });

  _updateToolOpts('select');

  document.getElementById('color-picker').addEventListener('input', (e) => {
    const c = e.target.value;
    Tools.setColor(c);
    eachLeaf((child) => {
      if (child.type === 'image') return;
      if (child.type === 'text' || child.type === 'i-text') child.set({ fill: c });
      else child.set({ stroke: c });
    });
    document.getElementById('insp-stroke-color').value = c;
    CanvasManager.snapshot();
  });

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

  document.getElementById('arrow-style').addEventListener('change', (e) => Tools.setArrowStyle(e.target.value));
  document.getElementById('point-style').addEventListener('change', (e) => Tools.setPointStyle(e.target.value));

  document.getElementById('label-mode-select').addEventListener('change', (e) => {
    Tools.setLabelMode(e.target.value);
  });
  document.getElementById('label-current').addEventListener('input', (e) => {
    Tools.setLabelValue(e.target.value);
  });
  document.getElementById('label-current').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });
  document.getElementById('btn-label-reset').addEventListener('click', () => {
    const defaults = { roman: 'A', italic: 'l', greek: 'alpha' };
    Tools.setLabelValue(defaults[Tools.getLabelMode()] || 'A');
  });

  document.getElementById('cover-fill-color').addEventListener('input', (e) => {
    Tools.setCoverFillColor(e.target.value);
  });

  AppCtx.handleEyedropperClick = function(e) {
    AppCtx.eyedropperActive = false;
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
  };

  document.getElementById('cover-eyedropper-btn').addEventListener('click', () => {
    AppCtx.eyedropperActive = true;
    document.getElementById('cover-eyedropper-btn').style.outline = '2px solid var(--blue)';
    canvas.lowerCanvasEl.addEventListener('mousedown', AppCtx.handleEyedropperClick, { once: true, capture: true });
  });
}
