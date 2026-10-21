// 敵の作戦（ファイアーエムブレムのような増援・伏兵・第二形態・進軍）。戦場ごとに手で決める。
// 動かすのは board.js（setupTactics ほか）。序盤はひとつずつ、進むほど重ねる。序章と守り手の戦い、終章には置かない。
//   waves  ：[{ turn, from, units:[{ kind, n, lv }] }]  決まったターンの敵の手番に現れる。そのターンの初めに、現れる床を知らせる。
//            from は far（奥）/ flank（脇）/ rear（背後・アリアの近く）/ boss（核の周り）。lv を省くと、その戦場のふつうの敵と同じ強さ。
//   ambush ：[{ kind, n, near, lv }]  盤に隠れた伏兵。味方が near マス以内に近づくと姿を現し、近づいた味方の移動はそこで止まる。
//   second ：{ who, hp, atk, name, line, summon }  核（who:'boss'）や本陣の隊長（who:'captain'）が一度倒れると、第二形態で立ち上がる。
//   charge ：{ turn }  そのターンまで、敵は持ち場で待つ。そのターンの敵の手番から一斉に進軍する。
// 難易度：やさしいは増援と伏兵が一人ずつ少ない。ハードの増援は、現れたその手番から動く。
const Tactics = (() => {
  const W = (turn, from, ...units) => ({ turn, from, units });
  const U = (kind, n = 1, lv) => ({ kind, n, ...(lv ? { lv } : {}) });
  const A = (kind, n = 1, near = 2) => ({ kind, n, near });
  const core = (name, line, summon) => ({ who: 'boss', hp: 0.55, atk: 1.15, name, line, ...(summon ? { summon } : {}) });
  const TABLE = {
    // ---- 本編 ----
    gp_gran: { waves: [W(3, 'flank', U('shade', 2))] },
    gp_ivy: { ambush: [A('thorn', 2)] },
    gp_vard: { charge: { turn: 3 }, waves: [W(4, 'far', U('shade', 2))] },
    gp_spinel: { charge: { turn: 3 }, waves: [W(4, 'rear', U('lead'), U('shade'))] },
    gp_king: { ambush: [A('lead')], waves: [W(4, 'far', U('thorn', 2))] },
    gp_nephra: { ambush: [A('thorn', 1, 3)], waves: [W(3, 'flank', U('shade', 2)), W(5, 'rear', U('lead', 2))] },
    camp_valley: { ambush: [A('s_sword', 2)] },
    camp_town: { second: { who: 'captain', hp: 0.5, atk: 1.15, name: '黒の外套', line: '……まだ、門は閉じている' } },
    // ---- フリーステージ ----
    f_maze: { ambush: [A('thorn', 2)] },
    f_stars: { waves: [W(3, 'flank', U('shade', 2)), W(5, 'far', U('thorn', 2))] },
    f_void: { charge: { turn: 2 }, ambush: [A('lead', 2)] },
    // ---- 町の依頼 ----
    q_lantern: { waves: [W(3, 'far', U('shade', 2))] },
    q_tide: { waves: [W(3, 'flank', U('shade', 2)), W(5, 'far', U('shade', 2))] },
    q_clock: { charge: { turn: 3 } },
    q_orchard: { second: core('苦い殻を割った核', '苦い実の核が、黒い蔓をまとって起き上がった', { kind: 'thorn', n: 1 }) },
    q_thorns: { ambush: [A('thorn', 2)] },
    q_bloom: { charge: { turn: 3 }, ambush: [A('thorn')] },
    q_bridge: { second: core('鉛をまとった核', '核が、橋の鉛を吸い上げて立ち上がった'), waves: [W(4, 'rear', U('lead'))] },
    q_gold: { charge: { turn: 2 }, ambush: [A('lead')] },
    q_palette: { waves: [W(3, 'flank', U('shade', 2)), W(5, 'flank', U('thorn', 2))] },
    q_stargarden: { second: core('星を呑んだ核', '核が、庭の星を一つ呑みこんだ', { kind: 'thorn', n: 1 }), ambush: [A('thorn')] },
    q_echo: { second: core('四つの声を重ねた核', '核が、四つの声で同時に叫んだ', { kind: 'shade', n: 2 }), waves: [W(4, 'far', U('lead'), U('thorn'))], ambush: [A('shade', 2)] },
    // ---- 復興編 ----
    gp_farol: { waves: [W(3, 'flank', U('shade', 2))] },
    gp_rivela: { ambush: [A('membrane', 2)] },
    gp_pomela: { charge: { turn: 3 }, waves: [W(4, 'far', U('thorn', 2))] },
    gp_folio: { ambush: [A('lead', 2)] },
    gp_fiamma: { waves: [W(3, 'rear', U('shade', 2))], charge: { turn: 3 } },
    gp_lucerna: { ambush: [A('membrane', 2)], waves: [W(4, 'flank', U('shade', 2))] },
    gp_coronel: { charge: { turn: 2 }, ambush: [A('thorn', 2)] },
    gp_aster: { waves: [W(3, 'flank', U('membrane', 2)), W(5, 'rear', U('lead', 2))], ambush: [A('thorn')] },
    restore1: { waves: [W(3, 'far', U('shade', 2))] },
    restore2: { ambush: [A('membrane', 2)] },
    restore3: { second: core('実を落とした核', '核が、腐った実を落として軽くなった', { kind: 'thorn', n: 2 }) },
    restore4: { waves: [W(4, 'rear', U('lead', 2))], second: core('頁を綴じ直した核', '核が、破れた頁を黒く綴じ直した') },
    restore5: { ambush: [A('membrane', 2)], charge: { turn: 3 } },
    restore6: { waves: [W(3, 'flank', U('shade', 2)), W(5, 'far', U('thorn', 2))], second: core('広場を塗りこめた核', '核が、広場の色をもう一度塗りつぶした') },
    restore7: { ambush: [A('lead', 2)], second: core('天測を狂わせた核', '核が、星の位置をずらして立ち上がった', { kind: 'membrane', n: 2 }) },
    restore8: { waves: [W(3, 'flank', U('membrane', 2)), W(5, 'rear', U('lead', 2))], ambush: [A('thorn', 2)], second: core('向こう側を映した核', '核が、レンズの奥の灰色を映して立ち上がった', { kind: 'shade', n: 2 }) },
    // ---- 復興の依頼（順に作戦が変わる） ----
    rq_crates: { waves: [W(3, 'rear', U('shade', 2))] },
    rq_lights: { ambush: [A('thorn', 2)] },
    rq_well: { second: core('井戸の底の核', '核が、井戸の水を黒く吸い上げた') },
    rq_wheel: { charge: { turn: 2 }, waves: [W(4, 'far', U('shade', 2))] },
    rq_names: { ambush: [A('thorn', 2)], second: core('名札を剥がした核', '核が、苗の名札を一枚ずつ剥がした') },
    rq_birds: { waves: [W(3, 'flank', U('shade', 2)), W(5, 'flank', U('thorn', 2))] },
    rq_ink: { second: core('空白を広げた核', '核が、頁の空白を黒く広げた', { kind: 'shade', n: 2 }), ambush: [A('lead')] },
    rq_bridge: { charge: { turn: 3 }, waves: [W(4, 'rear', U('lead', 2))] },
    rq_garden: { ambush: [A('thorn', 3)] },
    rq_bells: { waves: [W(3, 'far', U('shade', 2))], second: core('鐘を割った核', '核が、割れた鐘の音で立ち上がった') },
    rq_windows: { ambush: [A('lead', 2)], charge: { turn: 3 } },
    rq_stars: { waves: [W(3, 'flank', U('thorn', 2)), W(5, 'rear', U('lead', 2))], second: core('観測を止めた核', '核が、最後の記録を黒く塗りつぶした', { kind: 'shade', n: 2 }) },
    // ---- 伝説級（すべてを重ねる） ----
    lg_tide: { waves: [W(3, 'flank', U('membrane', 2)), W(5, 'rear', U('lead', 2))], ambush: [A('thorn', 2)], second: core('深淵の核', '核が、深い潮をまとって浮かび上がった', { kind: 'membrane', n: 2 }) },
    lg_bloom: { charge: { turn: 2 }, ambush: [A('thorn', 3)], second: core('樹海の核', '核が、千の蔓を編み直した', { kind: 'thorn', n: 2 }) },
    lg_gold: { waves: [W(3, 'rear', U('lead', 2)), W(5, 'far', U('thorn', 2))], second: core('裂け谷の核', '核が、金屑を鎧にして立ち上がった', { kind: 'lead', n: 2 }) },
    lg_prism: { ambush: [A('membrane', 2)], waves: [W(4, 'flank', U('thorn', 2))], second: core('七針の核', '核が、七本の針を背に立てた', { kind: 'membrane', n: 2 }) },
    lg_night: { charge: { turn: 2 }, waves: [W(3, 'flank', U('shade', 2)), W(5, 'rear', U('lead', 2))], ambush: [A('thorn', 2)], second: core('宙を織る核', '核が、夜空の糸を黒く織り直した', { kind: 'shade', n: 3 }) },
  };
  const of = id => TABLE[id] || null;
  return { of, TABLE };
})();
