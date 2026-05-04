function initTextModal() {
  document.getElementById('text-ok').addEventListener('click', () => Tools.confirmText());
  document.getElementById('text-cancel').addEventListener('click', () => Tools.cancelText());
  document.getElementById('text-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); Tools.confirmText(); }
    if (e.key === 'Escape') Tools.cancelText();
  });

  let _previewTimer = null;
  async function _updateFormulaPreview(latex) {
    const el = document.getElementById('formula-preview');
    if (!el) return;
    if (!latex || !latex.trim()) {
      el.innerHTML = '<span class="formula-placeholder">미리보기</span>';
      return;
    }
    if (!window.MathJax?.startup) {
      el.innerHTML = '<span class="formula-placeholder">로딩 중…</span>';
      return;
    }
    try {
      await MathJax.startup.promise;
      const node = MathJax.tex2svg(latex, { display: false });
      const svg = node?.querySelector('svg');
      if (!svg) throw new Error('no svg');
      const wEx = parseFloat(svg.getAttribute('width'))  || 4;
      const hEx = parseFloat(svg.getAttribute('height')) || 2;
      const pxPerEx = Math.min(60 / hEx, 360 / wEx);
      svg.setAttribute('width',  String(Math.round(wEx * pxPerEx)));
      svg.setAttribute('height', String(Math.round(hEx * pxPerEx)));
      let s = new XMLSerializer().serializeToString(svg);
      s = s.replace(/xmlns:xlink="[^"]*"\s*/g, '');
      s = s.replace(/xlink:href/g, 'href');
      s = s.replace(/fill="currentColor"/g, 'fill="#000000"');
      s = s.replace(/stroke="currentColor"/g, 'stroke="#000000"');
      el.innerHTML = s;
    } catch (_) {
      el.innerHTML = '<span style="color:#e74c3c;font-size:12px">수식 오류</span>';
    }
  }
  document.getElementById('text-input').addEventListener('input', (e) => {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(() => _updateFormulaPreview(e.target.value), 250);
  });

  const _LATEX_REF = {
    func: [
      {s:'sin',l:'\\sin',w:true},{s:'cos',l:'\\cos',w:true},{s:'tan',l:'\\tan',w:true},
      {s:'cot',l:'\\cot',w:true},{s:'sec',l:'\\sec',w:true},{s:'csc',l:'\\csc',w:true},
      {s:'arcsin',l:'\\arcsin',w:true},{s:'arccos',l:'\\arccos',w:true},{s:'arctan',l:'\\arctan',w:true},
      {s:'sinh',l:'\\sinh',w:true},{s:'cosh',l:'\\cosh',w:true},{s:'tanh',l:'\\tanh',w:true},
      {s:'log',l:'\\log',w:true},{s:'ln',l:'\\ln',w:true},{s:'exp',l:'\\exp',w:true},
      {s:'lim',l:'\\lim',w:true},{s:'max',l:'\\max',w:true},{s:'min',l:'\\min',w:true},
      {s:'sup',l:'\\sup',w:true},{s:'inf',l:'\\inf',w:true},{s:'det',l:'\\det',w:true},
      {s:'deg',l:'\\deg',w:true},{s:'gcd',l:'\\gcd',w:true},{s:'mod',l:'\\mod',w:true},
    ],
    frac: [
      {s:'a/b',l:'\\frac{a}{b}',w:true},{s:'√x',l:'\\sqrt{x}',w:true},{s:'ⁿ√x',l:'\\sqrt[n]{x}',w:true},
      {s:'x²',l:'x^{2}'},{s:'xⁿ',l:'x^{n}'},{s:'x⁻¹',l:'x^{-1}',w:true},{s:'xₙ',l:'x_{n}'},
      {s:'x^m_n',l:'x^{m}_{n}',w:true},{s:'|x|',l:'|x|'},{s:'‖x‖',l:'\\|x\\|',w:true},
      {s:'x̄',l:'\\overline{x}',w:true},{s:'x̂',l:'\\hat{x}',w:true},
      {s:'ẋ',l:'\\dot{x}',w:true},{s:'ẍ',l:'\\ddot{x}',w:true},
      {s:'x⃗',l:'\\vec{x}',w:true},{s:'⋯',l:'\\cdots'},{s:'⋮',l:'\\vdots'},{s:'⋱',l:'\\ddots'},
    ],
    ops: [
      {s:'±',l:'\\pm'},{s:'∓',l:'\\mp'},{s:'×',l:'\\times'},{s:'÷',l:'\\div'},
      {s:'·',l:'\\cdot'},{s:'∘',l:'\\circ'},{s:'≠',l:'\\neq'},{s:'≤',l:'\\leq'},
      {s:'≥',l:'\\geq'},{s:'≈',l:'\\approx'},{s:'≡',l:'\\equiv'},{s:'∼',l:'\\sim'},
      {s:'∝',l:'\\propto'},{s:'∂',l:'\\partial'},{s:'∇',l:'\\nabla'},
      {s:'∑',l:'\\sum'},{s:'∏',l:'\\prod'},{s:'∫',l:'\\int'},{s:'∮',l:'\\oint'},
      {s:'∵',l:'\\because'},{s:'∴',l:'\\therefore'},
      {s:'→',l:'\\to'},{s:'↔',l:'\\leftrightarrow'},{s:'⟹',l:'\\Rightarrow'},{s:'⟺',l:'\\Leftrightarrow'},
    ],
    sets: [
      {s:'∈',l:'\\in'},{s:'∉',l:'\\notin'},{s:'⊂',l:'\\subset'},{s:'⊃',l:'\\supset'},
      {s:'⊆',l:'\\subseteq'},{s:'⊇',l:'\\supseteq'},{s:'∪',l:'\\cup'},{s:'∩',l:'\\cap'},
      {s:'∅',l:'\\emptyset'},{s:'ℝ',l:'\\mathbb{R}'},{s:'ℤ',l:'\\mathbb{Z}'},
      {s:'ℕ',l:'\\mathbb{N}'},{s:'ℚ',l:'\\mathbb{Q}'},{s:'ℂ',l:'\\mathbb{C}'},
      {s:'∀',l:'\\forall'},{s:'∃',l:'\\exists'},{s:'¬',l:'\\neg'},
      {s:'∧',l:'\\wedge'},{s:'∨',l:'\\vee'},
    ],
    greek: [
      {s:'α',l:'\\alpha'},{s:'β',l:'\\beta'},{s:'γ',l:'\\gamma'},{s:'δ',l:'\\delta'},
      {s:'ε',l:'\\epsilon'},{s:'ζ',l:'\\zeta'},{s:'η',l:'\\eta'},{s:'θ',l:'\\theta'},
      {s:'ι',l:'\\iota'},{s:'κ',l:'\\kappa'},{s:'λ',l:'\\lambda'},{s:'μ',l:'\\mu'},
      {s:'ν',l:'\\nu'},{s:'ξ',l:'\\xi'},{s:'π',l:'\\pi'},{s:'ρ',l:'\\rho'},
      {s:'σ',l:'\\sigma'},{s:'τ',l:'\\tau'},{s:'υ',l:'\\upsilon'},{s:'φ',l:'\\phi'},
      {s:'χ',l:'\\chi'},{s:'ψ',l:'\\psi'},{s:'ω',l:'\\omega'},
      {s:'Γ',l:'\\Gamma'},{s:'Δ',l:'\\Delta'},{s:'Θ',l:'\\Theta'},{s:'Λ',l:'\\Lambda'},
      {s:'Ξ',l:'\\Xi'},{s:'Π',l:'\\Pi'},{s:'Σ',l:'\\Sigma'},{s:'Φ',l:'\\Phi'},
      {s:'Ψ',l:'\\Psi'},{s:'Ω',l:'\\Omega'},
    ],
    special: [
      {s:'∠',l:'\\angle'},{s:'△',l:'\\triangle'},{s:'□',l:'\\square'},{s:'○',l:'\\bigcirc'},
      {s:'∥',l:'\\parallel'},{s:'⊥',l:'\\perp'},{s:'≅',l:'\\cong'},
      {s:'AB⃗',l:'\\overrightarrow{AB}',w:true},{s:'AB̂',l:'\\widehat{AB}',w:true},
      {s:'AB̄',l:'\\overline{AB}',w:true},{s:'∞',l:'\\infty'},
      {s:'°',l:'^{\\circ}'},{s:'′',l:'^{\\prime}'},{s:'″',l:'^{\\prime\\prime}'},
      {s:'ℓ',l:'\\ell'},{s:'∎',l:'\\blacksquare'},{s:'…',l:'\\ldots'},
    ],
  };

  let _lrefCat = 'func';
  const _lrefGrid = document.getElementById('lref-grid');

  function _renderLrefGrid(cat) {
    _lrefGrid.innerHTML = '';
    (_LATEX_REF[cat] || []).forEach(item => {
      const btn = document.createElement('button');
      btn.className = 'lref-btn' + (item.w ? ' lref-wide' : '');
      btn.textContent = item.s;
      btn.title = item.l;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const inp = document.getElementById('text-input');
        const start = inp.selectionStart;
        const end   = inp.selectionEnd;
        inp.setRangeText(item.l, start, end, 'end');
        inp.focus();
      });
      _lrefGrid.appendChild(btn);
    });
  }

  document.getElementById('lref-cat-select').addEventListener('change', (e) => {
    _lrefCat = e.target.value;
    _renderLrefGrid(_lrefCat);
  });

  _renderLrefGrid(_lrefCat);

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

  document.getElementById('text-font-size').addEventListener('input', (e) => {
    document.getElementById('text-font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });

  document.getElementById('font-size-input').addEventListener('input', (e) => {
    document.getElementById('font-size-val').textContent = e.target.value;
    Tools.setFontSize(e.target.value);
  });
}
