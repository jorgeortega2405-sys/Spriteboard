import { API_ROUTES } from '../config/api-routes.js';
import { currentUser, deleteApi, getApi, patchApi, postApi } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { renderIcons } from '../services/icon.service.js';
import { showToast } from '../services/toast.service.js';
import { sendCanvasAction } from '../services/websocket.service.js';
import { CanvasComment, CanvasCommentReply, CreateCommentDto, UpdateCommentDto } from '../types/canvas-comment.types.js';
import { SearchUserResult } from '../types/canvas.types.js';

const AVATAR_COLORS = [
  '#e11d48', '#d97706', '#059669', '#2563eb', '#7c3aed', '#db2777', '#0891b2', '#ea580c'
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 45) return 'en unos segundos';
  if (diffSec < 90) return 'hace 1 min';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays} d`;
  return date.toLocaleDateString();
}

function formatCommentText(content: string): string {
  let safe = escapeHtml(content);
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/@([a-zA-Z0-9_.-]+)/g, '<span class="canvas-comment-mention">@$1</span>');
  safe = safe.replace(/!\[(.*?)\]\((data:image\/[^;]+;base64,[^)]+)\)/g, '<div class="canvas-comment-attachment"><img class="canvas-comment-attachment__img" src="$2" alt="$1" /></div>');
  safe = safe.replace(/\n/g, '<br />');
  return safe;
}

const EMOJI_CATEGORIES: Record<string, string[]> = {
  recent: ['😄', '❤️', '👍', '🔥', '🎉', '✨', '🚀', '👀', '💯', '🙌', '👏', '😍'],
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
    '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
    '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
    '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
    '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👻', '👽',
    '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿', '😾', '👋', '🤚', '🖐️', '✋', '🖖',
    '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍'
  ],
  animals: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔',
    '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞',
    '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡',
    '🐠', '🐟', '🐬', '🐳', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫',
    '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🐈', '🐓'
  ],
  food: [
    '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
    '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠',
    '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴',
    '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🥫', '🍝',
    '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡',
    '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜'
  ],
  travel: [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🛴', '🚲',
    '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄',
    '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '🚁', '🛩️', '✈️', '🛫', '🛬', '🪂', '💺', '🛰️', '🚀',
    '🛸', '⛵', '🚤', '🛥️', '🚢', '⚓', '🚧', '⛽', '🏁', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡',
    '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🏕️', '⛺', '🏠', '🏡', '🏢', '🏬'
  ],
  activities: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍',
    '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌',
    '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽',
    '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫', '🎟️', '🎪', '🤹',
    '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '🎮'
  ],
  objects: [
    '💡', '🔦', '🏮', '🪔', '🧱', '🪜', '🧰', '🪛', '🔧', '🔨', '🛠️', '⛏️', '🪚', '⚙️', '🧲', '💣',
    '🛡️', '🔮', '🧿', '💈', '🔭', '🔬', '🩹', '🩺', '💊', '💉', '🧹', '🧺', '🧻', '🚿', '🛀', '🧼',
    '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🖼️', '🪞', '🛍️', '🛒', '🎁', '🎈', '🎀', '🪄', '🎉',
    '✉️', '📩', '📦', '🏷️', '🪙', '💰', '💳', '💎', '⚖️', '📱', '💻', '⌨️', '🖥️', '🖨️', '📷', '📸',
    '📹', '🎥', '📞', '📺', '📻', '🎙️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '🔋', '🔌', '🧯'
  ],
  symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🤎', '🖤', '🤍', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
    '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
    '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '☢️', '☣️', '💯', '💢',
    '♨️', '⚠️', '🚸', '🔱', '🔰', '♻️', '✅', '❇️', '✳️', '❎', '🌐', '💠', '💤', '🏧', '♿', '🅿️',
    '🚹', '🚺', '🚻', '🚼', '🚮', '🎦', '📶', '🆗', '🆙', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣'
  ],
  flags: [
    '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇷', '🇧🇴', '🇧🇷', '🇨🇱', '🇨🇴', '🇨🇷', '🇨🇺', '🇩🇴',
    '🇪🇨', '🇸🇻', '🇪🇸', '🇬🇹', '🇭🇳', '🇲🇽', '🇳🇮', '🇵🇦', '🇵🇾', '🇵🇪', '🇵🇷', '🇺🇾', '🇻🇪', '🇺🇸', '🇨🇦', '🇬🇧',
    '🇫🇷', '🇩🇪', '🇮🇹', '🇯🇵', '🇰🇷', '🇨🇳'
  ]
};

const SKIN_TONE_MODIFIERS: Record<string, string> = {
  '': '',
  '🏻': '\u{1F3FB}',
  '🏼': '\u{1F3FC}',
  '🏽': '\u{1F3FD}',
  '🏾': '\u{1F3FE}',
  '🏿': '\u{1F3FF}'
};

export interface CanvasCommentsConfig {
  canvasUuid: string;
  container: HTMLElement;
  getCanvasTransform: () => { height: number; panX: number; panY: number; width: number; zoom: number };
  getCurrentFrameIndex: () => number;
  onRequestRedraw: () => void;
}

export class CanvasCommentsController {
  private abortController = new AbortController();
  private activeEmojiCategory = 'recent';
  private activeEmojiTarget: 'composer' | 'reply' = 'composer';
  private activeThread: CanvasComment | null = null;
  private activeThreadIndex = 0;
  private canvasUuid: string;
  private comments: CanvasComment[] = [];
  private container: HTMLElement;
  private filterMode: 'all' | 'current_page' = 'current_page';
  private getCanvasTransform: () => { height: number; panX: number; panY: number; width: number; zoom: number };
  private getCurrentFrameIndex: () => number;
  private isPlacingComment = false;
  private onRequestRedraw: () => void;
  private pendingPinPos: { x: number; y: number } | null = null;
  private recentEmojis: string[] = ['😄', '❤️', '👍', '🔥', '🎉', '✨', '🚀', '👀', '💯', '🙌'];
  private selectedSkinTone = '';

  private btnToggleComments: HTMLButtonElement | null = null;
  private commentsLayer: HTMLElement | null = null;
  private commentsPanel: HTMLElement | null = null;
  private composerCard: HTMLElement | null = null;
  private emojiPicker: HTMLElement | null = null;
  private threadCard: HTMLElement | null = null;

  private inputComposerContent: HTMLTextAreaElement | null = null;
  private btnComposerSend: HTMLButtonElement | null = null;
  private composerMentionsPopup: HTMLElement | null = null;
  private inputComposerImageFile: HTMLInputElement | null = null;

  private inputReplyContent: HTMLTextAreaElement | null = null;
  private btnReplySend: HTMLButtonElement | null = null;
  private replyMentionsPopup: HTMLElement | null = null;
  private inputReplyImageFile: HTMLInputElement | null = null;

  private threadOptionsMenu: HTMLElement | null = null;
  private commentsFilterMenu: HTMLElement | null = null;

  constructor(config: CanvasCommentsConfig) {
    this.canvasUuid = config.canvasUuid;
    this.container = config.container;
    this.getCanvasTransform = config.getCanvasTransform;
    this.getCurrentFrameIndex = config.getCurrentFrameIndex;
    this.onRequestRedraw = config.onRequestRedraw;
  }

  public async init(): Promise<void> {
    this.queryElements();
    this.bindEvents();
    this.initRecentEmojis();
    await this.fetchComments();
    this.renderPins();
  }

  private queryElements(): void {
    this.btnToggleComments = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-canvas-comments"]');
    this.commentsLayer = this.container.querySelector<HTMLElement>('[data-ref="canvas-comments-layer"]');
    this.commentsPanel = this.container.querySelector<HTMLElement>('[data-ref="canvas-comments-panel"]');
    this.composerCard = this.container.querySelector<HTMLElement>('[data-ref="canvas-comment-composer"]');
    this.threadCard = this.container.querySelector<HTMLElement>('[data-ref="canvas-comment-thread"]');
    this.emojiPicker = this.container.querySelector<HTMLElement>('[data-ref="canvas-emoji-picker"]');

    this.inputComposerContent = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-comment-content"]');
    this.btnComposerSend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-send"]');
    this.composerMentionsPopup = this.container.querySelector<HTMLElement>('[data-ref="comment-mentions-popup"]');
    this.inputComposerImageFile = this.container.querySelector<HTMLInputElement>('[data-ref="input-composer-image-file"]');

    this.inputReplyContent = this.container.querySelector<HTMLTextAreaElement>('[data-ref="input-reply-content"]');
    this.btnReplySend = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-send"]');
    this.replyMentionsPopup = this.container.querySelector<HTMLElement>('[data-ref="reply-mentions-popup"]');
    this.inputReplyImageFile = this.container.querySelector<HTMLInputElement>('[data-ref="input-reply-image-file"]');

    this.threadOptionsMenu = this.container.querySelector<HTMLElement>('[data-ref="thread-options-menu"]');
    this.commentsFilterMenu = this.container.querySelector<HTMLElement>('[data-ref="comments-filter-menu"]');
  }

  private initRecentEmojis(): void {
    try {
      const stored = localStorage.getItem('spriteboard_recent_emojis');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.recentEmojis = parsed.slice(0, 16);
          EMOJI_CATEGORIES.recent = this.recentEmojis;
        }
      }
    } catch {
      // Ignorar fallback silencioso
    }
  }

  private bindEvents(): void {
    const signal = this.abortController.signal;

    if (this.btnToggleComments) {
      this.btnToggleComments.addEventListener('click', () => {
        this.toggleCommentsPanel();
      }, { signal });
    }

    const btnClosePanel = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-comments-panel"]');
    if (btnClosePanel) {
      btnClosePanel.addEventListener('click', () => {
        this.hideCommentsPanel();
      }, { signal });
    }

    const btnPanelAddComment = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-panel-add-comment"]');
    if (btnPanelAddComment) {
      btnPanelAddComment.addEventListener('click', () => {
        this.startPlacingComment();
      }, { signal });
    }

    const btnFilter = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-comments-filter"]');
    if (btnFilter && this.commentsFilterMenu) {
      btnFilter.addEventListener('click', (e) => {
        e.stopPropagation();
        this.commentsFilterMenu?.classList.toggle('is-hidden');
      }, { signal });
    }

    const btnFilterCurrent = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-filter-current-page"]');
    const btnFilterAll = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-filter-all"]');
    const filterTextEl = this.container.querySelector<HTMLElement>('[data-ref="comments-filter-text"]');

    if (btnFilterCurrent) {
      btnFilterCurrent.addEventListener('click', () => {
        this.filterMode = 'current_page';
        btnFilterCurrent.classList.add('is-active');
        btnFilterAll?.classList.remove('is-active');
        if (filterTextEl) filterTextEl.textContent = 'Página actual';
        this.commentsFilterMenu?.classList.add('is-hidden');
        this.renderPanelList();
        this.renderPins();
      }, { signal });
    }

    if (btnFilterAll) {
      btnFilterAll.addEventListener('click', () => {
        this.filterMode = 'all';
        btnFilterAll.classList.add('is-active');
        btnFilterCurrent?.classList.remove('is-active');
        if (filterTextEl) filterTextEl.textContent = 'Todos los comentarios';
        this.commentsFilterMenu?.classList.add('is-hidden');
        this.renderPanelList();
        this.renderPins();
      }, { signal });
    }

    const btnCloseComposer = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-composer"]');
    if (btnCloseComposer) {
      btnCloseComposer.addEventListener('click', () => {
        this.hideComposer();
      }, { signal });
    }

    if (this.inputComposerContent) {
      this.inputComposerContent.addEventListener('input', () => {
        this.updateSendButtonState(this.inputComposerContent, this.btnComposerSend);
        this.handleMentionInput(this.inputComposerContent!, this.composerMentionsPopup);
      }, { signal });

      this.inputComposerContent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.submitComment();
        }
      }, { signal });
    }

    if (this.btnComposerSend) {
      this.btnComposerSend.addEventListener('click', () => {
        this.submitComment();
      }, { signal });
    }

    const btnComposerMention = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-mention"]');
    if (btnComposerMention && this.inputComposerContent) {
      btnComposerMention.addEventListener('click', () => {
        this.insertTextAtCursor(this.inputComposerContent!, '@');
        this.handleMentionInput(this.inputComposerContent!, this.composerMentionsPopup);
      }, { signal });
    }

    const btnComposerEmoji = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-emoji"]');
    if (btnComposerEmoji) {
      btnComposerEmoji.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleEmojiPicker('composer', btnComposerEmoji);
      }, { signal });
    }

    const btnComposerSticker = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-sticker"]');
    if (btnComposerSticker && this.inputComposerContent) {
      btnComposerSticker.addEventListener('click', () => {
        this.insertTextAtCursor(this.inputComposerContent!, '✨ ');
        this.updateSendButtonState(this.inputComposerContent, this.btnComposerSend);
      }, { signal });
    }

    const btnComposerImage = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-image"]');
    if (btnComposerImage && this.inputComposerImageFile) {
      btnComposerImage.addEventListener('click', () => {
        this.inputComposerImageFile?.click();
      }, { signal });

      this.inputComposerImageFile.addEventListener('change', () => {
        this.handleImageUpload(this.inputComposerImageFile, this.inputComposerContent, this.btnComposerSend);
      }, { signal });
    }

    const btnComposerBold = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-composer-bold"]');
    if (btnComposerBold && this.inputComposerContent) {
      btnComposerBold.addEventListener('click', () => {
        this.toggleBoldFormatting(this.inputComposerContent!);
        this.updateSendButtonState(this.inputComposerContent, this.btnComposerSend);
      }, { signal });
    }

    const btnThreadBack = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-back"]');
    if (btnThreadBack) {
      btnThreadBack.addEventListener('click', () => {
        this.threadCard?.classList.add('is-hidden');
        this.showCommentsPanel();
      }, { signal });
    }

    const btnCloseThread = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-close-thread"]');
    if (btnCloseThread) {
      btnCloseThread.addEventListener('click', () => {
        this.hideThread();
      }, { signal });
    }

    const btnThreadPrev = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-prev"]');
    if (btnThreadPrev) {
      btnThreadPrev.addEventListener('click', () => {
        this.navigateThread(-1);
      }, { signal });
    }

    const btnThreadNext = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-next"]');
    if (btnThreadNext) {
      btnThreadNext.addEventListener('click', () => {
        this.navigateThread(1);
      }, { signal });
    }

    const btnThreadOptions = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-options"]');
    if (btnThreadOptions && this.threadOptionsMenu) {
      btnThreadOptions.addEventListener('click', (e) => {
        e.stopPropagation();
        this.threadOptionsMenu?.classList.toggle('is-hidden');
      }, { signal });
    }

    const btnThreadResolve = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-resolve"]');
    if (btnThreadResolve) {
      btnThreadResolve.addEventListener('click', () => {
        this.toggleActiveThreadResolve();
      }, { signal });
    }

    const btnThreadDelete = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-thread-delete"]');
    if (btnThreadDelete) {
      btnThreadDelete.addEventListener('click', () => {
        this.deleteActiveThread();
      }, { signal });
    }

    if (this.inputReplyContent) {
      this.inputReplyContent.addEventListener('input', () => {
        this.updateSendButtonState(this.inputReplyContent, this.btnReplySend);
        this.handleMentionInput(this.inputReplyContent!, this.replyMentionsPopup);
      }, { signal });

      this.inputReplyContent.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          this.submitReply();
        }
      }, { signal });
    }

    if (this.btnReplySend) {
      this.btnReplySend.addEventListener('click', () => {
        this.submitReply();
      }, { signal });
    }

    const btnReplyMention = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-mention"]');
    if (btnReplyMention && this.inputReplyContent) {
      btnReplyMention.addEventListener('click', () => {
        this.insertTextAtCursor(this.inputReplyContent!, '@');
        this.handleMentionInput(this.inputReplyContent!, this.replyMentionsPopup);
      }, { signal });
    }

    const btnReplyEmoji = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-emoji"]');
    if (btnReplyEmoji) {
      btnReplyEmoji.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleEmojiPicker('reply', btnReplyEmoji);
      }, { signal });
    }

    const btnReplySticker = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-sticker"]');
    if (btnReplySticker && this.inputReplyContent) {
      btnReplySticker.addEventListener('click', () => {
        this.insertTextAtCursor(this.inputReplyContent!, '✨ ');
        this.updateSendButtonState(this.inputReplyContent, this.btnReplySend);
      }, { signal });
    }

    const btnReplyImage = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-image"]');
    if (btnReplyImage && this.inputReplyImageFile) {
      btnReplyImage.addEventListener('click', () => {
        this.inputReplyImageFile?.click();
      }, { signal });

      this.inputReplyImageFile.addEventListener('change', () => {
        this.handleImageUpload(this.inputReplyImageFile, this.inputReplyContent, this.btnReplySend);
      }, { signal });
    }

    const btnReplyBold = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-reply-bold"]');
    if (btnReplyBold && this.inputReplyContent) {
      btnReplyBold.addEventListener('click', () => {
        this.toggleBoldFormatting(this.inputReplyContent!);
        this.updateSendButtonState(this.inputReplyContent, this.btnReplySend);
      }, { signal });
    }

    this.bindEmojiPickerEvents();

    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (this.commentsFilterMenu && !this.commentsFilterMenu.classList.contains('is-hidden') && !target.closest('[data-ref="comments-filter-dropdown"]')) {
        this.commentsFilterMenu.classList.add('is-hidden');
      }
      if (this.threadOptionsMenu && !this.threadOptionsMenu.classList.contains('is-hidden') && !target.closest('[data-ref="thread-options-menu"]') && !target.closest('[data-ref="btn-thread-options"]')) {
        this.threadOptionsMenu.classList.add('is-hidden');
      }
      if (this.emojiPicker && !this.emojiPicker.classList.contains('is-hidden') && !target.closest('[data-ref="canvas-emoji-picker"]') && !target.closest('[data-ref="btn-composer-emoji"]') && !target.closest('[data-ref="btn-reply-emoji"]')) {
        this.hideEmojiPicker();
      }
      if (this.composerMentionsPopup && !this.composerMentionsPopup.classList.contains('is-hidden') && !target.closest('[data-ref="comment-mentions-popup"]')) {
        this.composerMentionsPopup.classList.add('is-hidden');
      }
      if (this.replyMentionsPopup && !this.replyMentionsPopup.classList.contains('is-hidden') && !target.closest('[data-ref="reply-mentions-popup"]')) {
        this.replyMentionsPopup.classList.add('is-hidden');
      }
    }, { signal });
  }

  private bindEmojiPickerEvents(): void {
    const signal = this.abortController.signal;
    const inputSearch = this.container.querySelector<HTMLInputElement>('[data-ref="input-emoji-search"]');
    if (inputSearch) {
      inputSearch.addEventListener('input', () => {
        this.renderEmojiContent(inputSearch.value.trim());
      }, { signal });
    }

    const tabButtons = this.container.querySelectorAll<HTMLButtonElement>('.canvas-emoji-tab');
    tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.activeEmojiCategory = btn.getAttribute('data-category') || 'smileys';
        if (inputSearch) inputSearch.value = '';
        this.renderEmojiContent();
      }, { signal });
    });

    const btnSkinTone = this.container.querySelector<HTMLButtonElement>('[data-ref="btn-emoji-skintone"]');
    const skinToneMenu = this.container.querySelector<HTMLElement>('[data-ref="emoji-skintone-menu"]');
    if (btnSkinTone && skinToneMenu) {
      btnSkinTone.addEventListener('click', (e) => {
        e.stopPropagation();
        skinToneMenu.classList.toggle('is-hidden');
      }, { signal });
    }

    const toneOptions = this.container.querySelectorAll<HTMLButtonElement>('.canvas-skintone-option');
    const handEl = this.container.querySelector<HTMLElement>('[data-ref="emoji-skintone-current-hand"]');
    toneOptions.forEach((opt) => {
      opt.addEventListener('click', () => {
        this.selectedSkinTone = opt.getAttribute('data-tone') || '';
        if (handEl) handEl.textContent = opt.textContent || '✋';
        skinToneMenu?.classList.add('is-hidden');
        this.renderEmojiContent();
      }, { signal });
    });
  }

  public async fetchComments(): Promise<void> {
    try {
      const res = await getApi(API_ROUTES.canvases.comments(this.canvasUuid));
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.comments)) {
          this.comments = data.comments;
          this.renderPanelList();
          this.renderPins();
        }
      }
    } catch {
      // Ignorar fallback silencioso
    }
  }

  public toggleCommentsPanel(): void {
    if (!this.commentsPanel) return;
    const isHidden = this.commentsPanel.classList.contains('is-hidden');
    if (isHidden) {
      this.showCommentsPanel();
    } else {
      this.hideCommentsPanel();
    }
  }

  public showCommentsPanel(): void {
    this.hideComposer();
    this.hideThread();
    this.commentsPanel?.classList.remove('is-hidden');
    this.btnToggleComments?.classList.add('is-active');
    this.renderPanelList();
  }

  public hideCommentsPanel(): void {
    this.commentsPanel?.classList.add('is-hidden');
    this.btnToggleComments?.classList.remove('is-active');
    this.isPlacingComment = false;
    this.removeGhostPin();
  }

  public startPlacingComment(): void {
    this.hideCommentsPanel();
    this.hideThread();
    this.isPlacingComment = true;
    showToast('Haz clic en cualquier parte del lienzo para agregar un comentario.', 'info');
  }

  public onCanvasPointerDown(canvasX: number, canvasY: number, screenX: number, screenY: number): boolean {
    if (!this.isPlacingComment) return false;
    this.isPlacingComment = false;
    this.removeGhostPin();

    this.pendingPinPos = { x: Math.round(canvasX), y: Math.round(canvasY) };
    this.openComposerAtPosition(screenX, screenY);
    return true;
  }

  public onCanvasPointerMove(screenX: number, screenY: number): void {
    if (!this.isPlacingComment || !this.commentsLayer) return;
    let ghost = this.commentsLayer.querySelector<HTMLElement>('[data-ref="canvas-ghost-pin"]');
    if (!ghost) {
      ghost = document.createElement('div');
      ghost.className = 'canvas-comment-pin canvas-comment-pin--ghost';
      ghost.setAttribute('data-ref', 'canvas-ghost-pin');
      ghost.innerHTML = '<span class="material-symbols-rounded">chat_bubble</span>';
      renderIcons(ghost);
      this.commentsLayer.appendChild(ghost);
    }
    ghost.style.left = `${screenX}px`;
    ghost.style.top = `${screenY}px`;
  }

  private removeGhostPin(): void {
    const ghost = this.commentsLayer?.querySelector('[data-ref="canvas-ghost-pin"]');
    ghost?.remove();
  }

  public openComposerAtPosition(screenX: number, screenY: number): void {
    if (!this.composerCard) return;
    this.hideCommentsPanel();
    this.hideThread();

    if (this.inputComposerContent) {
      this.inputComposerContent.value = '';
      this.updateSendButtonState(this.inputComposerContent, this.btnComposerSend);
    }

    this.composerCard.classList.remove('is-hidden');

    const cardWidth = 340;
    const cardHeight = 160;
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    let posX = screenX + 16;
    let posY = screenY - 20;

    if (posX + cardWidth > winW - 20) {
      posX = screenX - cardWidth - 16;
    }
    if (posY + cardHeight > winH - 60) {
      posY = winH - cardHeight - 70;
    }
    if (posX < 20) posX = 20;
    if (posY < 70) posY = 70;

    this.composerCard.style.left = `${posX}px`;
    this.composerCard.style.top = `${posY}px`;

    setTimeout(() => {
      this.inputComposerContent?.focus();
    }, 50);
  }

  public hideComposer(): void {
    this.composerCard?.classList.add('is-hidden');
    this.hideEmojiPicker();
    this.pendingPinPos = null;
    this.removeGhostPin();
  }

  private async submitComment(): Promise<void> {
    if (!this.inputComposerContent) return;
    const content = this.inputComposerContent.value.trim();
    if (!content) return;

    const frameIndex = this.getCurrentFrameIndex();
    const posX = this.pendingPinPos ? this.pendingPinPos.x : null;
    const posY = this.pendingPinPos ? this.pendingPinPos.y : null;

    try {
      const payload: CreateCommentDto = {
        content,
        frameIndex,
        posX: posX !== null ? posX : undefined,
        posY: posY !== null ? posY : undefined
      };

      const res = await postApi(
        API_ROUTES.canvases.comments(this.canvasUuid),
        payload
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.comment) {
          this.comments.unshift(data.comment);
          sendCanvasAction(this.canvasUuid, 'comment_created', { comment: data.comment });
          this.hideComposer();
          this.renderPins();
          this.renderPanelList();
          this.openThread(data.comment);
          showToast('Comentario publicado', 'success');
        }
      }
    } catch {
      showToast('No se pudo enviar el comentario. Intenta de nuevo.', 'error');
    }
  }

  public openThread(comment: CanvasComment): void {
    this.activeThread = comment;
    this.hideCommentsPanel();
    this.hideComposer();

    const filtered = this.getFilteredComments();
    this.activeThreadIndex = filtered.findIndex((c) => c.uuid === comment.uuid);
    if (this.activeThreadIndex === -1) this.activeThreadIndex = 0;

    this.renderThreadView();
    this.threadCard?.classList.remove('is-hidden');

    if (comment.pos_x !== null && comment.pos_y !== null) {
      const transform = this.getCanvasTransform();
      const screenX = transform.panX + comment.pos_x * transform.zoom;
      const screenY = transform.panY + comment.pos_y * transform.zoom;

      const cardWidth = 340;
      const cardHeight = 320;
      const winW = window.innerWidth;
      const winH = window.innerHeight;

      let posX = screenX + 24;
      let posY = screenY - 20;

      if (posX + cardWidth > winW - 20) posX = screenX - cardWidth - 24;
      if (posY + cardHeight > winH - 60) posY = winH - cardHeight - 70;
      if (posX < 20) posX = 20;
      if (posY < 70) posY = 70;

      if (this.threadCard) {
        this.threadCard.style.left = `${posX}px`;
        this.threadCard.style.top = `${posY}px`;
      }
    } else {
      if (this.threadCard) {
        this.threadCard.style.right = '24px';
        this.threadCard.style.top = '70px';
        this.threadCard.style.left = 'auto';
      }
    }

    this.highlightPin(comment.uuid);
  }

  public hideThread(): void {
    this.threadCard?.classList.add('is-hidden');
    this.hideEmojiPicker();
    this.activeThread = null;
    this.highlightPin(null);
  }

  private navigateThread(direction: number): void {
    const filtered = this.getFilteredComments();
    if (filtered.length === 0) return;

    let newIndex = this.activeThreadIndex + direction;
    if (newIndex < 0) newIndex = filtered.length - 1;
    if (newIndex >= filtered.length) newIndex = 0;

    const nextComment = filtered[newIndex];
    if (nextComment) {
      this.openThread(nextComment);
    }
  }

  private renderThreadView(): void {
    if (!this.activeThread || !this.threadCard) return;

    const filtered = this.getFilteredComments();
    const pagerText = this.threadCard.querySelector('[data-ref="thread-pager-text"]');
    if (pagerText) {
      pagerText.textContent = `${this.activeThreadIndex + 1}/${filtered.length || 1}`;
    }

    const mainContainer = this.threadCard.querySelector<HTMLElement>('[data-ref="thread-main-comment"]');
    if (mainContainer) {
      const author = this.activeThread.author;
      const bg = getAvatarColor(author.username || 'User');
      const avatarHtml = author.avatar_url
        ? `<img class="canvas-comment-avatar" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username)}" />`
        : `<div class="canvas-comment-avatar canvas-comment-avatar--initials" style="background-color: ${bg};">${escapeHtml(author.initials || 'U')}</div>`;

      mainContainer.innerHTML = `
        <div class="canvas-comment-header">
          ${avatarHtml}
          <div class="canvas-comment-meta">
            <span class="canvas-comment-author">${escapeHtml(author.username)}</span>
            <span class="canvas-comment-time">${formatRelativeTime(this.activeThread.created_at)}</span>
          </div>
        </div>
        <div class="canvas-comment-body">
          ${formatCommentText(this.activeThread.content)}
        </div>
      `;
    }

    const repliesList = this.threadCard.querySelector<HTMLElement>('[data-ref="thread-replies-list"]');
    if (repliesList) {
      repliesList.innerHTML = '';
      const replies = this.activeThread.replies || [];
      replies.forEach((reply) => {
        const item = document.createElement('div');
        item.className = 'canvas-comment-reply-item';
        item.setAttribute('data-ref', `reply-${reply.uuid}`);

        const repAuthor = reply.author;
        const repBg = getAvatarColor(repAuthor.username || 'User');
        const repAvatarHtml = repAuthor.avatar_url
          ? `<img class="canvas-comment-avatar canvas-comment-avatar--sm" src="${escapeHtml(repAuthor.avatar_url)}" alt="${escapeHtml(repAuthor.username)}" />`
          : `<div class="canvas-comment-avatar canvas-comment-avatar--sm canvas-comment-avatar--initials" style="background-color: ${repBg};">${escapeHtml(repAuthor.initials || 'U')}</div>`;

        item.innerHTML = `
          <div class="canvas-comment-header">
            ${repAvatarHtml}
            <div class="canvas-comment-meta">
              <span class="canvas-comment-author">${escapeHtml(repAuthor.username)}</span>
              <span class="canvas-comment-time">${formatRelativeTime(reply.created_at)}</span>
            </div>
          </div>
          <div class="canvas-comment-body">
            ${formatCommentText(reply.content)}
          </div>
        `;
        repliesList.appendChild(item);
      });
    }

    const resolveText = this.threadCard.querySelector('[data-ref="thread-resolve-text"]');
    if (resolveText) {
      resolveText.textContent = this.activeThread.status === 'resolved' ? 'Reabrir comentario' : 'Resolver comentario';
    }

    if (this.inputReplyContent) {
      this.inputReplyContent.value = '';
      this.updateSendButtonState(this.inputReplyContent, this.btnReplySend);
    }
  }

  private async submitReply(): Promise<void> {
    if (!this.activeThread || !this.inputReplyContent) return;
    const content = this.inputReplyContent.value.trim();
    if (!content) return;

    try {
      const payload: CreateCommentDto = {
        content,
        parentId: this.activeThread.uuid
      };

      const res = await postApi(
        API_ROUTES.canvases.comments(this.canvasUuid),
        payload
      );

      if (res.ok) {
        const data = await res.json();
        if (data && data.comment) {
          if (!this.activeThread.replies) this.activeThread.replies = [];
          this.activeThread.replies.push(data.comment);
          sendCanvasAction(this.canvasUuid, 'comment_created', { comment: data.comment, parentUuid: this.activeThread.uuid });
          this.renderThreadView();
          this.renderPanelList();
          this.renderPins();
          showToast('Respuesta enviada', 'success');
        }
      }
    } catch {
      showToast('No se pudo enviar la respuesta.', 'error');
    }
  }

  private async toggleActiveThreadResolve(): Promise<void> {
    if (!this.activeThread) return;
    const newStatus: 'open' | 'resolved' = this.activeThread.status === 'resolved' ? 'open' : 'resolved';

    try {
      await patchApi(API_ROUTES.canvases.commentById(this.canvasUuid, this.activeThread.uuid), {
        status: newStatus
      });
      this.activeThread.status = newStatus;
      sendCanvasAction(this.canvasUuid, 'comment_updated', {
        commentUuid: this.activeThread.uuid,
        status: newStatus
      });
      this.threadOptionsMenu?.classList.add('is-hidden');
      this.renderThreadView();
      this.renderPanelList();
      this.renderPins();
      showToast(newStatus === 'resolved' ? 'Comentario resuelto' : 'Comentario reabierto', 'success');
    } catch {
      showToast('No se pudo actualizar el estado del comentario.', 'error');
    }
  }

  private async deleteActiveThread(): Promise<void> {
    if (!this.activeThread) return;
    const threadUuid = this.activeThread.uuid;

    try {
      await deleteApi(API_ROUTES.canvases.commentById(this.canvasUuid, threadUuid));
      this.comments = this.comments.filter((c) => c.uuid !== threadUuid);
      sendCanvasAction(this.canvasUuid, 'comment_deleted', { commentUuid: threadUuid });
      this.threadOptionsMenu?.classList.add('is-hidden');
      this.hideThread();
      this.renderPanelList();
      this.renderPins();
      showToast('Comentario eliminado', 'info');
    } catch {
      showToast('No se pudo eliminar el comentario.', 'error');
    }
  }

  private getFilteredComments(): CanvasComment[] {
    if (this.filterMode === 'all') {
      return this.comments;
    }
    const currentFrame = this.getCurrentFrameIndex();
    return this.comments.filter((c) => c.frame_index === currentFrame);
  }

  public renderPanelList(): void {
    if (!this.commentsPanel) return;

    const listEl = this.commentsPanel.querySelector<HTMLElement>('[data-ref="comments-list"]');
    const emptyEl = this.commentsPanel.querySelector<HTMLElement>('[data-ref="comments-empty-state"]');
    const emptyTextEl = this.commentsPanel.querySelector<HTMLElement>('[data-ref="comments-empty-text"]');

    if (!listEl || !emptyEl) return;

    const filtered = this.getFilteredComments();

    if (filtered.length === 0) {
      listEl.classList.add('is-hidden');
      emptyEl.classList.remove('is-hidden');
      if (emptyTextEl) {
        emptyTextEl.textContent = this.filterMode === 'all'
          ? 'No hay comentarios en este lienzo.'
          : 'No hay comentarios en esta página.';
      }
      return;
    }

    emptyEl.classList.add('is-hidden');
    listEl.classList.remove('is-hidden');
    listEl.innerHTML = '';

    filtered.forEach((comment) => {
      const card = document.createElement('div');
      card.className = `canvas-comments-panel__item ${comment.status === 'resolved' ? 'is-resolved' : ''}`;
      card.setAttribute('data-ref', `panel-comment-${comment.uuid}`);

      const author = comment.author;
      const bg = getAvatarColor(author.username || 'User');
      const avatarHtml = author.avatar_url
        ? `<img class="canvas-comment-avatar canvas-comment-avatar--sm" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username)}" />`
        : `<div class="canvas-comment-avatar canvas-comment-avatar--sm canvas-comment-avatar--initials" style="background-color: ${bg};">${escapeHtml(author.initials || 'U')}</div>`;

      const repliesCount = comment.replies?.length || comment.reply_count || 0;
      const repliesBadge = repliesCount > 0
        ? `<span class="canvas-comment-reply-badge"><span class="material-symbols-rounded">chat_bubble</span>${repliesCount}</span>`
        : '';

      card.innerHTML = `
        <div class="canvas-comment-panel-row">
          ${avatarHtml}
          <div class="canvas-comment-panel-info">
            <div class="canvas-comment-panel-meta">
              <span class="canvas-comment-panel-author">${escapeHtml(author.username)}</span>
              <span class="canvas-comment-panel-time">${formatRelativeTime(comment.created_at)}</span>
            </div>
            <div class="canvas-comment-panel-snippet">${escapeHtml(comment.content)}</div>
            ${repliesBadge}
          </div>
        </div>
      `;

      card.addEventListener('click', () => {
        this.openThread(comment);
      });

      listEl.appendChild(card);
    });

    renderIcons(listEl);
  }

  public renderPins(): void {
    if (!this.commentsLayer) return;
    this.commentsLayer.innerHTML = '';

    const filtered = this.getFilteredComments();
    const transform = this.getCanvasTransform();

    filtered.forEach((comment, idx) => {
      if (comment.pos_x === null || comment.pos_y === null) return;

      const screenX = transform.panX + comment.pos_x * transform.zoom;
      const screenY = transform.panY + comment.pos_y * transform.zoom;

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `canvas-comment-pin ${comment.status === 'resolved' ? 'is-resolved' : ''} ${this.activeThread?.uuid === comment.uuid ? 'is-active' : ''}`;
      pin.setAttribute('data-ref', `pin-${comment.uuid}`);
      pin.setAttribute('data-tooltip', `${comment.author.username}: ${comment.content.slice(0, 30)}`);
      pin.style.left = `${screenX}px`;
      pin.style.top = `${screenY}px`;

      const author = comment.author;
      const bg = getAvatarColor(author.username || 'User');
      if (author.avatar_url) {
        pin.innerHTML = `<img class="canvas-comment-pin__img" src="${escapeHtml(author.avatar_url)}" alt="${escapeHtml(author.username)}" />`;
      } else {
        pin.style.backgroundColor = bg;
        pin.innerHTML = `<span class="canvas-comment-pin__initials">${escapeHtml(author.initials || `${idx + 1}`)}</span>`;
      }

      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openThread(comment);
      });

      this.commentsLayer?.appendChild(pin);
    });
  }

  public updatePinPositions(panX: number, panY: number, zoom: number): void {
    if (!this.commentsLayer) return;

    const filtered = this.getFilteredComments();
    filtered.forEach((comment) => {
      if (comment.pos_x === null || comment.pos_y === null) return;
      const pin = this.commentsLayer?.querySelector<HTMLElement>(`[data-ref="pin-${comment.uuid}"]`);
      if (pin) {
        const screenX = panX + comment.pos_x * zoom;
        const screenY = panY + comment.pos_y * zoom;
        pin.style.left = `${screenX}px`;
        pin.style.top = `${screenY}px`;
      }
    });

    if (this.pendingPinPos && this.composerCard && !this.composerCard.classList.contains('is-hidden')) {
      const screenX = panX + this.pendingPinPos.x * zoom;
      const screenY = panY + this.pendingPinPos.y * zoom;
      let posX = screenX + 16;
      let posY = screenY - 20;
      this.composerCard.style.left = `${posX}px`;
      this.composerCard.style.top = `${posY}px`;
    }
  }

  private highlightPin(uuid: string | null): void {
    if (!this.commentsLayer) return;
    const pins = this.commentsLayer.querySelectorAll('.canvas-comment-pin');
    pins.forEach((p) => p.classList.remove('is-active'));
    if (uuid) {
      const activePin = this.commentsLayer.querySelector(`[data-ref="pin-${uuid}"]`);
      activePin?.classList.add('is-active');
    }
  }

  public handleRemoteCommentAction(action: string, payload: any): void {
    if (action === 'comment_created') {
      const newComment = payload.comment;
      if (!newComment) return;

      if (payload.parentUuid) {
        const parent = this.comments.find((c) => c.uuid === payload.parentUuid);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          if (!parent.replies.some((r) => r.uuid === newComment.uuid)) {
            parent.replies.push(newComment);
          }
        }
      } else {
        if (!this.comments.some((c) => c.uuid === newComment.uuid)) {
          this.comments.unshift(newComment);
        }
      }

      this.renderPins();
      this.renderPanelList();
      if (this.activeThread && (this.activeThread.uuid === newComment.uuid || this.activeThread.uuid === payload.parentUuid)) {
        this.renderThreadView();
      }
    } else if (action === 'comment_updated') {
      const commentUuid = payload.commentUuid;
      const target = this.comments.find((c) => c.uuid === commentUuid);
      if (target) {
        if (payload.status) target.status = payload.status;
        if (payload.content) target.content = payload.content;
      }
      this.renderPins();
      this.renderPanelList();
      if (this.activeThread && this.activeThread.uuid === commentUuid) {
        this.renderThreadView();
      }
    } else if (action === 'comment_deleted') {
      const commentUuid = payload.commentUuid;
      this.comments = this.comments.filter((c) => c.uuid !== commentUuid);
      this.renderPins();
      this.renderPanelList();
      if (this.activeThread && this.activeThread.uuid === commentUuid) {
        this.hideThread();
      }
    }
  }

  private toggleEmojiPicker(target: 'composer' | 'reply', anchorBtn: HTMLElement): void {
    if (!this.emojiPicker) return;
    const isVisible = !this.emojiPicker.classList.contains('is-hidden') && this.activeEmojiTarget === target;
    if (isVisible) {
      this.hideEmojiPicker();
    } else {
      this.showEmojiPicker(target, anchorBtn);
    }
  }

  private showEmojiPicker(target: 'composer' | 'reply', anchorBtn: HTMLElement): void {
    if (!this.emojiPicker) return;
    this.activeEmojiTarget = target;
    this.emojiPicker.classList.remove('is-hidden');
    anchorBtn.classList.add('is-active');

    this.renderEmojiContent();

    const parent = target === 'composer' ? this.composerCard : this.threadCard;
    if (parent) {
      parent.appendChild(this.emojiPicker);
    }
  }

  private hideEmojiPicker(): void {
    if (!this.emojiPicker) return;
    this.emojiPicker.classList.add('is-hidden');
    const composerEmojiBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-composer-emoji"]');
    const replyEmojiBtn = this.container.querySelector<HTMLElement>('[data-ref="btn-reply-emoji"]');
    composerEmojiBtn?.classList.remove('is-active');
    replyEmojiBtn?.classList.remove('is-active');
  }

  private renderEmojiContent(searchQuery = ''): void {
    const contentEl = this.container.querySelector<HTMLElement>('[data-ref="emoji-picker-content"]');
    if (!contentEl) return;
    contentEl.innerHTML = '';

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const results: string[] = [];
      Object.values(EMOJI_CATEGORIES).forEach((list) => {
        list.forEach((emoji) => {
          if (emoji.includes(q) && !results.includes(emoji)) {
            results.push(emoji);
          }
        });
      });

      const header = document.createElement('div');
      header.className = 'canvas-emoji-section-header';
      header.textContent = `Resultados (${results.length})`;
      contentEl.appendChild(header);

      const grid = document.createElement('div');
      grid.className = 'canvas-emoji-grid';
      results.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'canvas-emoji-btn';
        btn.textContent = emoji;
        btn.addEventListener('click', () => {
          this.insertEmoji(emoji);
        });
        grid.appendChild(btn);
      });
      contentEl.appendChild(grid);
      return;
    }

    if (this.activeEmojiCategory === 'recent') {
      const recentHeader = document.createElement('div');
      recentHeader.className = 'canvas-emoji-section-header';
      recentHeader.textContent = 'Más usados';
      contentEl.appendChild(recentHeader);

      const recentGrid = document.createElement('div');
      recentGrid.className = 'canvas-emoji-grid';
      this.recentEmojis.forEach((emoji) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'canvas-emoji-btn';
        btn.textContent = emoji;
        btn.addEventListener('click', () => {
          this.insertEmoji(emoji);
        });
        recentGrid.appendChild(btn);
      });
      contentEl.appendChild(recentGrid);
    }

    const categoryTitleMap: Record<string, string> = {
      activities: 'Actividades',
      animals: 'Animales y naturaleza',
      flags: 'Banderas',
      food: 'Comida y bebida',
      objects: 'Objetos',
      recent: 'Emojis y personas',
      smileys: 'Emojis y personas',
      symbols: 'Símbolos',
      travel: 'Viajes y lugares'
    };

    const targetCat = this.activeEmojiCategory === 'recent' ? 'smileys' : this.activeEmojiCategory;
    const header = document.createElement('div');
    header.className = 'canvas-emoji-section-header';
    header.textContent = categoryTitleMap[targetCat] || 'Emojis';
    contentEl.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'canvas-emoji-grid';
    const emojis = EMOJI_CATEGORIES[targetCat] || [];
    const modifier = SKIN_TONE_MODIFIERS[this.selectedSkinTone] || '';

    emojis.forEach((emoji) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'canvas-emoji-btn';
      const modifiedEmoji = modifier ? emoji + modifier : emoji;
      btn.textContent = modifiedEmoji;
      btn.addEventListener('click', () => {
        this.insertEmoji(modifiedEmoji);
      });
      grid.appendChild(btn);
    });
    contentEl.appendChild(grid);
  }

  private insertEmoji(emoji: string): void {
    const targetInput = this.activeEmojiTarget === 'composer' ? this.inputComposerContent : this.inputReplyContent;
    const targetSendBtn = this.activeEmojiTarget === 'composer' ? this.btnComposerSend : this.btnReplySend;

    if (targetInput) {
      this.insertTextAtCursor(targetInput, emoji);
      this.updateSendButtonState(targetInput, targetSendBtn);
    }

    this.recentEmojis = [emoji, ...this.recentEmojis.filter((e) => e !== emoji)].slice(0, 16);
    EMOJI_CATEGORIES.recent = this.recentEmojis;
    try {
      localStorage.setItem('spriteboard_recent_emojis', JSON.stringify(this.recentEmojis));
    } catch {
      // Ignorar fallback silencioso
    }

    this.hideEmojiPicker();
  }

  private insertTextAtCursor(input: HTMLTextAreaElement, text: string): void {
    input.focus();
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;
    input.value = val.substring(0, start) + text + val.substring(end);
    input.selectionStart = input.selectionEnd = start + text.length;
  }

  private toggleBoldFormatting(input: HTMLTextAreaElement): void {
    input.focus();
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const val = input.value;
    if (start !== end) {
      const selected = val.substring(start, end);
      input.value = val.substring(0, start) + `**${selected}**` + val.substring(end);
      input.selectionStart = start;
      input.selectionEnd = end + 4;
    } else {
      input.value = val.substring(0, start) + `****` + val.substring(end);
      input.selectionStart = input.selectionEnd = start + 2;
    }
  }

  private updateSendButtonState(input: HTMLTextAreaElement | null, sendBtn: HTMLButtonElement | null): void {
    if (!input || !sendBtn) return;
    const hasText = Boolean(input.value.trim());
    if (hasText) {
      sendBtn.classList.remove('is-disabled');
      sendBtn.disabled = false;
    } else {
      sendBtn.classList.add('is-disabled');
      sendBtn.disabled = true;
    }
  }

  private async handleMentionInput(input: HTMLTextAreaElement, popup: HTMLElement | null): Promise<void> {
    if (!popup) return;
    const val = input.value;
    const cursor = input.selectionStart || 0;
    const beforeCursor = val.slice(0, cursor);
    const match = beforeCursor.match(/@([a-zA-Z0-9_.-]*)$/);

    if (!match) {
      popup.classList.add('is-hidden');
      return;
    }

    const query = match[1];
    try {
      const res = await getApi(API_ROUTES.users.search(query));
      if (res.ok) {
        const data = await res.json();
        const users: SearchUserResult[] = data.users || [];
        if (users.length > 0) {
          popup.innerHTML = '';
          popup.classList.remove('is-hidden');
          users.slice(0, 5).forEach((user: SearchUserResult) => {
          const item = document.createElement('button');
          item.type = 'button';
          item.className = 'canvas-mention-item';
          const bg = getAvatarColor(user.username);
          const avatarHtml = user.avatar_url
            ? `<img class="canvas-comment-avatar canvas-comment-avatar--xs" src="${escapeHtml(user.avatar_url)}" alt="${escapeHtml(user.username)}" />`
            : `<div class="canvas-comment-avatar canvas-comment-avatar--xs canvas-comment-avatar--initials" style="background-color: ${bg};">${escapeHtml(user.username.slice(0, 2).toUpperCase())}</div>`;

          item.innerHTML = `
            ${avatarHtml}
            <span class="canvas-mention-username">@${escapeHtml(user.username)}</span>
          `;

          item.addEventListener('click', () => {
            const prefix = beforeCursor.slice(0, beforeCursor.length - match[0].length);
            const suffix = val.slice(cursor);
            input.value = `${prefix}@${user.username} ${suffix}`;
            input.selectionStart = input.selectionEnd = prefix.length + user.username.length + 2;
            popup.classList.add('is-hidden');
            input.focus();
          });

          popup.appendChild(item);
        });
      } else {
        popup.classList.add('is-hidden');
      }
    } else {
      popup.classList.add('is-hidden');
    }
  } catch {
    popup.classList.add('is-hidden');
  }
  }

  private handleImageUpload(fileInput: HTMLInputElement | null, textarea: HTMLTextAreaElement | null, sendBtn: HTMLButtonElement | null): void {
    if (!fileInput || !fileInput.files || !fileInput.files[0] || !textarea) return;
    const file = fileInput.files[0];
    if (file.size > 2 * 1024 * 1024) {
      showToast('La imagen no debe superar los 2MB.', 'error');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.insertTextAtCursor(textarea, `\n![imagen](${base64})\n`);
      this.updateSendButtonState(textarea, sendBtn);
      fileInput.value = '';
    };
    reader.readAsDataURL(file);
  }

  public destroy(): void {
    this.abortController.abort();
    this.hideComposer();
    this.hideThread();
    this.hideCommentsPanel();
    this.commentsLayer?.replaceChildren();
  }
}
