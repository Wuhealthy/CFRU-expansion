#ifndef BATTLE_RULE_ROULETTE_H
#define BATTLE_RULE_ROULETTE_H

//对战规则轮盘:训练家对战随机抽取特殊规则(设置菜单 VAR_BATTLE_RULE_ROULETTE 开启)
//A层规则直接写入 gBattleCircusFlags 并置 BATTLE_TYPE_ROULETTE,由 IS_BATTLE_CIRCUS 扩展消费
//B/C层规则位存 gBattleRouletteRules,由各战斗单点消费

#include "../constants/battle.h"

//B/C层轮盘规则位(与 BATTLE_CIRCUS_* 旗分属两个位空间)
#define ROULETTE_RULE_DOUBLE       (1 << 0) //双打对战
#define ROULETTE_RULE_INVERSE      (1 << 1) //逆属性对战
#define ROULETTE_RULE_MEGA_BRAWL   (1 << 2) //Mega大乱斗
#define ROULETTE_RULE_NO_ITEMS     (1 << 3) //裸装上阵(道具无效+不能Mega)
#define ROULETTE_RULE_NO_PRIORITY  (1 << 4) //优先度封禁(+1以上招式不可用)
#define ROULETTE_RULE_RING_BAN     (1 << 5) //属性封禁(随机禁1~3个属性)

extern u32 gBattleRouletteRules; //B/C层规则位(setup期抽取,战斗全程有效,战斗结束清零)

void RollTrainerBattleRules(void); //BattleSetup_StartTrainerBattle 调用:抽取规则并应用类型旗
void ApplyTrainerBattleRulesAtBattleStart(void); //战斗初始化调用:属性封禁类型/裸装道具清零
const u8* GetNextRouletteRuleAnnouncement(void); //BTSTART 播报状态逐条取规则名,取完返回 NULL
void ResetRouletteRuleAnnouncement(void); //播报索引复位(每次战斗开始时)
void ClearBattleRuleRoulette(void); //野战/战斗结束清规则

#endif
