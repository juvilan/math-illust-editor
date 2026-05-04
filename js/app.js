document.addEventListener('DOMContentLoaded', () => {
  const canvas = CanvasManager.init();
  AppCtx.canvas = canvas;
  Tools.init(canvas);

  initIO(canvas);
  initUI();
  initToolbar(canvas);   // AppCtx.eachLeaf 설정
  initActions(canvas);   // AppCtx.deleteActive 설정
  initInspector(canvas); // AppCtx.syncInspector 설정
  initGraphModal();
  initTextModal();
  initKeyboard(canvas);
});
