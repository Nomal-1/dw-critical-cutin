/**
 * 액터별 컷인 이미지/효과음을 설정하는 창.
 * FormApplication: FVTT v12의 "구버전(v1) Application" 계열 폼 창 베이스 클래스.
 * v13에서는 ApplicationV2로 대체되는 추세지만, v12에서는 FormApplication이
 * 표준이고 이 프로젝트는 v12.331을 기준으로 하므로 이 클래스를 사용한다.
 * (v13에서도 하위 호환 계층을 통해 계속 동작하지만, 콘솔에 지원 종료 경고가
 * 뜰 수 있다는 점은 참고할 것.)
 */

export const MODULE_ID = 'dw-critical-cutin';

export class CutinConfig extends FormApplication {
  constructor(actor, options = {}) {
    super(actor, options);
    this.actor = actor;
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dw-critical-cutin-config',
      title: '대성공 컷인 설정',
      template: `modules/${MODULE_ID}/templates/cutin-config.html`,
      width: 480,
      closeOnSubmit: true,
    });
  }

  /** @override */
  getData() {
    return {
      image: this.actor.getFlag(MODULE_ID, 'image') ?? '',
      sound: this.actor.getFlag(MODULE_ID, 'sound') ?? '',
    };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // FilePicker: FVTT 코어가 제공하는 파일 탐색기. 서버(또는 S3 등)에 올라간
    // 이미지/오디오 파일을 GM이 직접 코드 수정 없이 찾아서 선택할 수 있게 해준다.
    html.find('.file-picker-button').on('click', (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      const type = button.dataset.type; // 'image' 또는 'audio'
      const targetName = button.dataset.target;
      const input = html.find(`input[name="${targetName}"]`)[0];

      new FilePicker({
        type,
        current: input.value,
        callback: (path) => {
          input.value = path;
        },
      }).browse();
    });
  }

  /** @override */
  async _updateObject(event, formData) {
    if (formData.image) {
      await this.actor.setFlag(MODULE_ID, 'image', formData.image);
    } else {
      await this.actor.unsetFlag(MODULE_ID, 'image');
    }

    if (formData.sound) {
      await this.actor.setFlag(MODULE_ID, 'sound', formData.sound);
    } else {
      await this.actor.unsetFlag(MODULE_ID, 'sound');
    }
  }
}
