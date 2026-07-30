// ================================================================
//  Song Medley Maker & DJ — Central API Configuration
// ----------------------------------------------------------------
//  Single source of truth for the backend URL and every REST
//  endpoint. Change BASE_URL below (e.g. when running on a phone /
//  another machine) and the entire app will automatically use it.
// ================================================================

// ---------- Base URL of the ASP.NET Web API backend ----------
// Local IIS Express bindings (from applicationhost.config):
//   http:  http://localhost:63686
//   https: https://localhost:44307
//
// Use HTTPS by default (matches the current login/signup calls).
// When testing on a phone / another device, replace "localhost"
// with your machine LAN IP, e.g.
//   export const BASE_URL = "http://192.168.100.241:63686";
export const BASE_URL = "http://localhost:52810";

// ---------- Static file helper ----------
// The backend saves audio / image files under ~/Uploads and serves
// them as static content. Song rows store their relative disk path
// in FilePath (e.g. "/Uploads/xyz.mp3"). Build a full URL like:
//
//   <audio src={buildFileUrl(song.FilePath)} />
//
// - Handles null / empty safely
// - Ensures the path starts with a single leading slash
// - Encodes spaces / special characters in the file name
export const buildFileUrl = (relativePath) => {
  if (!relativePath) return "";
  let path = relativePath.replace(/\\/g, "/").trim();
  if (!path.startsWith("/")) path = "/" + path;

  // Encode ONLY the file name segments, keep the slashes intact.
  const segments = path.split("/").map((seg, i) => (i === 0 ? seg : encodeURIComponent(seg)));
  return `${BASE_URL}${segments.join("/")}`;
};

