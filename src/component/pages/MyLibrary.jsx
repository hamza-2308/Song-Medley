import { useState, useEffect, useRef } from "react";
import axios from "axios";
import SongList from "../SongList";

const BASE_URL = "https://localhost:44307";

const MyLibrary = () => {
  // ==========================
  // Shared-with-you state
  // ==========================
  const [sharedList, setSharedList] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [openMedleyId, setOpenMedleyId] = useState(null);
  const [medleyDetail, setMedleyDetail] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  const dragIndexRef = useRef(null);

  // ==========================
  // Favourites state
  // ==========================
  const [favoriteSongIds, setFavoriteSongIds] = useState([]);
  const [favoriteMedleyIds, setFavoriteMedleyIds] = useState([]);

  const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");

  const fetchFavoriteSongIds = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/favorites/songs/${user.UserId}`);
      setFavoriteSongIds((res.data || []).map((s) => s.SongId));
    } catch (err) {
      console.error("Failed to load favorite songs:", err);
    }
  };

  const fetchFavoriteMedleyIds = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    try {
      const res = await axios.get(`${BASE_URL}/api/favorites/medleys/${user.UserId}`);
      setFavoriteMedleyIds((res.data || []).map((m) => m.MedleyId));
    } catch (err) {
      console.error("Failed to load favorite medleys:", err);
    }
  };

  const isSongFavourite = (songId) => favoriteSongIds.includes(songId);
  const isMedleyFavourite = (medleyId) => favoriteMedleyIds.includes(medleyId);

  const toggleSongFavourite = async (song) => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    const already = isSongFavourite(song.SongId);
    try {
      if (already) {
        await axios.delete(`${BASE_URL}/api/favorites/remove`, {
          params: { userId: user.UserId, itemType: "Song", itemId: song.SongId }
        });
        setFavoriteSongIds((prev) => prev.filter((id) => id !== song.SongId));
      } else {
        await axios.post(`${BASE_URL}/api/favorites/add`, null, {
          params: { userId: user.UserId, itemType: "Song", itemId: song.SongId }
        });
        setFavoriteSongIds((prev) => [...prev, song.SongId]);
      }
    } catch (err) {
      console.error("Toggle favourite failed:", err);
    }
  };

  const toggleMedleyFavourite = async (medleyId) => {
    const user = getCurrentUser();
    if (!user.UserId) return;
    const already = isMedleyFavourite(medleyId);
    try {
      if (already) {
        await axios.delete(`${BASE_URL}/api/favorites/remove`, {
          params: { userId: user.UserId, itemType: "Medley", itemId: medleyId }
        });
        setFavoriteMedleyIds((prev) => prev.filter((id) => id !== medleyId));
      } else {
        await axios.post(`${BASE_URL}/api/favorites/add`, null, {
          params: { userId: user.UserId, itemType: "Medley", itemId: medleyId }
        });
        setFavoriteMedleyIds((prev) => [...prev, medleyId]);
      }
    } catch (err) {
      console.error("Toggle favourite failed:", err);
    }
  };

  const fetchSharedList = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;

    setLoadingList(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/medley/shared-with-me/${user.UserId}`);
      setSharedList(res.data || []);
    } catch (err) {
      console.error("Failed to load shared medleys:", err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchSharedList();
  }, []);

  useEffect(() => {
    fetchFavoriteSongIds();
    fetchFavoriteMedleyIds();
  }, []);

  const openMedley = async (medleyId) => {
    const user = getCurrentUser();
    setOpenMedleyId(medleyId);
    setMedleyDetail(null);
    setSaveMsg("");
    setSaveError("");
    setLoadingDetail(true);

    try {
      const res = await axios.get(`${BASE_URL}/api/medley/edit/${medleyId}/${user.UserId}`);
      if (res.data.success) {
        setMedleyDetail(res.data);
        setCanEdit(res.data.canEdit);
      } else {
        setSaveError(res.data.message || "Could not load medley");
      }
    } catch (err) {
      console.error("Failed to load medley detail:", err);
      setSaveError("Failed to load medley");
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeMedley = () => {
    setOpenMedleyId(null);
    setMedleyDetail(null);
    setSaveMsg("");
    setSaveError("");
  };

  const formatMs = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ==========================
  // Drag & drop reordering (native HTML5 DnD — no extra library needed)
  // ==========================
  const handleDragStart = (index) => {
    dragIndexRef.current = index;
  };

  const handleDragOver = (e) => {
    e.preventDefault(); // required to allow dropping
  };

  const handleDrop = (dropIndex) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;

    const updatedClips = [...medleyDetail.clips];
    const [movedClip] = updatedClips.splice(dragIndex, 1);
    updatedClips.splice(dropIndex, 0, movedClip);

    setMedleyDetail((prev) => ({ ...prev, clips: updatedClips }));
    dragIndexRef.current = null;
  };

  const handleSaveOrder = async () => {
    if (!medleyDetail) return;

    const user = getCurrentUser();
    setSaving(true);
    setSaveMsg("");
    setSaveError("");

    const clipOrder = medleyDetail.clips.map((clip, index) => ({
      TrimClipId: clip.TrimClipId,
      SequenceNumber: index + 1
    }));

    try {
      const response = await axios.put(`${BASE_URL}/api/medley/${openMedleyId}/reorder`, {
        UserId: user.UserId,
        ClipOrder: clipOrder
      });

      if (response.data.success) {
        setSaveMsg(response.data.message || "Order saved");
        if (response.data.renderError) {
          setSaveError(`Mashup re-render failed: ${response.data.renderError}`);
        }
        // refresh detail to get the new mashup URL / sequence numbers
        openMedley(openMedleyId);
      } else {
        setSaveError(response.data.message || "Failed to save order");
      }
    } catch (err) {
      console.error("Save order error:", err);
      const serverMessage = err.response?.data?.Message || err.response?.data?.message;
      setSaveError(serverMessage || "Failed to save order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center py-10 px-4">
      <h1 className="text-4xl font-bold mb-6">📚 My Library</h1>

      <div className="w-full max-w-2xl">
        <SongList
          onToggleFavourite={toggleSongFavourite}
          isFavourite={isSongFavourite}
        />
      </div>

      {/* ========================== */}
      {/* Shared With You section */}
      {/* ========================== */}
      <div className="w-full max-w-2xl mt-10">
        <h2 className="text-2xl font-bold mb-1">🤝 Shared With You</h2>
        <p className="text-gray-500 text-xs mb-4">
          Mashups that other users have shared with you
        </p>

        {loadingList ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : sharedList.length === 0 ? (
          <p className="text-gray-400 text-sm">No medleys have been shared with you yet.</p>
        ) : (
          <div className="space-y-2 mb-4">
            {sharedList.map((m) => (
              <div
                key={m.MedleyId}
                className={`bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center hover:bg-gray-700 ${
                  openMedleyId === m.MedleyId ? "border border-purple-500" : ""
                }`}
              >
                <div onClick={() => openMedley(m.MedleyId)} className="cursor-pointer flex-1">
                  <p className="font-semibold text-sm">{m.MedleyName}</p>
                  <p className="text-gray-400 text-xs">
                    {m.ClipCount} clips · shared by user #{m.SharedByUserId}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMedleyFavourite(m.MedleyId);
                    }}
                    className="text-xl"
                    title={isMedleyFavourite(m.MedleyId) ? "Remove from favourites" : "Add to favourites"}
                  >
                    {isMedleyFavourite(m.MedleyId) ? "❤️" : "🤍"}
                  </button>
                  <span onClick={() => openMedley(m.MedleyId)} className="text-purple-400 text-xs cursor-pointer">Open ›</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Editor panel for the opened shared medley */}
        {openMedleyId && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
            {loadingDetail ? (
              <p className="text-gray-400 text-sm">Loading medley...</p>
            ) : !medleyDetail || !medleyDetail.success ? (
              <p className="text-red-400 text-sm">{saveError || "Could not load medley"}</p>
            ) : (
              <>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="font-bold">{medleyDetail.medley.MedleyName}</h3>
                  <div className="flex items-center gap-3">
                    {canEdit ? (
                      <span className="text-green-400 text-xs">✏️ You can edit this</span>
                    ) : (
                      <span className="text-gray-500 text-xs">👁 View only</span>
                    )}
                    <button
                      onClick={closeMedley}
                      className="text-gray-400 hover:text-white text-xs"
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>

                {medleyDetail.medley.OutputFilePath && (
                  <audio
                    controls
                    src={`${BASE_URL}/api/medley/download/${openMedleyId}`}
                    className="w-full mb-3"
                  />
                )}

                <p className="text-gray-500 text-xs mb-2">
                  {canEdit
                    ? "Drag clips up/down to change the mashup order"
                    : "Only the owner or someone this was shared with can reorder clips"}
                </p>

                <div className="space-y-2 mb-3">
                  {medleyDetail.clips.map((clip, index) => (
                    <div
                      key={clip.MedleyClipId}
                      draggable={canEdit}
                      onDragStart={() => canEdit && handleDragStart(index)}
                      onDragOver={canEdit ? handleDragOver : undefined}
                      onDrop={() => canEdit && handleDrop(index)}
                      className={`rounded-xl px-4 py-3 flex items-center gap-3 bg-gray-800 ${
                        canEdit ? "cursor-move" : ""
                      }`}
                    >
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{clip.ClipName}</p>
                        <p className="text-gray-400 text-xs">
                          {formatMs(clip.StartMs)} → {formatMs(clip.EndMs)} · 🎵 {clip.SongTitle}
                        </p>
                      </div>
                      {canEdit && <span className="text-gray-500 text-lg">⠿</span>}
                    </div>
                  ))}
                </div>

                {canEdit && (
                  <button
                    onClick={handleSaveOrder}
                    disabled={saving}
                    className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                  >
                    {saving ? "Saving & re-rendering..." : "💾 Save New Order"}
                  </button>
                )}

                {saveMsg && <p className="text-green-400 text-sm mt-2">✅ {saveMsg}</p>}
                {saveError && <p className="text-red-400 text-sm mt-2">{saveError}</p>}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyLibrary;