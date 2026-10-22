const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../assets/generated');
test('Every royal guard, soldier type, cocoon, Kaoru and Marii has complete playable PNG motions',async()=>{
 const manifest=JSON.parse(await fs.readFile(path.join(root,'manifest.json'),'utf8'));
 const ids=['marina','sion','ocher','amber','viola','carmine','verde'].map(id=>'cmd_'+id)
  .concat(['lance','sword','bow','heavy','cavalry','captain'].map(id=>'s_'+id),['cocoon','kaoru','mari']);
 for(const id of ids){
  const a=manifest.assets.find(a=>a.id===id);assert(a,id+' has dedicated artwork');
  const sheet=await fs.readFile(path.join(root,a.sheet));
  assert.equal(sheet.readUInt32BE(16),a.grid.columns*a.grid.cellSize[0],id);
  assert.equal(sheet.readUInt32BE(20),a.grid.rows*a.grid.cellSize[1],id);
  assert.equal(sheet[25],6,id+' retains RGBA transparency');
  for(const action of ['idle','walk','attack','hurt','cast']){
   const clip=a.animations[action];assert(clip,id+'/'+action);
   assert.equal(clip.sequence.length,clip.durationsMs.length);
   assert.equal(clip.durationMs,clip.durationsMs.reduce((a,b)=>a+b,0));
   for(const n of clip.sequence){assert(Number.isInteger(n)&&n>=0&&n<a.frames.length);await fs.access(path.join(root,a.frames[n]));}
   await fs.access(path.join(root,clip.gif));
  }
  const first=await fs.readFile(path.join(root,a.frames[0])),blink=await fs.readFile(path.join(root,a.frames[1]));
  assert.notDeepEqual(first,blink,id+' has a painted blink/breath cel');
  assert(a.displayBounds.l>0&&a.displayBounds.t>0&&a.displayBounds.r<a.grid.cellSize[0]&&a.displayBounds.b<a.grid.cellSize[1],id+' has complete silhouettes inside the canvas');
 }
 const noir=manifest.assets.find(a=>a.id==='renoir');
 for(const action of ['attack','hurt','absorb'])assert(noir.animations[action],'Noir field motion '+action);
});
