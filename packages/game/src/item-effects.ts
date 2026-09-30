export type ItemEffectType =
  | "HEAL_HP"
  | "RESTORE_QI"
  | "RESTORE_ENERGY"
  | "GAIN_CULTIVATION"
  | "BREAKTHROUGH_BONUS"
  | "BUFF_STAT"
  | "CLEANSE"
  | "DEAL_DAMAGE"
  | "APPLY_SHIELD"
  | "APPLY_DEBUFF"
  | "ESCAPE"
  | "TELEPORT"
  | "BREAK_SEAL"
  | "CHANGE_APPEARANCE"
  | "DEPLOY_FORMATION"
  | "EQUIP_ITEM";

export type ItemTargetType = "SELF" | "ENEMY" | "LOCATION" | "SEAL" | "DESTINATION" | "NONE";
export type ItemConsumptionMode = "NONE" | "CONSUME_ONE" | "CONSUME_STACK" | "DEPLOY" | "EQUIP";
export type ItemActionKind = "NONE" | "USE" | "EQUIP" | "DEPLOY" | "BREAKTHROUGH" | "TARGETED";

export type ItemEffectSpec = {
  type: ItemEffectType;
  payload: Record<string, unknown>;
};

export type ItemUsageDefinition = {
  usable: boolean;
  action: ItemActionKind;
  combatUsable: boolean;
  outOfCombatUsable: boolean;
  targetType: ItemTargetType;
  consumptionMode: ItemConsumptionMode;
  cooldownSeconds: number;
  durationSeconds: number | null;
  charges: number | null;
  stackRule: "NONE" | "REFRESH_DURATION" | "REJECT" | "HIGHEST_ONLY" | "SAME_EFFECT_NOT_STACK";
  runtime: "ACTIVE" | "CONTEXT_LOCKED" | "CONFIG_ONLY";
  reason?: string;
  effects: ItemEffectSpec[];
};

export type ItemUsageTemplate = {
  key: string;
  category: string;
  equipSlot?: string | null;
  baseModifiers: unknown;
  bindRules?: unknown;
};

const day = 24 * 60 * 60;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function numberValue(value: Record<string, unknown>, key: string) {
  const raw = value[key];
  return typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
}

function boolValue(value: Record<string, unknown>, key: string) {
  return value[key] === true;
}

function baseDefinition(): ItemUsageDefinition {
  return {
    usable: false,
    action: "NONE",
    combatUsable: false,
    outOfCombatUsable: false,
    targetType: "NONE",
    consumptionMode: "NONE",
    cooldownSeconds: 0,
    durationSeconds: null,
    charges: null,
    stackRule: "NONE",
    runtime: "CONFIG_ONLY",
    effects: []
  };
}

function immediateSelf(effects: ItemEffectSpec[], options: Partial<ItemUsageDefinition> = {}): ItemUsageDefinition {
  return {
    ...baseDefinition(),
    usable: true,
    action: "USE",
    combatUsable: options.combatUsable ?? false,
    outOfCombatUsable: options.outOfCombatUsable ?? true,
    targetType: "SELF",
    consumptionMode: "CONSUME_ONE",
    runtime: "ACTIVE",
    stackRule: options.stackRule ?? "NONE",
    cooldownSeconds: options.cooldownSeconds ?? 0,
    durationSeconds: options.durationSeconds ?? null,
    effects
  };
}

function locked(reason: string, effects: ItemEffectSpec[], action: ItemActionKind = "TARGETED", options: Partial<ItemUsageDefinition> = {}): ItemUsageDefinition {
  return {
    ...baseDefinition(),
    usable: true,
    action,
    targetType: options.targetType ?? (action === "BREAKTHROUGH" ? "SELF" : "NONE"),
    consumptionMode: "CONSUME_ONE",
    combatUsable: options.combatUsable ?? false,
    outOfCombatUsable: options.outOfCombatUsable ?? false,
    runtime: "CONTEXT_LOCKED",
    reason,
    durationSeconds: options.durationSeconds ?? null,
    stackRule: options.stackRule ?? "NONE",
    effects
  };
}

