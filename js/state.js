window.ToolState = {
  canvas: null,

  // Drawing options
  color: '#000000',
  strokeWidth: 2,
  fillOpacity: 0.3,
  fontSize: 18,
  dashPattern: [8, 6],
  lineStyle: 'solid',
  arrowStyle: 'none',
  pointStyle: 'closed',

  // Shape fill
  shapeFillEnabled: false,
  shapeFillColor: '#aaaaaa',

  // Stroke
  strokeEnabled: true,

  // Grid snap
  gridSnapEnabled: false,
  gridSize: 10,

  // Label
  labelMode: 'roman',
};

// ── 공유 유틸리티 (모든 도구 모듈에서 사용) ──
function _hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function _shapeFill() {
  const { shapeFillEnabled, shapeFillColor, fillOpacity } = ToolState;
  return shapeFillEnabled ? _hexToRgba(shapeFillColor, fillOpacity) : '';
}
function _strokeVal() {
  return ToolState.strokeEnabled ? ToolState.color : 'transparent';
}
function dist(a, b) {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}
