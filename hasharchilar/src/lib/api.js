// Backend (Hono Worker) bilan aloqa. Barcha so'rovlar /api/* ga ketadi.
async function request(path, options) {
  const res = await fetch(`/api${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "So'rov bajarilmadi");
  return data;
}

export const api = {
  listHashars: () => request('/hashars'),
  createHashar: (formData) => request('/hashars', { method: 'POST', body: formData }),
  join: (id, profile) =>
    request(`/hashars/${id}/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(profile),
    }),
  complete: (id, formData) => request(`/hashars/${id}/complete`, { method: 'POST', body: formData }),
};
