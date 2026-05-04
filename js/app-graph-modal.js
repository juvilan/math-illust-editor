function initGraphModal() {
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

    const margin = Math.abs(r.x2 - r.x1) * 0.7;
    const xMin = Math.min(r.x1, r.x2) - margin;
    const xMax = Math.max(r.x1, r.x2) + margin;
    document.getElementById('graph-xmin').value = parseFloat(xMin.toFixed(2));
    document.getElementById('graph-xmax').value = parseFloat(xMax.toFixed(2));

    const xscale = Math.round(Math.max(1, Math.min(500, 260 / (xMax - xMin))));
    document.getElementById('graph-scale').value = xscale;

    const ix = (r.x1 + r.x2) / 2;
    const iy = r.a * ix ** 3 + r.b * ix ** 2 + r.c * ix + r.d;
    document.getElementById('cubic-inflection-display').textContent =
      `(${parseFloat(ix.toFixed(3))}, ${parseFloat(iy.toFixed(3))})`;
    document.getElementById('cubic-inflection-row').style.display = '';

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
  document.getElementById('graph-expr').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') Tools.confirmGraph();
    if (e.key === 'Escape') Tools.cancelGraph();
  });

  document.getElementById('graph-ok').addEventListener('click', () => Tools.confirmGraph());
  document.getElementById('graph-cancel').addEventListener('click', () => Tools.cancelGraph());

  _updateGraphParamsArea(_graphFnSelect.value);
  _updateGraphPreview();
}
