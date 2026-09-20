/* bootstrap */
window.addEventListener('DOMContentLoaded', () => {
  Sprites.init(); Sprites.prewarm();
  const ui = new UI();
  const game = new Game(document.getElementById('game'), ui, ui.save);
  ui.init(game);
  ui.setState('menu');
  window.game = game; window.ui = ui;
});
