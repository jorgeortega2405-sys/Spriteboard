import { API_ROUTES } from '../config/api-routes.js';
import { LinkedAccount, User } from '../types/auth.types.js';
import { BillingDetailsResponse, PaymentMethod, PurchaseRecord, SubscriptionPlan } from '../types/subscription.types.js';

export { API_ROUTES };

export let currentUser: User | null = null;
export let linkedAccounts: LinkedAccount[] = [];
export let csrfToken = '';
export const appConfig = { appName: 'Spriteboard', stripePublishableKey: '' };

export function setCurrentUser(user: User | null): void {
  currentUser = user;
  if (user && Array.isArray(linkedAccounts)) {
    const idx = linkedAccounts.findIndex((a) => a.id === user.id);
    if (idx >= 0) {
      linkedAccounts[idx] = { ...linkedAccounts[idx], ...user };
    }
  }
}

export function setLinkedAccounts(accounts: LinkedAccount[]): void {
  linkedAccounts = Array.isArray(accounts) ? accounts : [];
}

export function clearUserState(): void {
  currentUser = null;
  linkedAccounts = [];
}

export function escapeHtml(str: unknown): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function fetchAppConfig(): Promise<void> {
  try {
    const res = await fetch(API_ROUTES.config);
    if (res.ok) {
      const data = await res.json();
      if (data.appName) {
        appConfig.appName = data.appName;
        document.title = data.appName;
      }
      if (data.stripePublishableKey) {
        appConfig.stripePublishableKey = data.stripePublishableKey;
      }
    }
  } catch {}
}

export async function fetchCsrfToken(): Promise<string> {
  try {
    const res = await fetch(API_ROUTES.csrfToken);
    if (res.ok) {
      const data = await res.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch {}
  return '';
}

export async function checkAuthSession(): Promise<User | null> {
  try {
    const res = await fetch(API_ROUTES.auth.me);
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user || null;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : (data.user ? [data.user] : []);
    } else {
      currentUser = null;
      linkedAccounts = [];
    }
  } catch {
    currentUser = null;
    linkedAccounts = [];
  }
  return currentUser;
}

export async function switchAccountApi(userId: number): Promise<{ success: boolean; data?: any; error?: string }> {
  const res = await postApi(API_ROUTES.auth.switchAccount, { user_id: userId });
  if (res.ok) {
    const data = await res.json();
    if (data.user) currentUser = data.user;
    if (data.accounts) linkedAccounts = data.accounts;
    return { success: true, data };
  }
  let err: Record<string, string> = {};
  try {
    err = await res.json();
  } catch (_) {}
  return { success: false, error: err.error || err.message || '' };
}

export async function logoutApi(): Promise<{ success: boolean; switched?: boolean; user?: User; accounts?: LinkedAccount[] }> {
  const res = await postApi(API_ROUTES.auth.logout, {});
  if (res.ok) {
    const data = await res.json();
    if (data.switched && data.user) {
      currentUser = data.user;
      linkedAccounts = Array.isArray(data.accounts) ? data.accounts : [];
      return { success: true, switched: true, user: data.user, accounts: linkedAccounts };
    } else {
      currentUser = null;
      linkedAccounts = [];
      return { success: true, switched: false };
    }
  }
  return { success: false };
}

export async function logoutAllApi(): Promise<boolean> {
  const res = await postApi(API_ROUTES.auth.logoutAll, {});
  currentUser = null;
  linkedAccounts = [];
  return res.ok;
}

export async function getApi(url: string): Promise<Response> {
  return fetch(url, {
    method: 'GET',
    credentials: 'include',
  });
}

export async function postApi(url: string, body?: unknown): Promise<Response> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const payload = body !== undefined ? JSON.stringify(body) : JSON.stringify({});

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: payload,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: payload,
    });
  }

  return res;
}

export async function patchApi(url: string, body?: unknown): Promise<Response> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const payload = body !== undefined ? JSON.stringify(body) : JSON.stringify({});

  let res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: payload,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: payload,
    });
  }

  return res;
}

