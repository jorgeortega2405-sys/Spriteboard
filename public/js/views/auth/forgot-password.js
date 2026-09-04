import { loadTemplate } from '../../services/template.js';
import { navigate } from '../../router.js';

export async function createForgotPasswordView() {
  const container = await loadTemplate('/views/auth/forgot-password.html');

  const homeLink = container.querySelector('[data-ref="forgot-home-link"]');
  const toLoginLink = container.querySelector('[data-ref="btn-forgot-to-login"]');
  const submitBtn = container.querySelector('[data-ref="btn-submit-forgot"]');
  const emailInput = container.querySelector('[data-ref="forgot-email"]');

  homeLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  toLoginLink?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/login');
  });

  submitBtn?.addEventListener('click', () => {
    const email = emailInput?.value.trim();
    if (!email) {
      alert('Por favor ingresa tu correo electrónico.');
      return;
    }
    alert(`Instrucciones enviadas a: ${email}`);
    navigate('/login');
  });

  return container;
}
