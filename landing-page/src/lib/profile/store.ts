import { readSession, saveSession } from './session';

const apiUrl = import.meta.env.PUBLIC_API_URL;

interface SettingsResponse {
  message?: string;
}

export function initStoreForm(authHeaders: Record<string, string>): void {
  const storeForm = document.querySelector<HTMLFormElement>('[data-store-form]')!;
  const storeMsg = document.querySelector<HTMLElement>('[data-store-msg]')!;
  const storeSave = document.querySelector<HTMLButtonElement>('[data-store-save]')!;

  storeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    storeMsg.hidden = true;
    storeSave.disabled = true;
    storeSave.textContent = 'Guardando...';

    const fd = new FormData(storeForm);
    const payload = {
      name: String(fd.get('name') ?? '').trim(),
      address: String(fd.get('address') ?? '').trim() || null,
      phone: String(fd.get('phone') ?? '').trim() || null,
    };

    try {
      const res = await fetch(`${apiUrl}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as SettingsResponse | null;
        throw new Error(data?.message ?? 'No se pudieron guardar los cambios.');
      }

      saveSession({ ...readSession(), storeName: payload.name });
      storeMsg.textContent = 'Datos guardados correctamente ✓';
      storeMsg.classList.remove('is-error');
      storeMsg.hidden = false;
      setTimeout(() => {
        storeMsg.hidden = true;
      }, 3000);
    } catch (err) {
      storeMsg.textContent =
        err instanceof Error ? err.message : 'No se pudieron guardar los cambios.';
      storeMsg.classList.add('is-error');
      storeMsg.hidden = false;
    } finally {
      storeSave.disabled = false;
      storeSave.textContent = 'Guardar cambios';
    }
  });
}