// ================================================================
//  API endpoints — grouped by feature
//  Every URL used anywhere in the app lives here.
// ================================================================
export const API = {

  // ================= AUTH =================
  auth: {
    login:          `${BASE_URL}/api/auth/login`,         // POST { Email, Password }
    register:       `${BASE_URL}/api/auth/register`,      // POST { UserName, Email, Password, Role }
    users:          `${BASE_URL}/api/auth/users`,         // GET  list of users

    // NOTE: backend does not expose /api/auth/changepassword yet.
    // Wire the controller when you add "Change Password" support.
    changePassword: `${BASE_URL}/api/auth/changepassword`, // POST { UserId, OldPassword, NewPassword }
  },

  // ================= USERS =================
  users: {
    all:      `${BASE_URL}/api/users/all`,                    // GET all users
    byId:     (id) => `${BASE_URL}/api/users/${id}`,          // GET one user
    update:   (id) => `${BASE_URL}/api/users/update/${id}`,   // PUT { UserName, Email, Password }
    delete:   (id) => `${BASE_URL}/api/users/delete/${id}`,   // DELETE
  },

  // ================= SONGS =================
  // Backend serves the actual mp3 as a static file via `song.FilePath`.
  // Use buildFileUrl(song.FilePath) to construct the <audio> src.
  songs: {
    all:      `${BASE_URL}/api/songs/all`,                    // GET all songs
    byId:     (id) => `${BASE_URL}/api/songs/${id}`,          // GET one song
    add:      `${BASE_URL}/api/songs/add`,                    // POST multipart/form-data
    upload: `${BASE_URL}/api/songs/upload`, 
    update:   (id) => `${BASE_URL}/api/songs/update/${id}`,   // PUT
    delete:   (id) => `${BASE_URL}/api/songs/delete/${id}`,   // DELETE
    byTheme:  (themeId) => `${BASE_URL}/api/songs/theme/${themeId}`,
  },

  // ================= TRIM CLIPS =================
  // NOTE: backend takes query-string params, NOT a JSON body:
  //   POST /api/trimclips/create?songId=&userId=&startMs=&endMs=&clipName=
  trimClips: {
    all:      `${BASE_URL}/api/trimclips/all`,
    byId:     (id) => `${BASE_URL}/api/trimclips/${id}`,
    byUser:   (userId) => `${BASE_URL}/api/trimclips/user/${userId}`,
    create:   `${BASE_URL}/api/trimclips/create`,
    update:   (id, startMs, endMs, clipName) => {
      const params = new URLSearchParams({ startMs: String(startMs), endMs: String(endMs) });
      if (clipName) params.set("clipName", clipName);
      return `${BASE_URL}/api/trimclips/update/${id}?${params.toString()}`;
    },
    delete:   (id) => `${BASE_URL}/api/trimclips/delete/${id}`,
  },

  // ================= MEDLEYS =================
  // NOTE: creating a full medley now takes THREE calls:
  //   1) POST  /api/medleys/add                       (create Medley row)
  //   2) POST  /api/medleyclips/add   (one per clip)  (link TrimClips)
  //   3) POST  /api/medleys/merge/{medleyId}          (FFmpeg concat)
  medleys: {
    all:      `${BASE_URL}/api/medleys/all`,
    byId:     (id) => `${BASE_URL}/api/medleys/${id}`,
    add:      `${BASE_URL}/api/medleys/add`,
    merge:    (medleyId) => `${BASE_URL}/api/medleys/merge/${medleyId}`,
    update:   (id) => `${BASE_URL}/api/medleys/update/${id}`,
    delete:   (id, userId) => `${BASE_URL}/api/medleys/delete/${id}?userId=${userId}`,

    // NOTE: /api/medley/edit and /api/medley/{id}/reorder are used
    // by MyLibrary / SharedMedleys but do NOT exist in the backend yet.
    // Add the corresponding controller actions when this feature is wired.
    edit:     (medleyId, userId) => `${BASE_URL}/api/medleys/edit/${medleyId}/${userId}`,
    reorder:  (medleyId) => `${BASE_URL}/api/medleys/${medleyId}/reorder`,

    // ---- Recycle bin (soft delete) — Settings → "Deleted Medleys" ----
    recentlyDeleted: (userId) => `${BASE_URL}/api/medleys/recentlydeleted/${userId}`, // GET
    restore:         (id) => `${BASE_URL}/api/medleys/restore/${id}`,                 // PUT
    permanentDelete: (id) => `${BASE_URL}/api/medleys/permanentdelete/${id}`,         // DELETE
  },

  // ================= MEDLEY CLIPS =================
  medleyClips: {
    all:       `${BASE_URL}/api/medleyclips/all`,
    byId:      (id) => `${BASE_URL}/api/medleyclips/${id}`,
    byMedley:  (medleyId) => `${BASE_URL}/api/medleyclips/medley/${medleyId}`,
    add:       `${BASE_URL}/api/medleyclips/add`,
    update:    (id) => `${BASE_URL}/api/medleyclips/update/${id}`,
    delete:    (id) => `${BASE_URL}/api/medleyclips/delete/${id}`,
  },

  // ================= MEDLEY SHARE =================
  // NOTE: backend supports sharing with ONE user per POST.
  // For sharing with many users, loop on the client and POST N times.
  medleyShare: {
    share:           `${BASE_URL}/api/medleyshare/share`,                          // POST { MedleyId, SharedByUserId, SharedWithUserId }
    sharedWithUser:  (userId) => `${BASE_URL}/api/medleyshare/sharedwith/${userId}`,
    sharedByUser:    (userId) => `${BASE_URL}/api/medleyshare/sharedby/${userId}`,
    delete:          (id) => `${BASE_URL}/api/medleyshare/delete/${id}`,
  },

  // USER SUGGESSTION 
  suggested: {
    create: (originalMedleyId, userId) =>
        `${BASE_URL}/api/suggested/create/${originalMedleyId}?userId=${userId}`,
    byUser: (userId) => `${BASE_URL}/api/suggested/user/${userId}`,
    byId: (id) => `${BASE_URL}/api/suggested/${id}`,
    updateClip: (clipId) => `${BASE_URL}/api/suggested/clip/update/${clipId}`,
    deleteClip: (clipId) => `${BASE_URL}/api/suggested/clip/delete/${clipId}`,
    merge: (id) => `${BASE_URL}/api/suggested/merge/${id}`,
    finalize: (id) => `${BASE_URL}/api/suggested/finalize/${id}`,
    delete: (id) => `${BASE_URL}/api/suggested/delete/${id}`,
    accept: (originalMedleyId, userId) =>
      `${BASE_URL}/api/suggested/accept/${originalMedleyId}?userId=${userId}`,
    updateSettings: (id) => `${BASE_URL}/api/suggested/settings/${id}`,
    received: (shopkeeperUserId) => `${BASE_URL}/api/suggested/received/${shopkeeperUserId}`,
    addClip: `${BASE_URL}/api/suggested/clip/add`,
},

// reviews and rating 
reviews: {
  add: `${BASE_URL}/api/reviews/add`,
  byMedley: (medleyId) => `${BASE_URL}/api/reviews/medley/${medleyId}`,
  myReview: (userId, medleyId) =>
      `${BASE_URL}/api/reviews/user/${userId}/medley/${medleyId}`,
  top: (minReviews = 1, limit = 10) =>
      `${BASE_URL}/api/reviews/top?minReviews=${minReviews}&limit=${limit}`,
  topMakers: (limit = 4) => `${BASE_URL}/api/reviews/topmakers?limit=${limit}`,
  delete: (id) => `${BASE_URL}/api/reviews/${id}`,
},

  // ================= WATERMARK =================
  watermark: {
    all:      `${BASE_URL}/api/watermark/all`,
    byId:     (id) => `${BASE_URL}/api/watermark/${id}`,
    byUser:   (userId) => `${BASE_URL}/api/watermark/user/${userId}`,
    add:      `${BASE_URL}/api/watermark/add`,                     // POST multipart/form-data { file, UserId }
    update:   (id) => `${BASE_URL}/api/watermark/update/${id}`,
    delete:   (id) => `${BASE_URL}/api/watermark/delete/${id}`,
  },

  // ================= THEMES =================
  themes: {
    all:      `${BASE_URL}/api/theme/all`,
    byId:     (id) => `${BASE_URL}/api/theme/${id}`,
    add:      `${BASE_URL}/api/theme/add`,
    update:   (id) => `${BASE_URL}/api/theme/update/${id}`,
    delete:   (id) => `${BASE_URL}/api/theme/delete/${id}`,
  },

  // ================= FAVORITES =================
  // NOTE: backend does NOT have a Favorites controller yet.
  // Add one when the Favourites screen goes live.
  favorites: {
    songsByUser:    (userId) => `${BASE_URL}/api/favorites/songs/${userId}`,
    medleysByUser:  (userId) => `${BASE_URL}/api/favorites/medleys/${userId}`,
    add:            `${BASE_URL}/api/favorites/add`,      // POST ?userId=&itemType=&itemId=
    remove:         `${BASE_URL}/api/favorites/remove`,   // DELETE ?userId=&itemType=&itemId=
  },
  medleyRequests: {
    add: `${BASE_URL}/api/medleyrequests/add`,
    received: (shopkeeperId) => `${BASE_URL}/api/medleyrequests/received/${shopkeeperId}`,
    sent: (userId) => `${BASE_URL}/api/medleyrequests/sent/${userId}`,
    respond: (id) => `${BASE_URL}/api/medleyrequests/respond/${id}`,
    delete: (id) => `${BASE_URL}/api/medleyrequests/${id}`,
    pendingCount: (shopkeeperId) => `${BASE_URL}/api/medleyrequests/pending-count/${shopkeeperId}`,
},
};

export default API;