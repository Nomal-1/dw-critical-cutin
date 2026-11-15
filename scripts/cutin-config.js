/**
 * 액터별 컷인 이미지/효과음을 설정하는 창.
 * ApplicationV2(12+) 폼 창으로 만들었다 — 옛 FormApplication은 16에서 없어진다.
 */

export const MODULE_ID = 'dw-critical-cutin';

// V13+에서는 전역 FilePicker가 deprecated라 새 위치를 우선 쓴다(V12에는 전역만 있다).
function getFilePickerClass() {
  return foundry.applications?.apps?.FilePicker?.implementation ?? FilePicker;
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CutinConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    id: 'dw-critical-cutin-config',
    tag: 'form',
    window: { title: '대성공 컷인 설정' },
    position: { width: 480 },
    form: { handler: CutinConfig.#onSubmit, closeOnSubmit: true },
    actions: { pickFile: CutinConfig.#onPickFile },
  };

  static PARTS = {
    body: { template: `modules/${MODULE_ID}/templates/cutin-config.html` },
  };

  async _prepareContext() {
    return {
      image: this.actor.getFlag(MODULE_ID, 'image') ?? '',
      sound: this.actor.getFlag(MODULE_ID, 'sound') ?? '',
    };
  }

  // FilePicker: FVTT 코어가 제공하는 파일 탐색기. 서버(또는 S3 등)에 올라간
  // 이미지/오디오 파일을 GM이 직접 코드 수정 없이 찾아서 선택할 수 있게 해준다.
  static #onPickFile(event, button) {
    event.preventDefault();
    const input = this.element.querySelector(`input[name="${button.dataset.target}"]`);
    new (getFilePickerClass())({
      type: button.dataset.type, // 'image' 또는 'audio'
      current: input.value,
      callback: (path) => {
        input.value = path;
      },
    }).browse();
  }

  static async #onSubmit(event, form, formData) {
    const data = formData.object;
    for (const key of ['image', 'sound']) {
      const value = String(data[key] ?? '').trim();
      if (value) await this.actor.setFlag(MODULE_ID, key, value);
      else await this.actor.unsetFlag(MODULE_ID, key);
    }
  }
}
