/* bootstrap */
window.addEventListener('DOMContentLoaded', () => {
  Sprites.init(); Sprites.prewarm(); Sprites.loadImageArt();
  const ui = new UI();
  const game = new Game(document.getElementById('game'), ui, ui.save);
  ui.init(game);
  ui.setState('menu');
  // memesurvival.com/play skips the title and opens character select (?play does the same on a local server)
  if (/^\/play\/?$/.test(location.pathname) || new URLSearchParams(location.search).has('play')) ui.openSetup();
  window.game = game; window.ui = ui;
});
