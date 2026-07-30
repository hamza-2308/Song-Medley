// EditMedleyModal.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { API } from "../service/ipConfig";
import ClipReTrimModal from "./ClipReTrimModal";

const EditMedleyModal = ({ isOpen, onClose, medley, currentUser, onSaved }) => {
  // ==========================
  // Clip list (existing clips in this medley)
  // ==========================
  const [clips, setClips] = useState([]);
  const [loadingClips, setLoadingClips] = useState(false);
  const [clipsError, setClipsError] = useState("");

  const [savingOrder, setSavingOrder] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveError, setSaveError] = useState("");

  const [deletingClipId, setDeletingClipId] = useState(null);
  const [retrimTrimClipId, setRetrimTrimClipId] = useState(null);

  const dragIndexRef = useRef(null);

  // ==========================
  // Add-clip library panel
  // ==========================
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryClips, setLibraryClips] = useState([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [addingClipId, setAddingClipId] = useState(null);

  const formatMs = (ms) => {
    if (!ms) return "00:00";
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // The medleyClips controller (add/update/delete) returns a raw
  // Tuple<bool,string> shape: { Item1: bool, Item2: "message" }
  // instead of { success, message } like the other controllers.
  // This helper reads whichever shape comes back.
  const readApiResult = (data) => ({
    ok: data?.success ?? data?.Item1 ?? false,
    message: data?.message ?? data?.Item2 ?? "",
  });

  // ==========================
  // Fetch clips currently in the medley
  // ==========================
  const fetchClips = async () => {
    if (!medley) return;
    setLoadingClips(true);
    setClipsError("");
    try {
      const res = await axios.get(API.medleyClips.byMedley(medley.MedleyId));
      const sorted = (res.data || [])
        .slice()
        .sort((a, b) => (a.SequenceNumber || 0) - (b.SequenceNumber || 0));
      setClips(sorted);
    } catch (err) {
      setClipsError("Failed to load clips for this medley.");
    } finally {
      setLoadingClips(false);
    }
  };

  useEffect(() => {
    if (isOpen && medley) {
      fetchClips();
      setShowLibrary(false);
      setLibraryClips([]);
      setLibraryError("");
      setLibrarySearch("");
      setSaveMsg("");
      setSaveError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, medley?.MedleyId]);

  if (!isOpen || !medley) return null;

  // ==========================
  // Reorder — drag & drop (same pattern as Suggested Sequences)
  // ==========================
  const handleDragStart = (index) => { dragIndexRef.current = index; };
  const handleDragOver = (e) => e.preventDefault();
  const handleDrop = (dropIndex) => {
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) return;
    const updated = [...clips];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(dropIndex, 0, moved);
    setClips(updated);
    dragIndexRef.current = null;
    setSaveMsg(""); setSaveError("");
  };

  // Fallback up/down controls for non-drag users
  const moveClip = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= clips.length) return;
    const updated = [...clips];
    [updated[index], updated[target]] = [updated[target], updated[index]];
    setClips(updated);
    setSaveMsg(""); setSaveError("");
  };

  // ==========================
  // Add clip from TrimClips library — API.trimClips.byUser(userId)
  // ==========================
  const openLibrary = async () => {
    const next = !showLibrary;
    setShowLibrary(next);
    if (next && libraryClips.length === 0) {
      await fetchLibrary();
    }
  };

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    setLibraryError("");
    try {
      const ownerId = medley.UserId || currentUser?.UserId;
      const res = await axios.get(API.trimClips.byUser(ownerId));
      setLibraryClips(res.data || []);
    } catch (err) {
      setLibraryError("Failed to load your TrimClips library.");
    } finally {
      setLoadingLibrary(false);
    }
  };

  const countInMedley = (trimClipId) =>
    clips.filter((c) => c.TrimClipId === trimClipId).length;

  const filteredLibrary = libraryClips.filter((tc) => {
    const q = librarySearch.trim().toLowerCase();
    if (!q) return true;
    return [tc.ClipName, tc.SongTitle, tc.ArtistName]
      .filter(Boolean)
      .some((f) => String(f).toLowerCase().includes(q));
  });

  // API.medleyClips.add — POST { MedleyId, TrimClipId, SequenceNumber }
  const handleAddClip = async (trimClip) => {
    setAddingClipId(trimClip.TrimClipId);
    setSaveMsg(""); setSaveError("");
    try {
      const res = await axios.post(API.medleyClips.add, {
        MedleyId: medley.MedleyId,
        TrimClipId: trimClip.TrimClipId,
        SequenceNumber: clips.length + 1,
      });
      const { ok, message } = readApiResult(res.data);
      if (ok) {
        const newClip = res.data.clip || {
          MedleyClipId: res.data.medleyClipId,
          MedleyId: medley.MedleyId,
          TrimClipId: trimClip.TrimClipId,
          SequenceNumber: clips.length + 1,
          ClipName: trimClip.ClipName,
          SongTitle: trimClip.SongTitle,
          ArtistName: trimClip.ArtistName,
        };
        setClips((prev) => [...prev, newClip]);
        // Refresh from server to pick up the real MedleyClipId if the
        // backend didn't return one in the response body.
        if (!res.data.clip && res.data.medleyClipId == null) {
          fetchClips();
        }
      } else {
        setSaveError(message || "Failed to add clip.");
      }
    } catch (err) {
      setSaveError(err.response?.data?.Message || err.response?.data?.message || "Failed to add clip.");
    } finally {
      setAddingClipId(null);
    }
  };

  // ==========================
  // Delete a clip already in the medley — API.medleyClips.delete(id)
  // ==========================
  const handleDeleteClip = async (clip) => {
    if (!window.confirm("Remove this clip from the medley?")) return;
    setDeletingClipId(clip.MedleyClipId);
    setSaveMsg(""); setSaveError("");
    try {
      const res = await axios.delete(API.medleyClips.delete(clip.MedleyClipId));
      const { ok, message } = readApiResult(res.data);
      if (ok) {
        setClips((prev) => prev.filter((c) => c.MedleyClipId !== clip.MedleyClipId));
      } else {
        setSaveError(message || "Failed to delete clip.");
      }
    } catch (err) {
      setSaveError(err.response?.data?.Message || err.response?.data?.message || "Failed to delete clip.");
    } finally {
      setDeletingClipId(null);
    }
  };

  // ==========================
  // Save order + re-render — API.medleyClips.update(id), API.medleys.merge(id)
  // ==========================
  const handleSaveOrder = async () => {
    setSavingOrder(true);
    setSaveMsg(""); setSaveError("");
    try {
      const reordered = clips.map((c, i) => ({ ...c, SequenceNumber: i + 1 }));

      for (let i = 0; i < reordered.length; i++) {
        const clip = reordered[i];
        await axios.put(API.medleyClips.update(clip.MedleyClipId), {
          MedleyClipId: clip.MedleyClipId,
          MedleyId: medley.MedleyId,
          TrimClipId: clip.TrimClipId,
          SequenceNumber: i + 1,
        });
      }
      setClips(reordered);

      // Keep ClipCount in sync on the medley itself
      try {
        await axios.put(API.medleys.update(medley.MedleyId), {
          ...medley,
          ClipCount: reordered.length,
        });
      } catch (e) { /* non-fatal — merge below still re-renders audio */ }

      // Re-render the mashup so the audio reflects the new clip set/order
      let newOutputPath = null;
      let renderError = null;
      try {
        const mergeRes = await axios.post(API.medleys.merge(medley.MedleyId));
        if (mergeRes.data.success) newOutputPath = mergeRes.data.outputFilePath;
        else renderError = mergeRes.data.message || "Merge failed";
      } catch (mergeErr) {
        renderError = mergeErr.response?.data?.Message || mergeErr.response?.data?.message || mergeErr.message;
      }

      if (renderError) {
        setSaveError(`Saved order, but re-render failed: ${renderError}`);
      } else {
        setSaveMsg("Saved! Your medley has been updated.");
      }

      if (onSaved) {
        onSaved({
          MedleyId: medley.MedleyId,
          ClipCount: reordered.length,
          OutputFilePath: newOutputPath || medley.OutputFilePath,
        });
      }
    } catch (err) {
      setSaveError(err.response?.data?.Message || err.response?.data?.message || "Failed to save changes.");
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 px-4">
      <div className="bg-gray-900 text-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">

        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-2xl font-bold">🎛 Edit Medley Clips</h2>
            <p className="text-gray-400 text-sm truncate">"{medley.MedleyName}"</p>
          </div>
          <button onClick={onClose} className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm">
            ✕ Close
          </button>
        </div>

        {/* Clip list */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm text-gray-300">
              Clips in this medley ({clips.length})
            </h3>
            <button onClick={fetchClips} className="text-gray-400 hover:text-white text-xs">⟳ Refresh</button>
          </div>
          <p className="text-gray-500 text-xs mb-3">Drag to reorder, or use ↑ ↓ · ✂ re-trims a clip · 🗑 removes it</p>

          {loadingClips ? (
            <p className="text-gray-400 text-sm text-center py-6">Loading...</p>
          ) : clipsError ? (
            <p className="text-red-400 text-sm text-center py-6">{clipsError}</p>
          ) : clips.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">No clips in this medley yet — add one below.</p>
          ) : (
            <div className="space-y-2">
              {clips.map((clip, idx) => (
                <div
                  key={clip.MedleyClipId}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(idx)}
                  className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 cursor-move"
                >
                  <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {clip.ClipName || clip.SongTitle || `TrimClip #${clip.TrimClipId}`}
                    </p>
                    {clip.ArtistName && <p className="text-gray-400 text-xs truncate">{clip.ArtistName}</p>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => moveClip(idx, -1)} disabled={idx === 0}
                            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 w-7 h-7 rounded text-xs">↑</button>
                    <button onClick={() => moveClip(idx, 1)} disabled={idx === clips.length - 1}
                            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-30 w-7 h-7 rounded text-xs">↓</button>
                    <span className="text-gray-500 text-lg px-1">⠿</span>
                    <button onClick={() => setRetrimTrimClipId(clip.TrimClipId)}
                            className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs">✂️</button>
                    <button onClick={() => handleDeleteClip(clip)} disabled={deletingClipId === clip.MedleyClipId}
                            className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs disabled:opacity-50">
                      {deletingClipId === clip.MedleyClipId ? "..." : "🗑"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add clip from library */}
        <div className="mb-6">
          <button onClick={openLibrary}
                  className="w-full bg-green-600 hover:bg-green-700 py-3 rounded-xl font-semibold text-sm">
            {showLibrary ? "▲ Hide TrimClips Library" : "+ Add New Clip from Library"}
          </button>

          {showLibrary && (
            <div className="mt-3 bg-gray-800 rounded-xl p-3">
              <input
                type="text"
                value={librarySearch}
                onChange={(e) => setLibrarySearch(e.target.value)}
                placeholder="Search your TrimClips..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm mb-3"
              />
              {loadingLibrary ? (
                <p className="text-gray-400 text-sm text-center py-4">Loading library...</p>
              ) : libraryError ? (
                <p className="text-red-400 text-sm text-center py-4">{libraryError}</p>
              ) : filteredLibrary.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No TrimClips found.</p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredLibrary.map((tc) => {
                    const usedCount = countInMedley(tc.TrimClipId);
                    return (
                      <div key={tc.TrimClipId} className="flex items-center justify-between gap-2 bg-gray-900 rounded-lg px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">
                            {tc.ClipName || tc.SongTitle || `TrimClip #${tc.TrimClipId}`}
                            {usedCount > 0 && (
                              <span className="ml-2 text-purple-400 text-xs">already added ×{usedCount}</span>
                            )}
                          </p>
                          {tc.ArtistName && <p className="text-gray-400 text-xs truncate">{tc.ArtistName}</p>}
                          {tc.DurationMs > 0 && <p className="text-gray-500 text-xs">{formatMs(tc.DurationMs)}</p>}
                        </div>
                        <button
                          onClick={() => handleAddClip(tc)}
                          disabled={addingClipId === tc.TrimClipId}
                          className="bg-purple-600 hover:bg-purple-700 px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 flex-shrink-0"
                        >
                          {addingClipId === tc.TrimClipId ? "Adding..." : "+ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {saveMsg && <p className="text-green-400 text-sm mb-3">✅ {saveMsg}</p>}
        {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={savingOrder}
                  className="bg-gray-600 hover:bg-gray-700 px-5 py-3 rounded-lg disabled:opacity-50">
            Cancel
          </button>
          <button onClick={handleSaveOrder} disabled={savingOrder || clips.length === 0}
                  className="bg-purple-600 hover:bg-purple-700 px-6 py-3 rounded-lg font-semibold disabled:opacity-50">
            {savingOrder ? "Saving..." : "💾 Save Changes"}
          </button>
        </div>
      </div>

      {retrimTrimClipId && (
        <ClipReTrimModal
          trimClipId={retrimTrimClipId}
          onClose={() => setRetrimTrimClipId(null)}
          onSaved={() => {
            setRetrimTrimClipId(null);
            setSaveMsg("Clip re-trimmed. Click Save Changes to re-render the medley.");
          }}
        />
      )}
    </div>
  );
};

export default EditMedleyModal;