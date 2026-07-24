/**
 * 컷인 이미지 만들기 창.
 * 프레임(테두리 장식) 뒤에 캐릭터 일러스트를 배치해서 합성한 뒤,
 * 결과 PNG를 Foundry 서버에 업로드하고 그 경로를 액터의 컷인 이미지로
 * 바로 저장해주는 도구. 예전에는 별도 HTML 파일(외부 프로그램)로 만들어서
 * PNG를 다운로드한 다음 "컷인 설정" 창에서 다시 파일 찾아보기로 등록해야
 * 했는데, 이 창은 모듈 안에서 업로드까지 한 번에 끝낸다.
 *
 * Application: FVTT v12의 "구버전(v1) Application" 베이스 클래스.
 * FormApplication과 달리 정해진 폼 필드를 자동으로 저장해주지 않으므로,
 * 저장 버튼 클릭 시 우리가 직접 캔버스를 그려서 업로드하고 flag를 설정한다.
 */

import { MODULE_ID } from './cutin-config.js';

/**
 * 번들된 프레임 프리셋 목록. 실제 PNG 파일은 assets/frames/ 안에 있다.
 * (원래 외부 컷인 메이커 HTML에 base64로 박혀 있던 이미지 3장을 그대로 꺼내온 것)
 */
export const FRAME_PRESETS = [
  { name: '벽옥의 파열', path: `modules/${MODULE_ID}/assets/frames/frame-1.png` },
  { name: '문장 A (세로)', path: `modules/${MODULE_ID}/assets/frames/frame-2.png` },
  { name: '문장 B (기울임)', path: `modules/${MODULE_ID}/assets/frames/frame-3.png` },
];

export class CutinMaker extends Application {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;

    this.frameImg = null;
    this.charImg = null;
    this.charPos = { x: 450, y: 600 };
    this.charScale = 1.0;
    this.charRot = 0;
    this.dragging = false;
    this.dragOffset = { x: 0, y: 0 };

