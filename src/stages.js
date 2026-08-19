// 스테이지 데이터 테이블 — 허브에서 선택해 개별 씬으로 입장하는 콘텐츠 단위.
// 새 스테이지를 추가하려면 이 배열에 항목 하나를 더하면 된다 (world.js에 씬 빌더 함수 추가 필요).
import { REQUIRED_LEVEL } from './world.js';

export const STAGES = [
  {
    id: 'plains',
    name: '초원',
    order: 1,
    tier: 1, // equipment.js 드랍 테이블 등급 — 스테이지 난이도에 맞는 장비가 나오도록 함
    unlock: null, // 항상 열려있음
    enemySpawns: [
      { pos: [10, -10], kind: 'hound' },
      { pos: [-14, 6], kind: 'hound' },
      { pos: [18, 14], kind: 'bat' },
      { pos: [-16, -18], kind: 'boar' },
      { pos: [24, -6], kind: 'vine' },
      { pos: [8, 22], kind: 'bat' },
      { pos: [-30, 20], kind: 'hound' },
    ],
    bosses: [{ kind: 'plainsWarden', pos: [0, -32] }],
    clearReward: { coins: 40 },
  },
  {
    id: 'cave',
    name: '동굴',
    order: 2,
    tier: 2,
    unlock: { minLevel: 6 },
    enemySpawns: [
      { pos: [12, -8], kind: 'spider' },
      { pos: [-10, 12], kind: 'spider' },
      { pos: [16, 14], kind: 'wraith' },
      { pos: [-18, -10], kind: 'wraith' },
      { pos: [6, 20], kind: 'spider' },
      { pos: [-22, 6], kind: 'spider' },
    ],
    bosses: [{ kind: 'caveTyrant', pos: [0, -28] }],
    clearReward: { coins: 90 },
  },
  {
    id: 'ruins',
    name: '폐허',
    order: 3,
    tier: 3,
    unlock: { minLevel: 10 },
    enemySpawns: [
      { pos: [12, -10], kind: 'golem' },
      { pos: [-14, 8], kind: 'golem' },
      { pos: [18, 12], kind: 'wraith' },
      { pos: [-16, -14], kind: 'wraith' },
      { pos: [6, 20], kind: 'vine' },
      { pos: [-22, -4], kind: 'vine' },
      { pos: [22, -18], kind: 'spider' },
    ],
    bosses: [{ kind: 'ruinsWarden', pos: [0, -34] }],
    clearReward: { coins: 170 },
  },
  {
    id: 'abyss',
    name: '심연',
    order: 4,
    tier: 4,
    unlock: { minLevel: 14 },
    enemySpawns: [
      { pos: [14, -10], kind: 'golem' },
      { pos: [-16, 10], kind: 'golem' },
      { pos: [10, 16], kind: 'wraith' },
      { pos: [-12, -16], kind: 'wraith' },
      { pos: [20, 6], kind: 'wraith' },
      { pos: [-20, -6], kind: 'spider' },
      { pos: [6, -20], kind: 'spider' },
      { pos: [-8, 20], kind: 'bat' },
    ],
    bosses: [{ kind: 'abyssTyrant', pos: [0, -30] }],
    clearReward: { coins: 280 },
  },
  {
    id: 'corrupt',
    name: '타락지대 · 성',
    order: 5,
    tier: 5,
    unlock: { minLevel: REQUIRED_LEVEL },
    // 이 스테이지는 기존 콜로세움+성 로직(world.js의 createWorld)을 그대로 재사용한다 —
    // 콜로세움 몬스터를 모두 처치해야 성 안의 최종보스에게 도전할 수 있는 기존 흐름 유지.
    legacyWorld: true,
    clearReward: { coins: 500 },
  },
  {
    id: 'rift',
    name: '태초의 균열',
    order: 6,
    tier: 6,
    // 레벨이 아니라 '타락지대·성'을 클리어했는지로 잠금 해제 — 세상을 정화한 뒤에야
    // 그 아래 잠들어 있던 더 오래되고 강한 존재가 드러난다는 흐름
    unlock: { prevStageId: 'corrupt' },
    enemySpawns: [
      { pos: [14, -10], kind: 'golem' },
      { pos: [-16, 10], kind: 'golem' },
      { pos: [12, 14], kind: 'golem' },
      { pos: [-10, -16], kind: 'wraith' },
      { pos: [18, 4], kind: 'wraith' },
      { pos: [-18, -4], kind: 'wraith' },
    ],
    bosses: [{ kind: 'primordialDestroyer', pos: [0, -34] }],
    clearReward: { coins: 700 },
  },
];

export function getStage(id) {
  return STAGES.find((s) => s.id === id);
}

// 스테이지 잠금 해제 여부 — 레벨 요구치 또는 이전 스테이지 클리어 여부로 판단
export function isStageUnlocked(stage, { level, clearedStages }) {
  if (!stage.unlock) return true;
  if (stage.unlock.minLevel != null) return level >= stage.unlock.minLevel;
  if (stage.unlock.prevStageId) return clearedStages.includes(stage.unlock.prevStageId);
  return true;
}
