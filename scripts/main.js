/**
 * 대성공 컷인 모듈
 * 던전월드(Dungeon World)에서 설정된 발동 조건(플레이어 판정 성공/대성공,
 * 플레이어·몬스터 데미지 초과, 특정 몬스터 액션 사용)을 만족하면
 * 전체 화면 컷인 이미지 + 효과음을 자동으로 재생한다.
 */

import { CutinConfig, MODULE_ID } from './cutin-config.js';

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

  /**
   * 컷인 발동 조건. 아래 4개는 world 설정, "몬스터 액션 사용"은 각 NPC 액션
   * 아이템 시트의 체크박스로 개별 지정한다 (아래 renderItemSheet 훅 참고).
   */
  game.settings.register(MODULE_ID, 'triggerPlayerSuccess', {
    name: '플레이어 대성공(10+)에 발동',
    hint: '플레이어의 무브 판정이 대성공(합계 10 이상)일 때 컷인을 발동합니다.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });

  game.settings.register(MODULE_ID, 'triggerPlayerPartial', {
    name: '플레이어 성공(7~9)에도 발동',
    hint: '플레이어의 무브 판정이 부분 성공(합계 7~9)일 때도 컷인을 발동합니다.',
    scope: 'world',
    config: true,
    type: Boolean,
    default: false,
  });

  game.settings.register(MODULE_ID, 'playerDamageThreshold', {
    name: '플레이어 데미지 발동 기준값',
    hint: '플레이어가 이 값을 초과하는 데미지를 굴리면 컷인을 발동합니다. 0이면 사용하지 않습니다.',
    scope: 'world',
    config: true,
    type: Number,
    default: 0,
    range: { min: 0, max: 50, step: 1 },
  });

  game.settings.register(MODULE_ID, 'monsterDamageThreshold', {
    name: '몬스터 데미지 발동 기준값',
    hint: '몬스터(NPC)가 이 값을 초과하는 데미지를 굴리면 컷인을 발동합니다. 0이면 사용하지 않습니다.',
    scope: 'world',
    config: true,
    type: Number,
    default: 0,
    range: { min: 0, max: 50, step: 1 },
  });
});

/**
 * NPC의 액션(npcMove) 아이템 시트 "정보" 탭에 "이 액션 사용 시 컷인 발동" 체크박스를 추가한다.
 * 체크되어 있으면 주사위 결과나 판정 여부와 무관하게, 그 액션이 사용될 때마다
 * (채팅에 카드가 뜰 때마다) 무조건 컷인이 발동한다. GM에게만 보인다.
 * 체크박스의 name을 "flags.dw-critical-cutin.forceCutin"으로 지정해두면,
 * 아이템 시트가 자체적으로 가진 자동 저장 기능(변경 시 document.update 호출)이
 * 이 값도 함께 액터/아이템 flag로 저장해준다 — 별도의 저장 버튼이 필요 없다.
 *
 * npcMove-sheet.html 원본을 확인해보면 "정보" 탭은 실제로는
 * data-tab="details"이고, 그 안의 "판정 공식"/"액션 유형" 필드가 각각
 * .resource 클래스의 상자에 들어있다. 우리 체크박스도 같은 .resource
 * 클래스를 같이 써서 그 필드들과 똑같은 크기/여백으로 자연스럽게 들어가게 한다.
 */