function buff(effectType: string, value: Record<string, unknown>, durationSeconds: number, sourceKey: string): ItemEffectSpec {
  return { type: "BUFF_STAT", payload: { effectType, value, durationSeconds, sourceKey } };
}

function pillDefinition(template: ItemUsageTemplate, modifiers: Record<string, unknown>): ItemUsageDefinition | null {
  const effects: ItemEffectSpec[] = [];
  const hpRestore = numberValue(modifiers, "hpRestore");
  const hpRestorePct = numberValue(modifiers, "hpRestorePct");
  const qiRestore = numberValue(modifiers, "qiRestore");
  const qiRestorePct = numberValue(modifiers, "qiRestorePct");
  const energyRestore = numberValue(modifiers, "energyRestore");
  const energyRestorePct = numberValue(modifiers, "energyRestorePct");
  const cultivation = numberValue(modifiers, "cultivation");
  const breakthroughBps = numberValue(modifiers, "breakthroughBps");

  if (hpRestore > 0) effects.push({ type: "HEAL_HP", payload: { amount: hpRestore } });
  if (hpRestorePct > 0) effects.push({ type: "HEAL_HP", payload: { percent: hpRestorePct } });
  if (qiRestore > 0) effects.push({ type: "RESTORE_QI", payload: { amount: qiRestore } });
  if (qiRestorePct > 0) effects.push({ type: "RESTORE_QI", payload: { percent: qiRestorePct } });
  if (energyRestore > 0) effects.push({ type: "RESTORE_ENERGY", payload: { amount: energyRestore } });
  if (energyRestorePct > 0) effects.push({ type: "RESTORE_ENERGY", payload: { percent: energyRestorePct } });
  if (cultivation > 0) effects.push({ type: "GAIN_CULTIVATION", payload: { amount: cultivation } });
  if (breakthroughBps > 0) {
    return locked("Chỉ dùng trong lần đột phá, không dùng trực tiếp từ Túi Đồ.", [{ type: "BREAKTHROUGH_BONUS", payload: { bps: breakthroughBps } }], "BREAKTHROUGH");
  }
  if (boolValue(modifiers, "cleanseMental")) effects.push({ type: "CLEANSE", payload: { family: "MENTAL", maxGrade: 1 } });
  if (numberValue(modifiers, "spiritBps") > 0) effects.push(buff("SPIRIT_BPS", { spiritBps: numberValue(modifiers, "spiritBps") }, day, template.key));
  if (boolValue(modifiers, "foundationCleanse")) effects.push(buff("TRAINING_GAIN_BPS", { trainingGainBps: 1000 }, 7 * day, template.key));
  if (numberValue(modifiers, "insightBps") > 0) effects.push(buff("INSIGHT_BPS", { cultivationGainBps: numberValue(modifiers, "insightBps"), techniqueExpBps: numberValue(modifiers, "insightBps") }, 3 * day, template.key));
  if (numberValue(modifiers, "reviveGrade") > 0) {
    effects.push({ type: "HEAL_HP", payload: { percent: 100 } });
    effects.push({ type: "CLEANSE", payload: { family: "INJURY", maxGrade: 3 } });
    return immediateSelf(effects, { combatUsable: true, cooldownSeconds: day });
  }
  if (numberValue(modifiers, "fateGrade") > 0) {
    return locked("Đoạt Thiên Đan chỉ dùng trong lần đột phá, giảm tổn thất khi thất bại.", [{ type: "BREAKTHROUGH_BONUS", payload: { fateGrade: numberValue(modifiers, "fateGrade"), bps: 3000, failurePenaltyReductionBps: 5000 } }], "BREAKTHROUGH");
  }

  return effects.length > 0 ? immediateSelf(effects, { combatUsable: effects.some((effect) => effect.type === "HEAL_HP" || effect.type === "RESTORE_QI") }) : null;
}

