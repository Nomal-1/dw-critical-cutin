/**
 * 대성공 컷인 모듈
 * 던전월드(Dungeon World) 무브 판정에서 대성공(10 이상)이 나오면
 * 전체 화면 컷인 이미지 + 효과음을 자동으로 재생한다.
 */

import { CutinConfig, MODULE_ID } from './cutin-config.js';

const CRITICAL_THRESHOLD = 10;

/**
 * PC 액터 시트를 열었을 때 헤더에 "컷인 설정" 버튼을 추가한다.
 * 던전월드 시스템의 액터 타입은 'character'(PC)와 'npc' 두 가지이며,
 * 이 모듈은 PC에만 컷인을 설정하므로 'character' 타입일 때만 버튼을 단다.
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  if (game.system.id !== 'dungeonworld') return;
  if (app.actor.type !== 'character') return;

  const windowHeader = html.closest('.app').find('.window-header');
  const button = $(
    `<a class="header-button dw-critical-cutin-config" title="대성공 컷인 설정">` +
      `<i class="fas fa-star"></i> 컷인 설정</a>`
  );
  button.on('click', () => new CutinConfig(app.actor).render(true));
  windowHeader.find('.close').before(button);
});

/**
 * 던전월드 시스템의 채팅 카드 템플릿(chat-move.html)은
 *   <div class="... move-card" data-roll-total="12" data-actor-id="abc123">
 * 형태로 굴림 총합과 액터 ID를 HTML 속성에 직접 담아서 렌더링한다.
 * 이 시스템은 ChatMessage 문서 자체(message.rolls)에는 굴림 결과를 저장하지
 * 않기 때문에, message.content(렌더링된 HTML 문자열)를 파싱해서 이 속성을
 * 읽는 방법이 굴림 결과를 확인하는 유일한 방법이다.
 */
Hooks.on('createChatMessage', (message, options, userId) => {
  // 던전월드 시스템이 아니면 아무것도 하지 않음
  if (game.system.id !== 'dungeonworld') return;

  const $content = $('<div>').html(message.content);
  const $moveCard = $content.find('.move-card');

  // 무브 판정 카드가 아니면(예: 일반 채팅, 데미지 롤 등) 무시
  if ($moveCard.length === 0) return;

  const rollTotal = Number($moveCard.attr('data-roll-total'));
  if (!Number.isFinite(rollTotal) || rollTotal < CRITICAL_THRESHOLD) return;

  const actorId = $moveCard.attr('data-actor-id');
  const actor = game.actors.get(actorId);
  if (!actor) return;

  // 액터 flag에 컷인 이미지가 설정되어 있지 않으면 연출하지 않음
  const image = actor.getFlag(MODULE_ID, 'image');
  if (!image) return;

  const sound = actor.getFlag(MODULE_ID, 'sound');
  playCriticalCutin(image, sound);
});

/**
 * 전체 화면 오버레이로 이미지를 띄우고 효과음을 재생한다.
 * createChatMessage 훅은 접속한 모든 클라이언트에서 동일하게 실행되므로
 * (Foundry가 새 채팅 메시지를 모든 클라이언트에 자동 동기화하기 때문),
 * 이 함수도 각 클라이언트에서 각자 실행되어 별도의 socket 브로드캐스트 없이
 * 모든 화면에서 동시에 연출이 재생된다.
 */
function playCriticalCutin(imagePath, soundPath) {
  const overlay = document.createElement('div');
  overlay.classList.add('dw-critical-cutin-overlay');

  const img = document.createElement('img');
  img.src = imagePath;
  overlay.appendChild(img);

  document.body.appendChild(overlay);
  overlay.addEventListener('animationend', () => overlay.remove(), { once: true });

  if (soundPath) {
    // AudioHelper: FVTT 코어가 제공하는 사운드 재생 API. new Audio()를 직접 쓰는 것보다
    // 코어의 인터페이스 음량 설정(설정 > 오디오/비디오)을 자동으로 반영해준다.
    // 두 번째 인자(push)는 false로 둔다 — true로 하면 이 클라이언트가 다른 접속자에게도
    // "이 소리를 재생해라"라고 socket으로 알리는데, createChatMessage 훅은 이미 모든
    // 클라이언트에서 각자 실행되므로 push까지 켜면 소리가 중복 재생된다.
    AudioHelper.play({ src: soundPath, volume: 1, autoplay: true, loop: false }, false);
  }
}
