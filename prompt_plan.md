# 구현 계획: 공유 점(vertex) 기반 작도 기능

> 작성일: 2026-06-24 (Wed) · 출처: `/grilling` → `/plan` (Plan 에이전트 + advisor 검토)
> 상태: **사용자 승인 대기 중** (승인 후 `/tdd` 착수)

## 0. 합의된 설계 (grilling 결과 — 변경 금지)

1. **공유 점(vertex) 모델**: 점을 1급 객체로. 끝점 자석 스냅 + 점 공유. 점 이동 시 연결된 선분 따라옴.
2. **적용 범위**: 기존 '점'·'선(L)' 도구를 점기반으로 **업그레이드**. 이미 그려둔 객체/좌표축(tools-axis)/함수그래프(tools-graph)는 **불가침**.
3. **작도 선 종류**: 선분 · 직선(무한) · 반직선 · 화살표/벡터 — 4종 전부.
4. **이번 사이클**: 연결·점작도까지만. 트레이싱(밑그림)은 다음 사이클.
5. **점 표시**: 작도점은 **전부 export에서 숨김**(화면 보조용). 결과물엔 선만.
6. **선 드래그**: **본체 끌면 양끝 vertex 따라 이동 + cascade**(지오지브라식). 이중이동 방지 가드 필수.

## 1. 핵심 아키텍처 결정

**연결 관계 = 객체에 박힌 직렬화 가능한 ID 속성. 조회는 on-demand 스캔.**

- 이유: undo/redo/저장이 전부 `canvas.toJSON(CUSTOM_PROPS)` → `loadFromJSON` 경로(canvas.js:46,122,140,153)를 통과하고, `loadFromJSON`은 매번 모든 fabric 객체를 파괴·재생성한다. 객체 참조나 ToolState 의존성 그래프는 즉시 깨진다.
- 선례: 좌표축 `_axisId`(tools-axis.js:5-7, canvas.js:7) 동일 패턴.
- 이점: 직렬화 round-trip 자동 복원, undo/redo 추가코드 0, 하위호환 자동(구버전 선분은 vertexId 없어 vertex 시스템에 invisible).

## 2. 데이터 모델

**점(vertex)** = `fabric.Circle`(buildPoint 재활용, tools-shape.js:92-104) + 커스텀 prop:
- `vertexId`: `vx-${Date.now()}-${random}` (tools-axis.js:148 패턴)
- `_type: 'vertex'`
- (참고) 점 전부 숨김 결정으로 `_vertexRole` 구분은 단순화 — export 시 모든 vertex 숨김

**선** = `fabric.Line`(선분/직선/반직선) 또는 `fabric.Path`(화살표) + prop:
- `_type: 'construct-line'`
- `startVertexId`, `endVertexId`
- `_lineKind: 'segment' | 'infinite' | 'ray' | 'arrow'`
- 렌더 지오메트리는 **두 vertex 좌표 + _lineKind + 캔버스 경계의 순수 파생값**

**조회** (영구 인덱스 금지):
```
connectedLines(vertexId) = getObjects().filter(o => o.startVertexId===id || o.endVertexId===id)
findVertex(id)           = getObjects().find(o => o.vertexId===id)
```

## 3. 단계별 구현 (파일 단위, 의존 순서)