    // document 레벨 리스너(드래그 중 캔버스 밖으로 나가도 따라와야 함)는
    // activateListeners에서 등록하고 close()에서 반드시 해제한다.
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: 'dw-critical-cutin-maker',
      title: '컷인 이미지 만들기',
      template: `modules/${MODULE_ID}/templates/cutin-maker.html`,
      width: 900,
      height: 700,
      resizable: true,
    });
  }

  /** @override */
  getData() {
    return { actorName: this.actor.name };
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    this.canvas = html.find('#dw-cutin-maker-canvas')[0];
    this.ctx = this.canvas.getContext('2d');
    this.statusEl = html.find('#dw-cutin-maker-status')[0];

    this._buildPresetButtons(html);

    html.find('#dw-cutin-maker-char-input').on('change', (event) => this._onCharUpload(event));

    html.find('#dw-cutin-maker-scale').on('input', (event) => {
      this.charScale = Number(event.currentTarget.value) / 100;
      html.find('#dw-cutin-maker-scale-val').text(`${event.currentTarget.value}%`);
      this._redrawCanvas();
    });

    html.find('#dw-cutin-maker-rot').on('input', (event) => {
      this.charRot = Number(event.currentTarget.value);
      html.find('#dw-cutin-maker-rot-val').text(`${event.currentTarget.value}°`);
      this._redrawCanvas();
    });

    html.find('#dw-cutin-maker-canvas').on('mousedown', (event) => this._onMouseDown(event));
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mouseup', this._onMouseUp);

    html.find('#dw-cutin-maker-save').on('click', () => this._onSave());
  }

  /** @override */
  async close(options) {
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mouseup', this._onMouseUp);
    return super.close(options);
  }

  _setStatus(message) {
    if (this.statusEl) this.statusEl.textContent = message;
  }

  _buildPresetButtons(html) {
    const list = html.find('#dw-cutin-maker-presets');
    FRAME_PRESETS.forEach((preset, index) => {
      const btn = $(
        `<div class="dw-cutin-maker-preset-btn">` +
          `<img src="${preset.path}">` +
          `<span>${preset.name}</span>` +
        `</div>`
      );
      btn.on('click', () => this._selectPreset(index, btn, list));
      list.append(btn);
    });

    // 창을 열면 첫 번째 프레임을 자동으로 골라준다.
    const first = list.children().first();
    if (first.length) this._selectPreset(0, first, list);
  }

  _selectPreset(index, btnEl, list) {
    list.children().removeClass('active');
    btnEl.addClass('active');

    const img = new Image();
    img.onload = () => {
      this.frameImg = img;
      this.canvas.width = img.width;
      this.canvas.height = img.height;
      this.charPos = { x: img.width / 2, y: img.height / 2 };
      this._setStatus('프레임 적용됨. 2단계에서 캐릭터를 올려보세요.');
      this._redrawCanvas();
    };
    img.src = FRAME_PRESETS[index].path;
  }

  _onCharUpload(event) {
    const file = event.currentTarget.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      this.charImg = img;
      if (this.frameImg) {
        this.charPos = { x: this.frameImg.width / 2, y: this.frameImg.height / 2 };
        this.charScale = Math.min((this.frameImg.height * 0.8) / img.height, 1.4);
      }
      this._setStatus('캐릭터 업로드 완료. 드래그로 위치를 맞춰보세요.');
      this._redrawCanvas();
    };
    img.src = URL.createObjectURL(file);
  }

  _getCanvasPos(event) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  _onMouseDown(event) {
    if (!this.charImg) return;
    const pos = this._getCanvasPos(event);
    this.dragging = true;
    this.dragOffset = { x: pos.x - this.charPos.x, y: pos.y - this.charPos.y };
  }

  _onMouseMove(event) {
    if (!this.dragging || !this.charImg) return;
    const pos = this._getCanvasPos(event);
    this.charPos = { x: pos.x - this.dragOffset.x, y: pos.y - this.dragOffset.y };
    this._redrawCanvas();
  }

  _onMouseUp() {
    this.dragging = false;
  }

  /** 프레임은 항상 맨 앞, 캐릭터는 그 뒤에 그린다. */
  _redrawCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.charImg) {
      this.ctx.save();
      this.ctx.translate(this.charPos.x, this.charPos.y);
      this.ctx.rotate((this.charRot * Math.PI) / 180);
      this.ctx.scale(this.charScale, this.charScale);
      this.ctx.drawImage(this.charImg, -this.charImg.width / 2, -this.charImg.height / 2);
      this.ctx.restore();
    }

    if (this.frameImg) {
      this.ctx.drawImage(this.frameImg, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  async _onSave() {
    if (!this.frameImg) {
      ui.notifications.warn('먼저 프레임을 선택하세요.');
      return;
    }
    if (!this.charImg) {
      ui.notifications.warn('캐릭터 이미지를 업로드하세요.');
      return;
    }

    this._setStatus('업로드 중...');

    const blob = await new Promise((resolve) => this.canvas.toBlob(resolve, 'image/png'));
    const fileName = `${sanitizeFileName(this.actor.name)}-cutin-${Date.now()}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // 월드별 저장 폴더: worlds/<월드 ID>/dw-critical-cutin/
    // FilePicker 소스 "data"는 Foundry의 Data 폴더 기준 경로를 뜻한다.
    const targetDir = `worlds/${game.world.id}/dw-critical-cutin`;
    await ensureUploadDirectory(targetDir);

    let response;
    try {
      response = await FilePicker.upload('data', targetDir, file, {}, { notify: false });
    } catch (err) {
      console.error('dw-critical-cutin | 컷인 이미지 업로드 실패', err);
      response = null;
    }

    if (!response?.path) {
      ui.notifications.error('컷인 이미지 업로드에 실패했습니다.');
      this._setStatus('업로드 실패. 콘솔(F12) 로그를 확인해주세요.');
      return;
    }

    await this.actor.setFlag(MODULE_ID, 'image', response.path);
    ui.notifications.info(`"${this.actor.name}"의 컷인 이미지로 저장했습니다.`);
    this.close();
  }
}

/** 이미 폴더가 있으면 FilePicker.createDirectory가 에러를 던지므로 무시한다. */
async function ensureUploadDirectory(dirPath) {
  try {
    await FilePicker.createDirectory('data', dirPath);
  } catch (err) {
    // 폴더가 이미 있는 경우가 대부분이라 조용히 넘어간다.
  }
}

/** 파일 시스템에서 문제될 수 있는 문자를 정리한다. */
function sanitizeFileName(name) {
  const cleaned = (name ?? '').replace(/[\\/:*?"<>|]/g, '').trim().replace(/\s+/g, '-');
  return cleaned || 'actor';
}
