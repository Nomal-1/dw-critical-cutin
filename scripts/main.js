/**
 * 대성공 컷인 모듈
 * 던전월드(Dungeon World) 무브 판정에서 대성공(10 이상)이 나오면
 * 전체 화면 컷인 이미지 + 효과음을 자동으로 재생한다.
 */

import { CutinConfig, MODULE_ID } from './cutin-config.js';

const CRITICAL_THRESHOLD = 10;

/**
 * GM이 설정(Configure Settings)의 모듈 설정 항목에서 조정하는 연출 타이밍 3종.
 * scope: 'world'로 등록하면 플레이어에게는 이 항목 자체가 보이지 않고,
 * GM만 Configure Settings 화면에서 값을 바꿀 수 있다 (Foundry 코어 동작).
 * 값의 단위는 ms(1000 = 1초)이며, 0으로 두면 해당 구간을 건너뛴다.
 */
Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'growDuration', {
    name: '등장(확대) 시간 (ms)',
    hint: '작게 나타난 컷인 이미지가 원래 크기로 커지는 데 걸리는 시간입니다. 0이면 처음부터 완전히 커진 상태로 나타납니다.',
    scope: 'world',
    config: true,
    type: Number,
    default: 500,
    range: { min: 0, max: 10000, step: 100 },
  });

  game.settings.register(MODULE_ID, 'holdDuration', {
    name: '유지 시간 (ms)',
    hint: '컷인이 완전히 커진 채로 화면에 머무르는 시간입니다. 0이면 커지자마자 바로 페이드아웃을 시작합니다.',
    scope: 'world',
    config: true,
    type: Number,
    default: 2000,
    range: { min: 0, max: 20000, step: 100 },
  });

  game.settings.register(MODULE_ID, 'fadeDuration', {
    name: '페이드아웃 시간 (ms)',
    hint: '컷인이 서서히 사라지는 데 걸리는 시간입니다. 0이면 즉시 사라집니다.',
    scope: 'world',
    config: true,
    type: Number,
    default: 500,
    range: { min: 0, max: 10000, step: 100 },
  });
});

/**
 * 액터 시트를 열었을 때 헤더에 "컷인 설정" 버튼을 추가한다.
 * - PC('character')와 NPC 모두에 버튼을 단다 (마스터가 NPC 컷인도 설정할 수 있어야 하므로).
 * - game.user.isGM으로 막아서 플레이어에게는 이 버튼 자체가 보이지 않는다.
 *   (자신의 캐릭터 시트를 열어도 플레이어에게는 안 보이고, GM에게만 보인다.)
 */
Hooks.on('renderActorSheet', (app, html, data) => {
  if (game.system.id !== 'dungeonworld') return;
  if (!game.user.isGM) return;

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

  if (soundPath) {
    // AudioHelper: FVTT 코어가 제공하는 사운드 재생 API. new Audio()를 직접 쓰는 것보다
    // 코어의 인터페이스 음량 설정(설정 > 오디오/비디오)을 자동으로 반영해준다.
    // 두 번째 인자(push)는 false로 둔다 — true로 하면 이 클라이언트가 다른 접속자에게도
    // "이 소리를 재생해라"라고 socket으로 알리는데, createChatMessage 훅은 이미 모든
    // 클라이언트에서 각자 실행되므로 push까지 켜면 소리가 중복 재생된다.
    AudioHelper.play({ src: soundPath, volume: 1, autoplay: true, loop: false }, false);
  }

  const growMs = Math.max(0, Number(game.settings.get(MODULE_ID, 'growDuration')) || 0);
  const holdMs = Math.max(0, Number(game.settings.get(MODULE_ID, 'holdDuration')) || 0);
  const fadeMs = Math.max(0, Number(game.settings.get(MODULE_ID, 'fadeDuration')) || 0);

  runCutinSequence(overlay, img, growMs, holdMs, fadeMs);
}

/**
 * 등장(확대) → 유지 → 페이드아웃 순서로 재생하고 끝나면 오버레이를 제거한다.
 * 각 구간 시간을 0으로 두면 그 구간은 애니메이션 없이 바로 다음 단계로 넘어간다.
 */
async function runCutinSequence(overlay, img, growMs, holdMs, fadeMs) {
  await animateTo(overlay, img, growMs, { opacity: '1', scale: '1' });

  if (holdMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, holdMs));
  }

  await animateTo(overlay, img, fadeMs, { opacity: '0', scale: '1' });

  overlay.remove();
}

/**
 * overlay의 opacity와 img의 확대/축소(scale)를 durationMs 동안 목표값까지 바꾼다.
 * CSS의 transition 속성을 이용하는데, durationMs가 0이면 transition 없이
 * 목표값으로 즉시 바꿔서 그 구간을 건너뛴 것처럼 만든다.
 */
function animateTo(overlay, img, durationMs, { opacity, scale }) {
  return new Promise((resolve) => {
    overlay.style.transitionDuration = `${durationMs}ms`;
    img.style.transitionDuration = `${durationMs}ms`;

    if (durationMs <= 0) {
      overlay.style.opacity = opacity;
      img.style.transform = `scale(${scale})`;
      resolve();
      return;
    }

    const onTransitionEnd = (event) => {
      // img의 transform transition도 overlay까지 버블링되므로,
      // overlay 자신의 opacity transition이 끝났을 때만 다음 단계로 넘어간다.
      if (event.target !== overlay) return;
      overlay.removeEventListener('transitionend', onTransitionEnd);
      resolve();
    };
    overlay.addEventListener('transitionend', onTransitionEnd);

    // 같은 프레임에서 바로 값을 바꾸면 브라우저가 transition을 생략할 수 있어
    // 한 프레임 뒤로 미뤄서 실제로 애니메이션이 걸리게 한다.
    requestAnimationFrame(() => {
      overlay.style.opacity = opacity;
      img.style.transform = `scale(${scale})`;
    });
  });
}
