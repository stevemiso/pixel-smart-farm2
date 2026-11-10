# 🌱 픽셀 스마트팜 (Pixel Smart Farm)

통합과학 원리(양지·음지, 온실 효과)가 들어간 2D 픽셀 농사 게임.
외부 라이브러리 없이 순수 HTML + CSS + JavaScript로 만들어져서
GitHub Pages에 바로 올릴 수 있다.

## 게임 방법

1. **상점(E)**에서 씨앗을 산다 (등급이 높을수록 비싸고 판매가도 높다)
2. 씨앗을 선택하고 **밭 칸을 클릭**하거나 가까이 가서 **스페이스바**로 심는다
3. 시간이 지나면 작물이 자란다. 환경이 맞으면 100%, 안 맞으면 45% 속도
4. **물뿌리개**를 사서 작물에 물을 주면 30초간 성장 속도 1.5배
5. 다 자란 작물(✨ 표시)을 클릭해 수확하고 **가방(I)**에서 판다
6. 번 돈으로 더 좋은 씨앗과 **설비**(태양광 조명 / 암막 시트 / 온실)를 사서 성장 속도를 올린다

### 조작

| 조작 | 키 |
| --- | --- |
| 이동 | 방향키 / WASD |
| 심기·수확·설치 | 밭 클릭 또는 스페이스바 |
| 아이템 선택 | 하단 핫바 클릭 또는 숫자키 1~9 |
| 상점 / 가방 / 도감 | E / I / G (또는 상단 버튼) |

### 통합과학 원리

- **양지 작물**: 충분한 빛이 있어야 광합성이 활발 → 태양광 조명 설치
- **음지 작물**: 강한 빛에서 증산 과다로 수분 손실 → 암막 시트 설치
- **따뜻한 작물**: 온실의 유리/비닐이 햇빛은 통과시키고 적외선 복사열은 가둠(온실 효과) → 온실 설치
- **서늘한 작물**: 온실 안에서는 오히려 스트레스(속도 60%)
- **물주기**: 물은 광합성의 원료이고 증산 작용으로 영양분을 운반한다. 물을 주면 30초간 속도 1.5배
- 환경이 안 맞아도 작물은 자라지만 속도가 45%로 느려진다

## 파일 구조

```
pixel-smart-farm/
├── index.html      # 화면 구조 (HUD, 상점, 가방, 도감 모달)
├── css/style.css   # 픽셀 감성 UI 스타일
├── js/data.js      # 씨앗 10종 + 설비 3종 데이터와 과학 설명
└── js/game.js      # 게임 엔진 (캔버스 렌더링, 성장 로직, 상호작용)
```

## GitHub Pages로 배포하기

1. [GitHub](https://github.com)에서 **New repository**로 `pixel-smart-farm` 저장소를 만든다
   (Public으로 만들어야 무료 배포가 된다)
2. 이 폴더의 파일 전체를 저장소에 올린다:

   ```bash
   git init
   git add .
   git commit -m "픽셀 스마트팜 게임 초기 버전"
   git branch -M main
   git remote add origin https://github.com/사용자이름/pixel-smart-farm.git
   git push -u origin main
   ```

   또는 GitHub 사이트에서 **uploading an existing file** 링크로 파일을 직접 올려도 된다.

3. 저장소 페이지에서 **Settings → Pages** 메뉴로 이동
4. **Build and deployment** 항목에서:
   - Source: **Deploy from a branch**
   - Branch: **main**, 폴더: **/(root)** 선택 후 Save
5. 1~2분 기다리면 상단에 `https://사용자이름.github.io/pixel-smart-farm/` 주소가 생성된다

## 코드 수정 팁

- 작물 추가/밸런스 조절: `js/data.js`의 `CROPS` 배열 수정
- 성장 속도 공식: `js/data.js`의 `envMultiplier()` 함수
- 새 작물 그림: `js/game.js`의 `drawCrop()`의 `shape` 종류 참고
- 게임 시간을 빠르게: `CROPS`의 `growTime` 값을 줄이기

## 라이선스

자유롭게 수정하고 배포해도 됩니다. (MIT)
