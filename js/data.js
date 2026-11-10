/* ============================================================
   픽셀 스마트팜 — 게임 데이터
   씨앗 10종 (등급 5단계 × 2종), 설비 3종, 과학 설명 포함
   ============================================================ */

// 등급 정보 (색상은 UI에서 함께 사용)
const RARITIES = {
  common:    { key: 'common',    name: '커먼',  color: '#b8c4b8', order: 0 },
  uncommon:  { key: 'uncommon',  name: '언커먼', color: '#6ecf6e', order: 1 },
  rare:      { key: 'rare',      name: '레어',   color: '#5aa9f5', order: 2 },
  epic:      { key: 'epic',      name: '에픽',   color: '#c07ef2', order: 3 },
  legendary: { key: 'legendary', name: '레전더리', color: '#f5c542', order: 4 },
};

// light: 'sun'(양지) / 'shade'(음지)
// temp : 'warm'(따뜻함 필요) / 'cool'(서늘함 선호)
// shape: 그리기 방식 ('leafy' 잎채소, 'root' 뿌리채소, 'bush' 관목, 'vine' 덩굴, 'cactus' 선인장)
const CROPS = [
  {
    id: 'lettuce', name: '상추', rarity: 'common',
    seedPrice: 10, sellPrice: 28, growTime: 2,
    light: 'shade', temp: 'cool', shape: 'leafy',
    colors: { leaf: '#57b85a', leaf2: '#3d9444', accent: '#a8e06a' },
    desc: '서늘하고 그늘진 환경을 좋아하는 잎채소. 빠르게 자라 입문용으로 좋다.',
    science: '상추는 얇은 잎으로 강한 햇빛을 받으면 기공이 과하게 열려 수분을 잃는다(증산 작용). 암막으로 빛을 줄이고 서늘하게 유지하면 잎이 싱싱하게 자란다.',
  },
  {
    id: 'carrot', name: '당근', rarity: 'common',
    seedPrice: 12, sellPrice: 33, growTime: 2.5,
    light: 'sun', temp: 'cool', shape: 'root',
    colors: { leaf: '#4aa84f', leaf2: '#357f3c', accent: '#f08a3c' },
    desc: '햇빛을 좋아하는 뿌리채소. 서늘한 기후에서 잘 자란다.',
    science: '당근의 뿌리는 저장 양분을 쌓는 곳. 잎이 충분한 햇빛을 받아 광합성을 해야 뿌리로 보내는 당분이 많아진다.',
  },
  {
    id: 'spinach', name: '시금치', rarity: 'uncommon',
    seedPrice: 40, sellPrice: 108, growTime: 4,
    light: 'shade', temp: 'cool', shape: 'leafy',
    colors: { leaf: '#3f9e58', leaf2: '#2c7440', accent: '#8bd46a' },
    desc: '그늘과 서늘함을 좋아하는 웰빙 채소. 가을 작물의 대표주자.',
    science: '시금치는 찬바람이 부는 서늘한 계절에 심는 작물이다. 기온이 올라가면 꽃대가 빨리 올라와(추대) 잎이 딱딱해진다.',
  },
  {
    id: 'potato', name: '감자', rarity: 'uncommon',
    seedPrice: 45, sellPrice: 120, growTime: 4.5,
    light: 'sun', temp: 'cool', shape: 'root',
    colors: { leaf: '#5faf55', leaf2: '#44823f', accent: '#d9b36a' },
    desc: '햇빛 아래 서늘하게 기르는 뿌리채소. 다재다능한 주식 작물.',
    science: '감자는 줄기(땅속 덩이줄기)에 전분을 저장한다. 낮에는 잎의 광합성으로 만든 당분이 밤에 뿌리로 이동해 전분으로 바뀐다.',
  },
  {
    id: 'tomato', name: '토마토', rarity: 'rare',
    seedPrice: 150, sellPrice: 420, growTime: 9,
    light: 'sun', temp: 'warm', shape: 'bush',
    colors: { leaf: '#4c9e4c', leaf2: '#387738', accent: '#e8483f' },
    desc: '따뜻함과 강한 햇빛을 모두 좋아하는 대표 여름 작물.',
    science: '토마토는 고온 작물로 생육 적온이 20~27도다. 온실의 유리나 비닐은 햇빛(가시광선)은 통과시키고 지표에서 나오는 적외선 복사열은 가둬 온실 효과로 내부를 따뜻하게 유지한다.',
  },
  {
    id: 'strawberry', name: '딸기', rarity: 'rare',
    seedPrice: 160, sellPrice: 450, growTime: 10,
    light: 'shade', temp: 'warm', shape: 'bush',
    colors: { leaf: '#52a85e', leaf2: '#3a7d46', accent: '#f2557d' },
    desc: '따뜻하지만 직사광선은 싫어하는 까다로운 과일. 온실 + 암막 조합이 필요하다.',
    science: '딸기는 반그늘 환경을 좋아한다. 강한 직사광선은 잎과 열매의 온도를 올려 오히려 광합성 효율을 떨어뜨린다. 온실로 겨울 철밤 온도를 유지하는 것이 핵심.',
  },
  {
    id: 'chili', name: '고추', rarity: 'epic',
    seedPrice: 500, sellPrice: 1420, growTime: 18,
    light: 'sun', temp: 'warm', shape: 'bush',
    colors: { leaf: '#479a4a', leaf2: '#336f38', accent: '#d43a2f' },
    desc: '뜨거운 태양과 따뜻한 온실을 좋아하는 매운 작물. 값이 높다.',
    science: '고추의 매운맛(캡사이신)은 강한 자외선과 고온 스트레스에 대응해 더 많이 만들어진다. 태양광 조명 + 온실 환경은 고추에게 최적 조건이다.',
  },
  {
    id: 'blueberry', name: '블루베리', rarity: 'epic',
    seedPrice: 550, sellPrice: 1560, growTime: 19,
    light: 'shade', temp: 'cool', shape: 'bush',
    colors: { leaf: '#4f9c63', leaf2: '#387148', accent: '#5a6fd6' },
    desc: '그늘진 서늘한 곳의 고급 과일. 암막 설비가 필수다.',
    science: '블루베리의 보라색(안토시아닌)은 강한 햇빛에 대한 방어 물질이다. 지나친 직사광선보다 서늘한 반그늘에서 열매 품질이 좋아진다.',
  },
  {
    id: 'watermelon', name: '수박', rarity: 'legendary',
    seedPrice: 1800, sellPrice: 5300, growTime: 36,
    light: 'sun', temp: 'warm', shape: 'vine',
    colors: { leaf: '#3f9a4d', leaf2: '#2c7138', accent: '#2f9e44' },
    desc: '강한 햇볕과 더위를 사랑하는 여름의 왕. 최고급 작물.',
    science: '수박은 90% 이상이 물이다. 잎의 넓은 표면은 강한 태양광에서 활발한 광합성을 하고, 뜨거운 환경에서 뿌리가 깊이 물을 흡수해 열매에 저장한다.',
  },
  {
    id: 'dragonfruit', name: '용과', rarity: 'legendary',
    seedPrice: 2000, sellPrice: 5900, growTime: 38,
    light: 'shade', temp: 'warm', shape: 'cactus',
    colors: { leaf: '#57a05c', leaf2: '#3d7842', accent: '#f2557d' },
    desc: '따뜻한 온실 + 암막이라는 특별한 환경이 필요한 최고 등급 작물.',
    science: '용과는 열대 선인장의 열매다. 원래 반건조 그늘 숲에서 자라므로 강한 직사광선보다 따뜻하고 부드러운 빛을 좋아한다. 줄기는 수분을 저장하는 다육 조직으로 되어 있다.',
  },
];

