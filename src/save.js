import { supabase } from './supabaseClient.js';

const TABLE = 'player_saves';
const LEADERBOARD_TABLE = 'leaderboard';

export async function loadSave(userId) {
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId).maybeSingle();
  if (error) {
    // 테이블 미생성 등 저장소 문제로 게임 시작 자체가 막히지 않도록 새 캐릭터로 진행
    console.error('저장 데이터 불러오기 실패:', error.message);
    return null;
  }
  return data;
}

export async function saveProgress(userId, {
  level, xp, xpToNext, baseMaxHp, skillPoints, allocatedSkills, defeatedBosses, colosseumCleared,
  coins, clearedStages, ownedCosmetics, equippedCosmetics, ownedGear, equippedGear,
  lastClaimDate, loginStreak, ownedPets, equippedPet, petLevels, petXp,
}) {
  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    level,
    xp,
    xp_to_next: xpToNext,
    base_max_hp: baseMaxHp,
    skill_points: skillPoints,
    allocated_skills: allocatedSkills,
    defeated_bosses: defeatedBosses,
    colosseum_cleared: colosseumCleared,
    coins,
    cleared_stages: clearedStages,
    owned_cosmetics: ownedCosmetics,
    equipped_cosmetics: equippedCosmetics,
    owned_gear: ownedGear,
    equipped_gear: equippedGear,
    last_claim_date: lastClaimDate,
    login_streak: loginStreak,
    owned_pets: ownedPets,
    equipped_pet: equippedPet,
    pet_levels: petLevels,
    pet_xp: petXp,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('진행 상황 저장 실패:', error.message);
}

// 명예의 전당(랭킹) — player_saves와 별개인 공개 테이블에 닉네임/레벨/코인만 올려 갱신한다.
// 실패해도 본 게임 진행(저장/플레이)에는 영향이 없어야 하므로 에러는 콘솔에만 남긴다.
export async function upsertLeaderboard(userId, { username, level, coins }) {
  const { error } = await supabase.from(LEADERBOARD_TABLE).upsert({
    user_id: userId,
    username,
    level,
    coins,
    updated_at: new Date().toISOString(),
  });
  if (error) console.error('랭킹 갱신 실패:', error.message);
}

export async function fetchLeaderboard(limit = 20) {
  const { data, error } = await supabase
    .from(LEADERBOARD_TABLE)
    .select('user_id, username, level, coins')
    .order('level', { ascending: false })
    .order('coins', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('랭킹 불러오기 실패:', error.message);
    return [];
  }
  return data ?? [];
}
