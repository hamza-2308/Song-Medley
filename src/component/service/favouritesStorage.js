// favouritesStorage.js
// Simple localStorage-based favourites, scoped per-user so multiple
// accounts on the same browser don't mix favourites.

const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const keyFor = (type, userId) => `favourites_${type}_${userId}`;

const readIds = (type) => {
  const user = getCurrentUser();
  if (!user.UserId) return [];
  try {
    const raw = localStorage.getItem(keyFor(type, user.UserId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeIds = (type, ids) => {
  const user = getCurrentUser();
  if (!user.UserId) return;
  localStorage.setItem(keyFor(type, user.UserId), JSON.stringify(ids));
};

// ---------- Medleys ----------
export const getFavouriteMedleyIds = () => readIds("medleys");

export const isMedleyFavourite = (medleyId) =>
  getFavouriteMedleyIds().includes(medleyId);

export const toggleFavouriteMedley = (medleyId) => {
  const ids = getFavouriteMedleyIds();
  const next = ids.includes(medleyId)
    ? ids.filter((id) => id !== medleyId)
    : [...ids, medleyId];
  writeIds("medleys", next);
  return next;
};

// ---------- Songs ----------
export const getFavouriteSongIds = () => readIds("songs");

export const isSongFavourite = (songId) =>
  getFavouriteSongIds().includes(songId);

export const toggleFavouriteSong = (songId) => {
  const ids = getFavouriteSongIds();
  const next = ids.includes(songId)
    ? ids.filter((id) => id !== songId)
    : [...ids, songId];
  writeIds("songs", next);
  return next;
};