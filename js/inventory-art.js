// 生成した装備・道具・素材。未知のIDは画像URLにせず、既存の文字表示を残す。
const InventoryArt = (() => {
  const ids = Object.freeze(["e_glass","e_tide","e_ash","e_amber","e_prism","a_rain","a_wool","a_moss","a_gold","a_star","c_lens","c_bell","c_tea","c_brush","c_feather","u_knot","u_bell","u_vine","u_kintsugi","u_palette","u_nightsky","u_mist","u_fruit","u_compass","u_lens","u_sheath","u_quest_harbor","u_quest_lantern","u_quest_tide","u_quest_clock","u_quest_orchard","u_quest_thorns","u_quest_bloom","u_quest_bridge","u_quest_gold","u_quest_palette","u_quest_stargarden","u_quest_echo","i_tea","i_water","i_shard","i_powder","i_ward","m_dust","m_teal","m_green","m_gold","m_violet","m_core"]);
  const known = new Set(ids);
  function icon(id, extra = '') {
    if (!known.has(id)) return '';
    const kind = id.startsWith('m_') ? 'material' : id.startsWith('i_') ? 'item' : 'equipment';
    return `<span class="inventory-art inv-${kind}${id.startsWith('u_') ? ' inv-unique' : ''}${extra ? ' ' + extra : ''}" data-inventory="${id}" aria-hidden="true"><img src="assets/inventory/${id}.webp" width="256" height="256" alt="" decoding="async" loading="lazy"></span>`;
  }
  function name(id) {
    return (typeof EQUIP !== 'undefined' && EQUIP[id]?.name) || (typeof ITEMS !== 'undefined' && ITEMS[id]?.name) || (typeof Progression !== 'undefined' && Progression.materials[id]?.name) || id;
  }
  function chips(bag, mark = '+') {
    return `<span class="inventory-chips">${Object.entries(bag).filter(([id]) => known.has(id)).map(([id, amount]) => `<span class="inventory-chip">${icon(id)}<span>${name(id)} ${mark}${amount}</span></span>`).join('')}</span>`;
  }
  return { ids, icon, chips };
})();