Hooks.on('renderItemSheet', (app, html, data) => {
  if (game.system.id !== 'dungeonworld') return;
  if (!game.user.isGM) return;
  if (app.item.type !== 'npcMove') return;

  const checked = app.item.getFlag(MODULE_ID, 'forceCutin') ? 'checked' : '';
  const field = $(
    `<div class="resource dw-critical-cutin-force">` +
      `<label>` +
        `<input type="checkbox" name="flags.${MODULE_ID}.forceCutin" ${checked} />` +
        `이 액션 사용 시 컷인 발동 (결과 무관)` +
      `</label>` +
    `</div>`
  );

  const detailsTab = html.closest('.app').find('.tab[data-tab="details"]');
  detailsTab.append(field);
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
 * 던전월드 시스템은 채팅 카드 템플릿(chat-move.html) 하나를 무브 판정뿐 아니라
 * 데미지 굴림, 굴림 없는 액션 사용 등에도 재사용한다. 그래서 카드 안의 표식으로
 * 어떤 종류의 카드인지 구분해야 한다.
 * - 무브 판정(2d6)일 때만 성공/부분성공/실패가 계산되어 result 클래스
 *   (success/partial/failure)가 붙는다 (CONFIG.DW.rollResults 기준).
 * - 데미지 굴림은 result 클래스 대신 데미지 적용 버튼 묶음(chat-damage-buttons)이
 *   붙고, data-roll-total 속성에 데미지 합계가 담긴다.
 * - 굴림 자체가 없는(설명만 있는) 액션 사용도 같은 카드 형태로 뜨며, 이때는
 *   카드 제목(.cell__title)에 그 액션 아이템의 이름이 그대로 표시된다.
 * 이 시스템은 ChatMessage 문서 자체(message.rolls)에는 굴림 결과를 저장하지
 * 않기 때문에, message.content(렌더링된 HTML 문자열)를 파싱하는 방법이 유일하다.
 */
Hooks.on('createChatMessage', (message, options, userId) => {
  // 던전월드 시스템이 아니면 아무것도 하지 않음
  if (game.system.id !== 'dungeonworld') return;

  const $content = $('<div>').html(message.content);
  const $moveCard = $content.find('.move-card');
  if ($moveCard.length === 0) return;

  const actorId = $moveCard.attr('data-actor-id');
  const actor = game.actors.get(actorId);
  if (!actor) return;

  // 액터 flag에 컷인 이미지가 설정되어 있지 않으면 연출하지 않음
  const image = actor.getFlag(MODULE_ID, 'image');
  if (!image) return;

  if (!isCutinTriggered($moveCard, actor)) return;

  const sound = actor.getFlag(MODULE_ID, 'sound');
  playCriticalCutin(image, sound);
});

/**
 * 발동 조건 5가지 중 하나라도 맞으면 true.
 * 1) 몬스터 액션 사용: 체크박스가 켜진 NPC 액션과 카드 제목이 같으면 결과 무관 발동
 * 2) 몬스터 데미지 초과: NPC의 데미지 굴림 합계가 기준값을 넘으면 발동
 * 3) 플레이어 데미지 초과: PC의 데미지 굴림 합계가 기준값을 넘으면 발동
 * 4) 플레이어 대성공: PC의 무브 판정이 성공(10+)이면 발동
 * 5) 플레이어 성공: PC의 무브 판정이 부분 성공(7~9)이면 발동
 */
function isCutinTriggered($moveCard, actor) {
  if (actor.type === 'npc') {
    const title = $moveCard.find('.cell__title').first().text().trim();
    const forcedMove = actor.items.find(
      (item) => item.type === 'npcMove' && item.getFlag(MODULE_ID, 'forceCutin') && item.name === title
    );
    if (forcedMove) return true;
  }

  const isDamageRoll = $moveCard.find('.chat-damage-buttons').length > 0;
  if (isDamageRoll) {
    const total = Number($moveCard.attr('data-roll-total'));
    if (!Number.isFinite(total)) return false;

    const settingKey = actor.type === 'npc' ? 'monsterDamageThreshold' : 'playerDamageThreshold';
    const threshold = Number(game.settings.get(MODULE_ID, settingKey)) || 0;
    return threshold > 0 && total > threshold;
  }

  if (actor.type === 'character') {
    if (game.settings.get(MODULE_ID, 'triggerPlayerSuccess') && $moveCard.find('.result.success').length > 0) {
      return true;
    }
    if (game.settings.get(MODULE_ID, 'triggerPlayerPartial') && $moveCard.find('.result.partial').length > 0) {
      return true;
    }
  }

  return false;
}

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