export async function putApi(url: string, body?: unknown): Promise<Response> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  const payload = body !== undefined ? JSON.stringify(body) : JSON.stringify({});

  let res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: payload,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: payload,
    });
  }

  return res;
}

export async function postFormApi(url: string, formData: FormData): Promise<Response> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: formData,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: formData,
    });
  }

  return res;
}

export async function deleteApi(url: string, body?: unknown): Promise<Response> {
  if (!csrfToken) {
    await fetchCsrfToken();
  }

  let res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
    },
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 403) {
    await fetchCsrfToken();
    res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      credentials: 'include',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  return res;
}

export async function getSubscriptionsApi(): Promise<{ success: boolean; subscriptions: SubscriptionPlan[] }> {
  try {
    const res = await fetch(API_ROUTES.subscriptions.base, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });

    if (res.ok) {
      const data = await res.json();
      return { success: true, subscriptions: data.subscriptions || [] };
    }

    return { success: false, subscriptions: [] };
  } catch {
    return { success: false, subscriptions: [] };
  }
}

export async function createSubscriptionCheckoutApi(planId: string, billingPeriod: string): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const res = await postApi(API_ROUTES.subscriptions.checkout, {
      planId,
      billingPeriod,
    });
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function verifySubscriptionSessionApi(sessionId: string): Promise<{ success: boolean; tier?: 'free' | 'plus' | 'pro' | 'ultra'; error?: string }> {
  try {
    const res = await getApi(API_ROUTES.subscriptions.verifySession(sessionId));
    const data = await res.json();
    if (res.ok && data.tier && currentUser) {
      currentUser.subscription_tier = data.tier;
      if (Array.isArray(linkedAccounts)) {
        linkedAccounts = linkedAccounts.map((acc) => {
          if (acc.id === currentUser?.id) {
            return { ...acc, subscription_tier: data.tier };
          }
          return acc;
        });
      }
    }
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error al verificar la sesión de pago.' };
  }
}

export async function getBillingDetailsApi(): Promise<BillingDetailsResponse> {
  try {
    const res = await getApi(API_ROUTES.subscriptions.details);
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function updateAutoRenewalApi(cancelAtPeriodEnd: boolean): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await postApi(API_ROUTES.subscriptions.autoRenewal, { cancelAtPeriodEnd });
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function cancelSubscriptionImmediateApi(): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await postApi(API_ROUTES.subscriptions.cancelImmediate, {});
    const data = await res.json();
    if (res.ok && currentUser) {
      currentUser.subscription_tier = 'free';
      if (Array.isArray(linkedAccounts)) {
        linkedAccounts = linkedAccounts.map((acc) => {
          if (acc.id === currentUser?.id) {
            return { ...acc, subscription_tier: 'free' };
          }
          return acc;
        });
      }
    }
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function getPaymentMethodsApi(): Promise<{ success: boolean; paymentMethods: PaymentMethod[] }> {
  try {
    const res = await getApi(API_ROUTES.subscriptions.paymentMethods);
    const data = await res.json();
    return { success: res.ok, paymentMethods: data.paymentMethods || [] };
  } catch {
    return { success: false, paymentMethods: [] };
  }
}

export async function createSetupIntentApi(): Promise<{ success: boolean; clientSecret?: string; error?: string }> {
  try {
    const res = await postApi(API_ROUTES.subscriptions.setupIntent, {});
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error al conectar con la pasarela de pagos.' };
  }
}

export async function setDefaultPaymentMethodApi(pmId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await postApi(API_ROUTES.subscriptions.paymentMethodDefault(pmId), {});
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

export async function deletePaymentMethodApi(pmId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await deleteApi(API_ROUTES.subscriptions.paymentMethodDelete(pmId));
    const data = await res.json();
    return { success: res.ok, ...data };
  } catch {
    return { success: false, error: 'Error al eliminar la tarjeta.' };
  }
}

export async function getPurchaseHistoryApi(): Promise<{ success: boolean; purchases: PurchaseRecord[] }> {
  try {
    const res = await getApi(API_ROUTES.subscriptions.history);
    const data = await res.json();
    return { success: res.ok, purchases: data.purchases || [] };
  } catch {
    return { success: false, purchases: [] };
  }
}