// 물주기 설정: 물을 준 밭은 duration초 동안 성장 속도 boost배
const WATER = { duration: 30, boost: 1.5 };

// 설비 (밭 한 칸에 설치, 교체 가능)
const FACILITIES = {
  sunLight: {
    id: 'sunLight', name: '태양광 조명', price: 300,
    icon: '☀', color: '#ffd94a',
    desc: '밭 한 칸에 강한 인공 조명을 설치한다.',
    science: '양지 작물은 충분한 빛 에너지를 받아야 광합성이 활발해진다. 태양광 조명은 빛 에너지(광량자속)를 공급해 양지 작물의 성장 속도를 100%로 끌어올린다.',
    effectText: '양지 작물 속도 100% (미설치 시 45%)',
  },
  shadeSheet: {
    id: 'shadeSheet', name: '암막 시트', price: 300,
    icon: '🌑', color: '#8b7fd4',
    desc: '밭 한 칸을 차광막으로 덮어 빛을 약하게 만든다.',
    science: '음지 작물은 강한 빛에서 잎이 데거나 수분이 지나치게 증발한다(증산 작용). 암막 시트는 광합성에 필요한 만큼의 빛만 통과시켜 음지 작물을 보호한다.',
    effectText: '음지 작물 속도 100% (미설치 시 45%)',
  },
  greenhouse: {
    id: 'greenhouse', name: '온실', price: 500,
    icon: '🏡', color: '#7fd4e0',
    desc: '밭 한 칸을 투명 재질로 덮어 따뜻하게 유지한다.',
    science: '온실의 투명 지붕은 짧은 파장의 햇빛은 통과시키지만, 지면에서 다시 나오는 긴 파장의 적외선 복사열은 밖으로 내보내지 못해 내부 기온이 올라간다(온실 효과). 따뜻한 작물에 필수!',
    effectText: '따뜻한 작물 속도 100% (미설치 시 45%) / 서늘한 작물은 60%로 느려짐',
  },
  wateringCan: {
    id: 'wateringCan', name: '물뿌리개', price: 300, isTool: true,
    icon: '💧', color: '#5ab8f0',
    desc: '작물에 물을 주면 30초 동안 성장 속도가 1.5배 빨라진다. 한 번만 구매하면 계속 쓸 수 있는 도구.',
    science: '물은 광합성의 원료다. 뿌리가 빨아들인 물은 줄기를 타고 잎까지 올라가고, 증산 작용이 물을 끌어올리는 힘이 되어 영양분도 함께 운반된다. 물이 부족하면 잎의 기공이 닫혀 이산화 탄소가 들어오지 못해 광합성이 느려진다.',
    effectText: '물을 준 밭은 30초간 성장 속도 1.5배 (환경 보너스와 곱해짐)',
  },
};

// 환경 배율 계산
// 빛: 작물이 양지면 태양광 필요, 음지면 암막 필요 (없으면 0.45)
// 온도: 작물이 따뜻하면 온실 필요 (없으면 0.45), 서늘하면 온실이 있으면 오히려 0.6
function envMultiplier(crop, facilityId) {
  let lightFactor;
  if (crop.light === 'sun') lightFactor = facilityId === 'sunLight' ? 1 : 0.45;
  else lightFactor = facilityId === 'shadeSheet' ? 1 : 0.45;

  let tempFactor;
  if (crop.temp === 'warm') tempFactor = facilityId === 'greenhouse' ? 1 : 0.45;
  else tempFactor = facilityId === 'greenhouse' ? 0.6 : 1;

  return lightFactor * tempFactor;
}

const LIGHT_LABEL = { sun: '양지 ☀', shade: '음지 🌑' };
const TEMP_LABEL = { warm: '따뜻함 🔥', cool: '서늘함 ❄' };