function talismanDefinition(template: ItemUsageTemplate, modifiers: Record<string, unknown>): ItemUsageDefinition | null {
  const damageConfigs: Record<string, { element: "FIRE" | "LIGHTNING"; baseDamage: number; scaling: number; hitCount?: number; cooldownGroup?: string }> = {
    "hoa-cau-phu": { element: "FIRE", baseDamage: 60, scaling: 1.2 },
    "bao-viem-phu": { element: "FIRE", baseDamage: 150, scaling: 1.8 },
    "thien-loi-phu": { element: "LIGHTNING", baseDamage: 220, scaling: 2 },
    "ngu-loi-phu": { element: "LIGHTNING", baseDamage: 70, scaling: 0.55, hitCount: 5 },
    "thai-hu-loi-phu": { element: "LIGHTNING", baseDamage: 500, scaling: 3, cooldownGroup: "HIGH_TIER_COMBAT_TALISMAN" }
  };
  const damageConfig = damageConfigs[template.key];
  if (damageConfig) return locked("Cần mục tiêu trong chiến đấu.", [{ type: "DEAL_DAMAGE", payload: { ...damageConfig, scalingStat: "spirit", target: "SINGLE_ENEMY" } }], "TARGETED", { combatUsable: true, targetType: "ENEMY" });
  if (numberValue(modifiers, "fireDamage") > 0) return locked("Cần mục tiêu trong chiến đấu.", [{ type: "DEAL_DAMAGE", payload: { element: "FIRE", baseDamage: numberValue(modifiers, "fireDamage"), scalingStat: "spirit", scaling: 1, target: "SINGLE_ENEMY" } }], "TARGETED", { combatUsable: true, targetType: "ENEMY" });
  if (numberValue(modifiers, "lightningDamage") > 0) return locked("Cần mục tiêu trong chiến đấu.", [{ type: "DEAL_DAMAGE", payload: { element: "LIGHTNING", baseDamage: numberValue(modifiers, "lightningDamage"), scalingStat: "spirit", scaling: 1, target: "SINGLE_ENEMY" } }], "TARGETED", { combatUsable: true, targetType: "ENEMY" });
  if (numberValue(modifiers, "shield") > 0) return locked("Cần combat/self buff context để tạo hộ thuẫn.", [{ type: "APPLY_SHIELD", payload: { shield: numberValue(modifiers, "shield"), hpPercent: template.key === "van-pha-ho-than-phu" ? 50 : 10, spiritScaling: template.key === "van-pha-ho-than-phu" ? 0 : 2, durationTurns: template.key === "van-pha-ho-than-phu" ? 5 : 3, statusResistanceBps: template.key === "van-pha-ho-than-phu" ? 3000 : 0 } }], "TARGETED", { combatUsable: true, targetType: "SELF", stackRule: "HIGHEST_ONLY" });
  if (numberValue(modifiers, "speedBps") > 0) return immediateSelf([buff("SPEED_BPS", { speedBps: numberValue(modifiers, "speedBps") }, 30 * 60, template.key)], { combatUsable: true, stackRule: "REFRESH_DURATION" });
  if (numberValue(modifiers, "defenseBps") > 0) return locked("Cần combat context để nhận phòng ngự tạm thời.", [{ type: "BUFF_STAT", payload: { effectType: "DEFENSE_BPS", defenseBps: 2500, durationTurns: 5, sourceKey: template.key } }], "TARGETED", { combatUsable: true, targetType: "SELF", stackRule: "REFRESH_DURATION" });
  if (numberValue(modifiers, "resistEvilBps") > 0) return locked("Cần combat context để kháng trạng thái.", [{ type: "BUFF_STAT", payload: { effectType: "STATUS_RESISTANCE_BPS", statusResistanceBps: 3000, durationTurns: 5, sourceKey: template.key } }], "TARGETED", { combatUsable: true, targetType: "SELF", stackRule: "REFRESH_DURATION" });
  if (numberValue(modifiers, "escapeGrade") > 0) return locked("Chỉ dùng khi đang gặp encounter thường có thể thoát.", [{ type: "ESCAPE", payload: { grade: numberValue(modifiers, "escapeGrade") } }], "TARGETED", { combatUsable: true, targetType: "NONE" });
  if (numberValue(modifiers, "bindBps") > 0) return locked("Cần mục tiêu trong chiến đấu để phong cấm.", [{ type: "APPLY_DEBUFF", payload: { effectType: "SPEED_BPS", speedBps: -3000, durationTurns: 3 } }], "TARGETED", { combatUsable: true, targetType: "ENEMY", stackRule: "REFRESH_DURATION" });
  if (numberValue(modifiers, "breakSealGrade") > 0) return locked("Cần phong ấn/cấm chế hợp lệ tại location.", [{ type: "BREAK_SEAL", payload: { grade: numberValue(modifiers, "breakSealGrade") } }], "TARGETED", { targetType: "SEAL" });
  if (numberValue(modifiers, "teleportGrade") > 0) return locked("Cần chọn waypoint đã khám phá và hợp lệ.", [{ type: "TELEPORT", payload: { grade: numberValue(modifiers, "teleportGrade") } }], "TARGETED", { outOfCombatUsable: true, targetType: "DESTINATION" });
  if (boolValue(modifiers, "appearanceChange")) return locked("Dùng tại Cài Đặt để lựa chọn lại ngoại hình nhân vật.", [{ type: "CHANGE_APPEARANCE", payload: { context: "CHARACTER_APPEARANCE" } }], "TARGETED", { outOfCombatUsable: true, targetType: "SELF" });
  return null;
}

