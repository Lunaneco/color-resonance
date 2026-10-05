// 床の予告は盤面座標で持つ。回転しても同じ危険な床を示す。
const GuardianCombat = (() => {
  const phaseNames=['拒絶する声','ほどける記憶','帰ってきた理性'];
  const phase=(hp,max)=>hp<=Math.ceil(max/3)?2:hp<=Math.ceil(max*2/3)?1:0;
  function damage(hp,max,current,amount) {
    const floor=current===0?Math.ceil(max*2/3):current===1?Math.ceil(max/3):0;
    return Math.min(amount,Math.max(0,hp-floor));
  }
  function plan(profile,index,boss,allies,cells,turn) {
    const hero=allies.slice().sort((a,b)=>Math.abs(a.r-boss.r)+Math.abs(a.c-boss.c)-Math.abs(b.r-boss.r)-Math.abs(b.c-boss.c))[0]||boss;
    const gap=index+1, br=boss.r,bc=boss.c,hr=hero.r,hc=hero.c;
    const radius=c=>Math.abs(c.r-hr)+Math.abs(c.c-hc), ring=c=>Math.abs(c.r-br)+Math.abs(c.c-bc);
    const dr=Math.sign(hr-br)||1,dc=Math.sign(hc-bc);
    const maxR=Math.max(...cells.map(c=>c.r)),maxC=Math.max(...cells.map(c=>c.c));
    const pattern={
      cocoon:c=>ring(c)===index+2 || index===2&&radius(c)<=1,
      charge:c=>Math.abs(hr-br)>=Math.abs(hc-bc) ? (c.c===bc || index===1&&c.c===bc+Math.sign(hc-bc||1) || index===2&&c.r===hr) : (c.r===br || index===1&&c.r===br+Math.sign(hr-br||1) || index===2&&c.c===hc),
      tide:c=>c.r===hr||(index>0&&c.r===hr+(turn%2?1:-1)),
      clock:c=>ring(c)<=3+index&&(c.r+c.c+turn)%(index===2?3:2)===0,
      vines:c=>radius(c)===gap,
      shell:c=>ring(c)===1+index||index===2&&ring(c)===2,
      prism:c=>c.r-br===c.c-bc||index>0&&c.r-br===bc-c.c,
      night:c=>c.r===0||c.c===0||c.r===maxR||c.c===maxC||index>0&&c.r===hr,
      lighthouse:c=>c.c===hc||index>0&&c.c===hc+(turn%2?1:-1),
      carp:c=>c.r===br||c.r===hr||index===2&&c.c===hc,
      orchard:c=>radius(c)===2||index>0&&radius(c)===3+index,
      crane:c=>c.r===br||c.c===bc||index===2&&Math.abs(c.r-br)===Math.abs(c.c-bc),
      hearth:c=>radius(c)<=index+1,
      lantern:c=>ring(c)<=3+index&&(dr*(c.r-br)+dc*(c.c-bc))>0&&Math.abs(dc*(c.r-br)-dr*(c.c-bc))<=index+1,
      crown:c=>c.c===bc-gap||c.c===bc+gap||index===2&&c.r===hr,
      starglass:c=>ring(c)>=1&&ring(c)<=3+index&&(c.r*2+c.c+turn)%(index+3)===0,
    }[profile.pattern];
    return cells.filter(c=>c.walk&&pattern(c)).map(c=>({r:c.r,c:c.c}));
  }
  function mode(profile,index) { return {mov:index?2:1,rng:[1,index+1],power:(profile.id==='vard'?[.65,.8,.9]:[.75,.7,.6])[index],armor:profile.effect==='armor'?(profile.id==='spinel'?[3,2,0]:[2,1,0])[index]:0}; }
  const profile=id=>GUARDIANS.find(p=>p.id===id);
  return {phaseNames,phase,damage,plan,mode,profile};
})();
