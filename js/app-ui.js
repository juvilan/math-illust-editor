function initUI() {
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

  const railEl = document.getElementById('tool-rail');
  const railHint = document.getElementById('rail-scroll-hint');
  function _updateRailHint() {
    const atBottom = railEl.scrollTop + railEl.clientHeight >= railEl.scrollHeight - 4;
    railHint.style.opacity = atBottom ? '0' : '1';
  }
  railEl.addEventListener('scroll', _updateRailHint, { passive: true });
  requestAnimationFrame(_updateRailHint);
}
