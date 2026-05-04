const MathTextTools = (() => {
  let labelMode = 'roman';
  const _labelValues = { roman: 'A', italic: 'l', greek: 'alpha' };
  const _GREEK_LETTERS = [
    'alpha','beta','gamma','delta','epsilon','zeta','eta','theta',
    'iota','kappa','lambda','mu','nu','xi','omicron','pi','rho',
    'sigma','tau','upsilon','phi','chi','psi','omega',
  ];
  const _GREEK_SYMBOL_MAP = {
    'α':'alpha','β':'beta','γ':'gamma','δ':'delta','ε':'epsilon','ζ':'zeta','η':'eta',
    'θ':'theta','ι':'iota','κ':'kappa','λ':'lambda','μ':'mu','ν':'nu','ξ':'xi',
    'ο':'omicron','π':'pi','ρ':'rho','σ':'sigma','τ':'tau','υ':'upsilon',
    'φ':'phi','χ':'chi','ψ':'psi','ω':'omega',
  };

  let textCallback = null;

  function _latexForLabel(mode, value) {
    if (mode === 'roman')  return `\\mathrm{${value}}`;
    if (mode === 'italic') return value;
    if (mode === 'greek')  return `\\${value}`;
    return value;
  }

  function _syncLabelUI() {
    const elVal  = document.getElementById('label-current');
    if (elVal)  elVal.value  = _labelValues[labelMode];
    const elMode = document.getElementById('label-mode-select');
    if (elMode) elMode.value = labelMode;
  }

  function _advanceLabel() {
    const cur = _labelValues[labelMode];
    if (labelMode === 'roman' && /^[A-Z]$/.test(cur)) {
      _labelValues.roman = cur === 'Z' ? 'A' : String.fromCharCode(cur.charCodeAt(0) + 1);
    } else if (labelMode === 'italic' && /^[a-z]$/.test(cur)) {
      _labelValues.italic = cur === 'z' ? 'a' : String.fromCharCode(cur.charCodeAt(0) + 1);
    } else if (labelMode === 'greek') {
      const idx = _GREEK_LETTERS.indexOf(cur);
      if (idx !== -1) _labelValues.greek = _GREEK_LETTERS[(idx + 1) % _GREEK_LETTERS.length];
    }
    _syncLabelUI();
  }

  function setLabelMode(mode) {
    if (!Object.prototype.hasOwnProperty.call(_labelValues, mode)) return;
    labelMode = mode;
    ToolState.labelMode = mode;
    _syncLabelUI();
  }

  function setLabelValue(v) {
    let val = (v || '').trim();
    if (!val) return;
    if (_GREEK_SYMBOL_MAP[val]) val = _GREEK_SYMBOL_MAP[val];
    if (_GREEK_LETTERS.includes(val)) {
      labelMode = 'greek';
    } else if (/^[A-Z]$/.test(val)) {
      labelMode = 'roman';
    } else if (/^[a-z]$/.test(val)) {
      labelMode = 'italic';
    }
    _labelValues[labelMode] = val;
    _syncLabelUI();
  }

  function getLabelMode()  { return labelMode; }
  function getLabelValue() { return _labelValues[labelMode]; }

  // Place a label at point p using the current mode/value, then advance
  function placeLabelAt(p) {
    const mode  = labelMode;
    const value = _labelValues[mode];
    const latex = _latexForLabel(mode, value);
    buildMathText(p, latex).then(img => {
      img._labelMode  = mode;
      img._labelValue = value;
      ToolState.canvas.add(img);
      ToolState.canvas.setActiveObject(img);
      ToolState.canvas.renderAll();
    });
    _advanceLabel();
  }

  function buildText(p, text) {
    const { fontSize, color } = ToolState;
    return new fabric.Text(text, {
      left: p.x, top: p.y,
      fontSize, fill: color,
      fontFamily: 'serif',
      fontStyle: 'italic',
      originX: 'center', originY: 'center',
      lockUniScaling: true,
    });
  }

  async function buildMathLabel(latex, left, top, size) {
    const { fontSize, color } = ToolState;
    const sz = size || fontSize;
    const fallback = () => new fabric.Text(latex, {
      left, top, fontSize: sz, fill: color,
      fontFamily: 'serif', fontStyle: 'italic',
      originX: 'center', originY: 'center', selectable: false,
    });
    if (!window.MathJax || !MathJax.startup) return fallback();
    try {
      await MathJax.startup.promise;
      const node = MathJax.tex2svg(latex, { display: false });
      const svg  = node && node.querySelector('svg');
      if (!svg) return fallback();
      const wEx = parseFloat(svg.getAttribute('width'))  || 2;
      const hEx = parseFloat(svg.getAttribute('height')) || 1;
      const h   = Math.max(sz * 1.3, 16);
      svg.setAttribute('width',  Math.round((wEx / hEx) * h));
      svg.setAttribute('height', Math.round(h));
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/xmlns:xlink="[^"]*"\s*/g, '');
      s = s.replace(/xlink:href/g, 'href');
      s = s.replace(/fill="currentColor"/g,   `fill="${color}"`);
      s = s.replace(/stroke="currentColor"/g, `stroke="${color}"`);
      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      return new Promise((resolve) => {
        fabric.Image.fromURL(dataUrl, (img) => {
          if (!img) { resolve(fallback()); return; }
          img.set({ left, top, originX: 'center', originY: 'center', selectable: false });
          img._type  = 'math-label';
          img._latex = latex;
          resolve(img);
        });
      });
    } catch (_) { return fallback(); }
  }

  async function buildMathText(p, latex) {
    const { fontSize, color } = ToolState;
    if (!window.MathJax || !MathJax.startup) return buildText(p, latex);
    try {
      await MathJax.startup.promise;
      const node = MathJax.tex2svg(latex, { display: false });
      const svg  = node && node.querySelector('svg');
      if (!svg) return buildText(p, latex);

      const wEx     = parseFloat(svg.getAttribute('width'))  || 2;
      const hEx     = parseFloat(svg.getAttribute('height')) || 1;
      const pxPerEx = Math.max(fontSize * 1.5, 20);
      svg.setAttribute('width',  Math.round(wEx * pxPerEx));
      svg.setAttribute('height', Math.round(hEx * pxPerEx));

      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/xmlns:xlink="[^"]*"\s*/g, '');
      s = s.replace(/xlink:href/g, 'href');
      s = s.replace(/fill="currentColor"/g,   `fill="${color}"`);
      s = s.replace(/stroke="currentColor"/g, `stroke="${color}"`);

      const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
      return new Promise((resolve) => {
        fabric.Image.fromURL(dataUrl, (img) => {
          if (img) {
            img.set({ left: p.x, top: p.y, originX: 'center', originY: 'center', lockUniScaling: true });
            img._type     = 'math-text';
            img._latex    = latex;
            img._fontSize = fontSize;
            resolve(img);
          } else {
            resolve(buildText(p, latex));
          }
        });
      });
    } catch (_) {
      return buildText(p, latex);
    }
  }

  async function rebuildMathTextSize(obj, newSize) {
    const sz = parseInt(newSize);
    if (!sz || sz < 1) return null;
    if (obj.type === 'i-text' || obj.type === 'text') {
      obj.set({ fontSize: sz });
      return obj;
    }
    if (obj._type !== 'math-text' || !obj._latex) return null;
    let absX = obj.left, absY = obj.top;
    if (obj.group) {
      const pt = fabric.util.transformPoint(
        { x: obj.left, y: obj.top },
        obj.group.calcTransformMatrix()
      );
      absX = pt.x; absY = pt.y;
    }
    const prevFontSize   = ToolState.fontSize;
    ToolState.fontSize   = sz;
    const rebuilt        = await buildMathText({ x: absX, y: absY }, obj._latex);
    ToolState.fontSize   = prevFontSize;
    rebuilt.set({ angle: obj.angle, scaleX: 1, scaleY: 1 });
    ToolState.canvas.remove(obj);
    ToolState.canvas.add(rebuilt);
    return rebuilt;
  }

  async function rebuildLabel(obj, mode, value) {
    if (!Object.prototype.hasOwnProperty.call(_labelValues, mode) || !value) return;
    const latex        = _latexForLabel(mode, value);
    const prevSz       = ToolState.fontSize;
    if (obj._fontSize) ToolState.fontSize = obj._fontSize;
    const newImg       = await buildMathText({ x: obj.left, y: obj.top }, latex);
    ToolState.fontSize = prevSz;
    newImg._labelMode  = mode;
    newImg._labelValue = value;
    newImg.set({ angle: obj.angle, scaleX: 1, scaleY: 1 });
    ToolState.canvas.remove(obj);
    ToolState.canvas.add(newImg);
    ToolState.canvas.setActiveObject(newImg);
    ToolState.canvas.renderAll();
  }

  function showTextModal(p, mode) {
    const modal    = document.getElementById('text-modal');
    const input    = document.getElementById('text-input');
    const titleMap = { 'arc-dim': '호 치수 입력', 'point': '점 라벨 입력' };
    document.getElementById('modal-title').textContent = titleMap[mode] || '텍스트 입력';
    input.value = '';
    modal.classList.remove('hidden');
    setTimeout(() => { input.focus(); input.dispatchEvent(new Event('input')); }, 50);

    textCallback = async (text) => {
      if (!text.trim()) return;
      if (mode === 'arc-dim') {
        const start = AnnotationTools.getPendingArcStart();
        const end   = AnnotationTools.getPendingArcEnd();
        if (start && end) {
          const obj = await AnnotationTools.buildArcDim(start, end, text);
          ToolState.canvas.add(obj);
          ToolState.canvas.renderAll();
          AnnotationTools.clearPendingArc();
          Tools.switchToSelect();
        }
      } else {
        const obj = await buildMathText(p, text);
        ToolState.canvas.add(obj);
        ToolState.canvas.renderAll();
        Tools.switchToSelect();
      }
    };
  }

  // Double-click edit: math-text object
  function openMathTextEdit(existing) {
    const modal = document.getElementById('text-modal');
    document.getElementById('modal-title').textContent = '수식 수정';
    const input = document.getElementById('text-input');
    input.value = existing._latex || '';
    modal.classList.remove('hidden');
    setTimeout(() => { input.select(); input.focus(); input.dispatchEvent(new Event('input')); }, 50);
    textCallback = async (newLatex) => {
      if (!newLatex.trim()) return;
      const newImg = await buildMathText({ x: existing.left, y: existing.top }, newLatex);
      ToolState.canvas.remove(existing);
      ToolState.canvas.add(newImg);
      ToolState.canvas.renderAll();
    };
  }

  // Double-click edit: arc-dim group label
  function openArcDimEdit(grp) {
    const labelObj = grp._objects.find(o => o._type === 'math-label' || o.type === 'text');
    const modal    = document.getElementById('text-modal');
    document.getElementById('modal-title').textContent = '호 치수 수정';
    const input = document.getElementById('text-input');
    input.value = labelObj ? (labelObj._latex || labelObj.text || '') : '';
    modal.classList.remove('hidden');
    setTimeout(() => { input.select(); input.focus(); input.dispatchEvent(new Event('input')); }, 50);
    textCallback = async (newLabel) => {
      if (!newLabel.trim()) return;
      const newLbl = await buildMathLabel(
        newLabel,
        labelObj ? labelObj.left : 0,
        labelObj ? labelObj.top  : 0
      );
      newLbl.angle = labelObj ? (labelObj.angle || 0) : 0;
      const idx    = grp._objects.indexOf(labelObj);
      if (idx !== -1) grp._objects[idx] = newLbl;
      else grp._objects.push(newLbl);
      grp.set({ dirty: true });
      ToolState.canvas.requestRenderAll();
    };
  }

  async function confirmText() {
    const text = document.getElementById('text-input').value;
    document.getElementById('text-modal').classList.add('hidden');
    if (textCallback) { await textCallback(text); textCallback = null; }
  }

  function cancelText() {
    document.getElementById('text-modal').classList.add('hidden');
    textCallback = null;
    AnnotationTools.clearPendingArc();
  }

  return {
    setLabelMode, setLabelValue, getLabelMode, getLabelValue,
    placeLabelAt,
    buildText, buildMathLabel, buildMathText,
    rebuildMathTextSize, rebuildLabel,
    showTextModal, openMathTextEdit, openArcDimEdit,
    confirmText, cancelText,
  };
})();
