'use strict';
(() => {
  const manifest = window.COLOR_ASSETS;
  const categories = {all:'すべて',enemy:'敵',ally:'仲間',npc:'モブ・会話',support:'ルノワール',fx:'技・状態'};
  const grid = document.querySelector('#grid');
  const search = document.querySelector('#search');
  const animate = document.querySelector('#animate');
  const cards = [];
  let category = 'all';
  if (!manifest) { document.querySelector('#result-count').textContent = '対応表を読み込めませんでした。ページを再読み込みしてください。'; return; }
  animate.checked = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const make = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const stats = [[manifest.counts.characters,'キャラクター'],[manifest.counts.effects,'エフェクト'],[manifest.counts.gifs,'動作GIF']];
  for (const [number,label] of stats) { const el=make('div','stat'); el.append(make('strong','',number),document.createTextNode(label)); document.querySelector('#stats').append(el); }
  for (const [id,label] of Object.entries(categories)) {
    const button = make('button','',label); button.type='button'; button.dataset.category=id; button.setAttribute('aria-pressed',String(id==='all'));
    button.addEventListener('click',()=>{ category=id; for(const other of document.querySelectorAll('[data-category]')) other.setAttribute('aria-pressed',String(other===button)); filter(); });
    document.querySelector('#filters').append(button);
  }
  for (const asset of manifest.assets) {
    const card = make('article','card'); card.dataset.id=asset.id;
    const preview = make('div','preview'); const img=make('img'); img.alt=asset.name+'の動作'; img.loading='lazy'; img.decoding='async'; preview.append(img);
    const info=make('div','card-info'); info.append(make('p','category',categories[asset.category]),make('h2','',asset.name),make('p','asset-id',asset.id));
    const label=make('label','motion-label','動作を選ぶ'); label.htmlFor='motion-'+asset.id;
    const select=make('select','motion-select'); select.id=label.htmlFor;
    for(const [key,animation] of Object.entries(asset.animations)) { const option=make('option','',animation.name); option.value=key; select.append(option); }
    const details=make('p','motion-details'); const links=make('div','downloads');
    const gifLink=make('a','gif-download','GIFを保存'); const sheetLink=make('a','','PNGシート'); const sourceLink=make('a','','原本PNG');
    sheetLink.href=asset.sheet; sheetLink.download=asset.id+'-sheet.png'; sourceLink.href=asset.source; sourceLink.download=asset.id+'-source.png'; links.append(gifLink,sheetLink,sourceLink);
    const update=()=>{const animation=asset.animations[select.value]; img.src=animate.checked?(animation.previewGif||animation.gif):asset.frames[asset.category==='fx'?4:0]; preview.dataset.layered=String(Boolean(animation.layers)); gifLink.href=animation.gif; gifLink.download=asset.id+'-'+select.value+'.gif'; details.textContent=animation.size.join(' × ')+' px · '+(animation.durationMs/1000).toFixed(2)+'秒 · '+animation.gifFrameCount+'コマ';};
    select.addEventListener('change',update); update();
    info.append(label,select,details,links); card.append(preview,info); grid.append(card);
    cards.push({card,asset,update,text:[asset.id,asset.name,...Object.values(asset.animations).map(a=>a.name)].join(' ').toLocaleLowerCase('ja')});
  }
  function filter(){const query=search.value.trim().toLocaleLowerCase('ja'); let total=0; for(const entry of cards){const visible=(category==='all'||entry.asset.category===category)&&entry.text.includes(query); entry.card.hidden=!visible; if(visible)total++;} document.querySelector('#result-count').textContent=total+'種類の素材を表示 / 全'+cards.length+'種類'; document.querySelector('#empty').hidden=total>0;}
  search.addEventListener('input',filter); animate.addEventListener('change',()=>cards.forEach(c=>c.update()));
  document.querySelector('#backdrop').addEventListener('change',event=>{document.body.dataset.backdrop=event.target.value;}); filter();
})();