| 단계 | 작업 | 파일 | 복잡도 | TDD |
|---|---|---|---|---|
| **1** | vertex 모델 + CUSTOM_PROPS 등록 + 순수 지오메트리 모듈(`resolveSnap`/`computeLineGeometry`/`connectedLines`, fabric·DOM 무관, immutable) | 신규 `js/tools-construct.js`, `js/canvas.js`(:7) | Med | **예** |
| **2** | '점' 도구 업그레이드: vertexId 부여 + 스냅 | `js/tools.js`(:163-167), `js/tools-shape.js`(:92), construct | Med | 부분 |
| **3** | '선' 도구 업그레이드: 4종 _lineKind, 끝점 vertex 생성/공유, 지오메트리 렌더 | `js/tools.js`(:291-304), `js/tools-shape.js`(buildLine/buildArrow), `index.html`/`js/app-toolbar.js`(옵션바) | High | 부분 |
| **4** | move-sync (드래그→키보드→멀티셀렉트→**본체 cascade**) | `js/tools-construct.js`, `js/tools.js`(:52-74), `js/app-keyboard.js`(:58-67) | **High** | 부분 |
| **5** | export/직렬화 하드닝(핸들·vertex 숨김) + 인스펙터 타입명 | `js/canvas.js`(:160,169), `js/app-inspector.js`(:17-22), `js/app-keyboard.js` | Med | 아니오 |

**로드 순서**: `tools-construct.js`는 `tools-shape.js`(index.html:585) 뒤, `app-ctx.js`(:586) 앞.

## 4. 핵심 순수 함수 (TDD 시드)

- `resolveSnap(pointer, vertices, gridCfg)`: vertex 스냅 > 그리드 스냅. 반경 = POLY_SNAP_RADIUS(18, tools-polygon.js:5). 스냅 대상 = 기존 vertex만(불가침 자동 보장).
- `computeLineGeometry(vA, vB, kind, bounds)`: segment=끝점 그대로 / ray=경계 교점 1 / infinite=경계 교점 2 / arrow=segment+화살촉(Path `d` 재생성).
- `connectedLines(vertexId)`: 조회.

## 5. advisor가 잡은 지뢰 (반드시 처리)

1. **키보드 nudge가 `object:moving` 우회** (app-keyboard.js:58-67이 left/top 직접 세팅) → nudge 후 sync 명시 호출.
2. **멀티셀렉트 이중이동**: vertex+연결선이 동시에 activeSelection이면 fabric이 bbox를 옮기는데 핸들러가 끝점도 옮겨 이중 변위 → 같은 selection 내 연결선은 끝점 재계산 skip.
3. **본체 cascade(사용자 결정)**: 선 본체 draggable. 본체 이동 시 양끝 vertex 이동 + 그 점들의 다른 연결선 갱신. **무한루프/이중이동 가드 필수**.
4. **export 누락**: `exportPNG`(canvas.js:160)·`exportSVG`(:169)에 임시객체 제외 처리 없음(`saveJSON`만 있음). 공통 헬퍼 추출해 vertex/핸들 숨김 적용.
5. **fabric.Line 끝점 변경 마찰**: `set({x1,y1,x2,y2})`만으론 left/top/bbox 재계산 불완전 → `set`+`setCoords`+`dirty:true` 조합을 경험적으로 검증 후 build.

## 6. 직렬화/하위호환

- CUSTOM_PROPS(canvas.js:7)에 추가: `vertexId`, `_vertexRole`, `startVertexId`, `endVertexId`, `_lineKind`
- 복원 로직 불필요(ID 스캔이므로 load 순서 무관).
- 구버전 .json 선분: vertexId 없음 → 평범한 fabric.Line으로 로드, 안 깨짐.

## 7. 선생님 규칙 준수

- **불변성**: 순수 함수는 입력으로부터 새 지오메트리 반환(원본 미변경).
- **800줄**: 신규 로직 전부 `tools-construct.js`로 분리. 순수 코어 / fabric 어댑터 분리 여지.
- **TDD**: resolveSnap·computeLineGeometry·connectedLines 3개 순수 함수가 canvas/DOM 없이 단위 테스트 가능.

## 8. 구현 중 짚을 미해결

- **보이는 꼭짓점 점**: 점 전부 숨김 결정으로, 결과물에 점을 보이려면 별도 수단 필요(예: 점 도구에 "표시용 점" 옵션, 또는 작도와 분리된 기존 점 도형 유지). 단계 5에서 결정.