function formationDefinition(template: ItemUsageTemplate, modifiers: Record<string, unknown>): ItemUsageDefinition {
  return {
    ...baseDefinition(),
    usable: true,
    action: "DEPLOY",
    combatUsable: false,
    outOfCombatUsable: true,
    targetType: "LOCATION",
    consumptionMode: "DEPLOY",
    cooldownSeconds: 0,
    durationSeconds: null,
    stackRule: "SAME_EFFECT_NOT_STACK",
    runtime: "CONTEXT_LOCKED",
    reason: "Cần hệ triển khai trận pháp tại location hợp lệ.",
    effects: [{ type: "DEPLOY_FORMATION", payload: { formationKey: template.key, modifiers } }]
  };
}

export function getItemUsageDefinition(template: ItemUsageTemplate): ItemUsageDefinition {
  if (template.category === "EQUIPMENT") {
    return {
      ...baseDefinition(),
      usable: Boolean(template.equipSlot),
      action: Boolean(template.equipSlot) ? "EQUIP" : "NONE",
      targetType: "SELF",
      consumptionMode: "EQUIP",
      runtime: Boolean(template.equipSlot) ? "ACTIVE" : "CONFIG_ONLY",
      effects: Boolean(template.equipSlot) ? [{ type: "EQUIP_ITEM", payload: { slot: template.equipSlot } }] : []
    };
  }
  if (template.category !== "CONSUMABLE") return baseDefinition();
  const modifiers = record(template.baseModifiers);
  const bindRules = record(template.bindRules);
  const subType = typeof bindRules.subType === "string" ? bindRules.subType : "";
  if (subType === "Đan Dược") return pillDefinition(template, modifiers) ?? baseDefinition();
  if (subType === "Phù Lục") return talismanDefinition(template, modifiers) ?? baseDefinition();
  if (subType === "Trận Bàn") return formationDefinition(template, modifiers);
  return pillDefinition(template, modifiers) ?? baseDefinition();
}
