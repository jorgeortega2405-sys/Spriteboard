import { navigate } from '../app-router.js';
import { currentUser } from '../services/api.service.js';
import { t } from '../services/i18n.service.js';
import { showToast } from '../services/toast.service.js';
import { canPublishTemplates } from '../types/auth.types.js';
import { CanvasItem } from '../types/canvas.types.js';

export interface PublishTemplateModalOptions {
  onSuccess?: () => void;
}

export function openPublishTemplateModal(canvas: CanvasItem, _options?: PublishTemplateModalOptions): void {
  if (!currentUser) {
    showToast(t('templates.login_required_publish') || 'Debes iniciar sesión para publicar una plantilla.', 'error');
    navigate('/login');
    return;
  }

  if (!canPublishTemplates(currentUser)) {
    showToast(t('templates.designer_required') || 'Solo los usuarios con rol de Diseñador pueden publicar plantillas.', 'error');
    navigate('/creators');
    return;
  }

  navigate(`/templates/publish?canvas=${encodeURIComponent(canvas.uuid)}`);
}
