// 스테이지 데이터 테이블 — 허브에서 선택해 개별 씬으로 입장하는 콘텐츠 단위.
// 새 스테이지를 추가하려면 이 배열에 항목 하나를 더하면 된다 (world.js에 씬 빌더 함수 추가 필요).
//
// 스토리: 폭주한 고대 룬 때문에 성 전체가 타락했다. 룬워커는 성 밖 정원에서 시작해 지하 →
// 무너진 외성벽 → 지하 감옥 → 성문 대성전 → 균열의 탑 → 가장 높은 첨탑 순으로 성 안쪽 깊숙이,
// 그리고 위로 올라가며 층마다 도사린 타락한 파수꾼들을 물리친다. order가 곧 그 층계 순서다.
import { REQUIRED_LEVEL } from './world.js';

export const STAGES = [
  {
    id: 'plains',
    name: '성 아래 정원',
    subtitle: '한때 룬워커들의 노랫소리가 끊이지 않던 곳',
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
    name: '무너진 지하 수로',
    subtitle: '정원 아래로 이어지는, 무너져 내린 성의 근간',
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
    name: '무너진 외성벽',
    subtitle: '룬의 폭주에 가장 먼저 무너진 첫 방어선',
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
    name: '타락한 지하 감옥',
    subtitle: '가장 깊은 곳까지 잠식된, 성의 가장 어두운 층',
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
    name: '성문 대성전 · 옛 옥좌',
    subtitle: '콜로세움을 지나야 열리는, 성 안으로 통하는 관문',
    order: 5,
    tier: 5,
    unlock: { minLevel: REQUIRED_LEVEL },
    // 이 스테이지는 기존 콜로세움+성 로직(world.js의 createWorld)을 그대로 재사용한다 —
    // 콜로세움 몬스터를 모두 처치해야 성 안의 최종보스에게 도전할 수 있는 기존 흐름 유지.
    // 이 대성전의 옥좌는 "그 위에 도사린" 진짜 폭주한 룬이 아니라 그 힘을 대리하던 파수꾼이라,
    // 처치해도 게임 전체의 승리 연출(ui.beginVictorySequence)은 뜨지 않고 일반 스테이지 클리어로 처리한다.
    legacyWorld: true,
    clearReward: { coins: 500 },
  },
  {
    id: 'rift',
    name: '균열의 탑 · 하층',
    subtitle: '대성전 위, 룬의 폭주가 새어 나온 첫 균열',
    order: 6,
    tier: 6,
    // 레벨이 아니라 '성문 대성전'을 클리어했는지로 잠금 해제 — 성문을 뚫은 뒤에야
    // 탑 안쪽 깊이 잠들어 있던 더 오래되고 강한 존재가 드러난다는 흐름
    unlock: { prevStageId: 'corrupt' },
    enemySpawns: [
      { pos: [14, -10], kind: 'golem' },
      { pos: [-16, 10], kind: 'golem' },
      { pos: [12, 14], kind: 'golem' },
      { pos: [-10, -16], kind: 'wraith' },
      { pos: [18, 4], kind: 'wraith' },
      { pos: [-18, -4], kind: 'wraith' },
    ],
    // 타락지대(콜로세움+성)와 같은 구조 — 선봉 보스 2기를 먼저 처치해야 요새 성벽이 걷히며
    // 최종보스(final: true)가 봉인 해제된다. main.js의 enterGenericStage가 이 플래그를 읽는다.
    bosses: [
      { kind: 'riftWarden', pos: [-9, -24] },
      { kind: 'riftDevourer', pos: [9, -24] },
      { kind: 'primordialDestroyer', pos: [0, -32], final: true },
    ],
    clearReward: { coins: 700 },
  },
  {
    id: 'frozenPeak',
    name: '가장 높은 첨탑 · 얼어붙은 정상',
    subtitle: '폭주한 룬 그 자체가 잠든, 성의 가장 높은 곳',
    order: 7,
    tier: 7,
    // 지금 기준으로는 게임의 진짜 마지막 스테이지 — finalStage:true인 스테이지의 최종보스를 잡으면
    // 일반 클리어 배너 대신 진짜 승리 연출(ui.beginVictorySequence)이 뜬다. 나중에 더 높은 층을
    // 추가하게 되면 이 플래그를 그 스테이지로 옮기면 된다.
    finalStage: true,
    // '균열의 탑'을 클리어한 룬워커가 더 높은 곳에서 새어 나오는 한기를 뒤쫓아 도달하는 탑의 정상
    unlock: { prevStageId: 'rift' },
    enemySpawns: [
      { pos: [14, -12], kind: 'golem' },
      { pos: [-16, 12], kind: 'golem' },
      { pos: [12, 16], kind: 'wraith' },
      { pos: [-12, -18], kind: 'wraith' },
      { pos: [20, 6], kind: 'spider' },
      { pos: [-20, -6], kind: 'spider' },
      { pos: [24, -14], kind: 'wraith' },
    ],
    // 타락지대 뒤로 갈수록 요새가 더 크고 견고해지는 흐름 — 선봉 보스 3기(스테이지가 하나 늘어난 만큼
    // +1)를 모두 처치해야 최종보스(final: true)가 봉인 해제된다
    bosses: [
      { kind: 'iceGiant', pos: [0, -20] },
      { kind: 'frostWarden', pos: [-10, -24] },
      { kind: 'glacierDevourer', pos: [10, -24] },
      { kind: 'frostSovereign', pos: [0, -32], final: true },
    ],
    clearReward: { coins: 950 },
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
