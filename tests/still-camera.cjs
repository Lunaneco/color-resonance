// 縦のスマホでは、選んだ仲間へ盤が滑らかに寄る（js/board.js の easeView）。
// 座標を読んでから指で触れるテストが動いている途中の盤を触らないよう、
// 座標を求める・触れた所を拾うたびに、寄せを終わった位置へ置く。寄せそのものは tests/portrait-play.test.cjs で確かめる。
module.exports = source => {
  const pairs = [
    ['const toScreen = (x, y) => ({', 'const toScreen = (x, y) => (settleView(), {'],
    ['const toWorld = (x, y) => { const vx', 'const toWorld = (x, y) => { settleView(); const vx'],
  ];
  for (const [a, b] of pairs) { if (!source.includes(a)) throw Error('still-camera: board.js changed: ' + a); source = source.replace(a, b); }
  return source;
};
