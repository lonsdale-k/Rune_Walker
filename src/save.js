import { supabase } from './supabaseClient.js';

const TABLE = 'player_saves';

export async function loadSave(userId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    // 테이블 미생성 등 저장소 문제로 게임 시작 자체가 막히지 않도록 새 캐릭터로 진행
    console.error('저장 데이터 불러오기 실패:', error.message);
    return null;
  }
  return data;
}

export async function saveProgress(userId, { level, xp, xpToNext, baseMaxHp, skillPoints, allocatedSkills }) {
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    level,
    xp,
    xp_to_next: xpToNext,
    base_max_hp: baseMaxHp,
    skill_points: skillPoints,
    allocated_skills: allocatedSkills,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('진행 상황 저장 실패:', error.message);
}
