// 스킬 트리 데이터: 전투 역할별 4개 갈래. 갈래당 6개 노드(패시브 5개 -> 액티브 1개)였던 Phase 2
// 구성에, 얼어붙은 봉우리 이후의 고난도 콘텐츠에 대응할 수 있도록 액티브 위에 상급 패시브 2개를
// 더 얹었다(7·8티어) — 액티브 슬롯(Q/E/Space/R)은 이미 다 찼으므로 최상위 노드는 패시브로만 확장.
export const SKILL_TREE = {
  attack: {
    label: '공격',
    nodes: [
      { id: 'attack_1', tier: 1, name: '단련된 힘', desc: '공격력 +15%' },
      { id: 'attack_2', tier: 2, name: '매서운 일격', desc: '치명타 확률 +12%' },
      { id: 'attack_3', tier: 3, name: '치명의 급소', desc: '치명타 피해량 +40%' },
      { id: 'attack_4', tier: 4, name: '무자비함', desc: '공격력 +15%' },
      { id: 'attack_5', tier: 5, name: '처형자의 감각', desc: '치명타 확률 +12%' },
      { id: 'attack_6', tier: 6, name: '강타', desc: '액티브(Q) — 강력한 일격, 기본 피해의 2.5배', active: true, key: 'KeyQ', cooldown: 4 },
      { id: 'attack_7', tier: 7, name: '달인의 검술', desc: '공격력 +15%' },
      { id: 'attack_8', tier: 8, name: '필멸을 넘어서', desc: '치명타 피해량 +40%' },
    ],
  },
  defense: {
    label: '방어',
    nodes: [
      { id: 'defense_1', tier: 1, name: '두꺼운 가죽', desc: '최대 체력 +30' },
      { id: 'defense_2', tier: 2, name: '단단한 의지', desc: '받는 피해 -10%' },
      { id: 'defense_3', tier: 3, name: '민첩한 회피', desc: '회피율 +12%' },
      { id: 'defense_4', tier: 4, name: '재생의 룬', desc: '초당 체력 재생 +3' },
      { id: 'defense_5', tier: 5, name: '불굴의 심장', desc: '최대 체력 +50' },
      { id: 'defense_6', tier: 6, name: '방어막', desc: '액티브(E) — 5초간 피해 흡수막 생성', active: true, key: 'KeyE', cooldown: 8 },
      { id: 'defense_7', tier: 7, name: '룬의 보호막', desc: '받는 피해 -8%' },
      { id: 'defense_8', tier: 8, name: '영원한 심장', desc: '최대 체력 +70' },
    ],
  },
  mobility: {
    label: '기동',
    nodes: [
      { id: 'mobility_1', tier: 1, name: '가벼운 발걸음', desc: '이동 속도 +15%' },
      { id: 'mobility_2', tier: 2, name: '날쌘 손놀림', desc: '공격 재사용 대기시간 -15%' },
      { id: 'mobility_3', tier: 3, name: '숙련된 시전', desc: '모든 스킬 재사용 대기시간 -15%' },
      { id: 'mobility_4', tier: 4, name: '질풍의 다리', desc: '이동 속도 +15%' },
      { id: 'mobility_5', tier: 5, name: '잔상', desc: '대시 직후 0.35초간 무적' },
      { id: 'mobility_6', tier: 6, name: '대시', desc: '액티브(Space) — 짧은 순간 돌진', active: true, key: 'Space', cooldown: 3 },
      { id: 'mobility_7', tier: 7, name: '찰나의 틈', desc: '공격 재사용 대기시간 -10%' },
      { id: 'mobility_8', tier: 8, name: '바람의 가호', desc: '이동 속도 +10%' },
    ],
  },
  special: {
    label: '특수',
    nodes: [
      { id: 'special_1', tier: 1, name: '룬의 각인', desc: '공격 시 20% 확률로 화상(지속 피해) 부여' },
      { id: 'special_2', tier: 2, name: '냉기의 룬', desc: '공격 시 15% 확률로 대상 이동속도 감소(2초)' },
      { id: 'special_3', tier: 3, name: '번개의 룬', desc: '공격 시 10% 확률로 주변 적에게 번개 피해 전이' },
      { id: 'special_4', tier: 4, name: '원소 숙련', desc: '속성 피해량(화상/번개) +30%' },
      { id: 'special_5', tier: 5, name: '폭주의 룬', desc: '체력 30% 이하일 때 공격력 +25%' },
      { id: 'special_6', tier: 6, name: '화염 폭발', desc: '액티브(R) — 주변 범위 화염 피해', active: true, key: 'KeyR', cooldown: 10 },
      { id: 'special_7', tier: 7, name: '심화된 원소', desc: '속성 피해량(화상/번개) +20%' },
      { id: 'special_8', tier: 8, name: '룬워커의 각성', desc: '모든 스킬 재사용 대기시간 -10%' },
    ],
  },
};

export class SkillTreeState {
  constructor() {
    this.allocated = new Set();
    this.skillPoints = 2; // 시작 포인트 2개 지급 — 한 갈래의 패시브+액티브를 즉시 찍어 바로 스킬을 체험 가능하도록
  }

  hasNode(id) {
    return this.allocated.has(id);
  }

  canAllocate(branchKey, nodeId) {
    const branch = SKILL_TREE[branchKey];
    const node = branch.nodes.find((n) => n.id === nodeId);
    if (!node) return false;
    if (this.allocated.has(nodeId)) return false;
    if (this.skillPoints <= 0) return false;
    if (node.tier > 1) {
      const prevNode = branch.nodes.find((n) => n.tier === node.tier - 1);
      if (prevNode && !this.allocated.has(prevNode.id)) return false;
    }
    return true;
  }

  allocate(branchKey, nodeId) {
    if (!this.canAllocate(branchKey, nodeId)) return false;
    this.allocated.add(nodeId);
    this.skillPoints -= 1;
    return true;
  }

  respec() {
    const spent = this.allocated.size;
    this.allocated.clear();
    this.skillPoints += spent;
  }

  addSkillPoint() {
    this.skillPoints += 1;
  }

  // 저장된 진행 상황 복원 (Supabase player_saves 행)
  loadState(save) {
    this.allocated = new Set(save.allocated_skills ?? []);
    this.skillPoints = save.skill_points ?? 2;
  }
}
