// 旧版の「馨のカフェ」。1.19.0 から、カフェの場面は最終章「灰色の継ぎ目」の冒頭に入り、
// クロムと馨はそこで初めて出会う。読みかけの旧セーブが迷子にならないよう、開いても元の記録へ戻るだけにしてある。
const Kaoru = (() => {
  SCRIPT.kaoru_cafe = `
@sideend
`;
  const available = () => false;
  function start() {}
  return { available, start };
})();
