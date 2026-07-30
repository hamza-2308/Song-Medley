import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SongTrimmerModal from "../modal/SongTrimmerModal";
import AddNewSongModal from "../modal/NewSongModal";
import { API, buildFileUrl } from "../service/ipConfig";
import ConfirmModal from "../pages/Confirmmodal"; // ← NEW IMPORT

// Fixed watermark clip — always the same TrimClipId, always locked at sequence 1
const WATERMARK_TRIM_CLIP_ID = 1047;
const WATERMARK_CLIP = {
  trimClipId: WATERMARK_TRIM_CLIP_ID,
  clipName: "watermark",
  startMs: 0,
  endMs: 6321,
  songTitle: "watermark",
  isWatermark: true,
};

const CreateMedley = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("Title");
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [clips, setClips] = useState([]);
  const [playingClipIndex, setPlayingClipIndex] = useState(-1);
  const [exporting, setExporting] = useState(false);

  // ==========================
  // My Saved Trim Clips (backend-driven, per user)
  // ==========================
  const [myTrimClips, setMyTrimClips] = useState([]);
  const [loadingMyTrims, setLoadingMyTrims] = useState(false);
  const [showMyTrims, setShowMyTrims] = useState(true);
  const [trimPreviewId, setTrimPreviewId] = useState(null); // which saved trim is currently previewing
  const trimPreviewRef = useRef(null);

  // Watermark toggle
  const [includeWatermark, setIncludeWatermark] = useState(false);

  // Real, per-user, backend-driven watermark
  const [userWatermarks, setUserWatermarks] = useState([]);
  const [loadingWatermarks, setLoadingWatermarks] = useState(false);
  const [selectedWatermarkId, setSelectedWatermarkId] = useState(null);
  const [watermarkStartTimeSec, setWatermarkStartTimeSec] = useState(0);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [watermarkUploadError, setWatermarkUploadError] = useState("");

  // Medley must be saved before it can be shared
  const [savedMedleyId, setSavedMedleyId] = useState(null);

  // Medley metadata
  const [medleyName, setMedleyName] = useState("");
  const [medleyTheme, setMedleyTheme] = useState("");
  const [medleyComposer, setMedleyComposer] = useState("");
  const [medleyCategory, setMedleyCategory] = useState("");

  // URL of the FFmpeg-rendered mashup file (null until merge succeeds)
  const [mashupUrl, setMashupUrl] = useState(null);

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState("");
  const [shareSuccessMsg, setShareSuccessMsg] = useState("");

  // ===============================================================
  // NEW — Unified confirmation modal state (replaces window.confirm)
  // ===============================================================
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    variant: "danger",
    icon: null,
    onConfirm: () => {},
  });

  const openConfirm = (config) => {
    setConfirmState({
      isOpen: true,
      title: config.title || "Confirm Action",
      message: config.message || "Are you sure?",
      confirmText: config.confirmText || "Confirm",
      variant: config.variant || "danger",
      icon: config.icon || null,
      onConfirm: config.onConfirm || (() => {}),
    });
  };

  const closeConfirm = () => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  };

  const audioRef = useRef(null);
  const clipsRef = useRef(clips);

  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const filters = ["Title", "Artist", "Theme", "Movie"];

  const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(API.songs.all);
      setSongs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // Fetch all trim clips for the current user (GET /api/trimclips/user/{userId})
  // ==========================
  const fetchMyTrimClips = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;

    setLoadingMyTrims(true);
    try {
      const res = await axios.get(API.trimClips.byUser(user.UserId));
      setMyTrimClips(res.data || []);
    } catch (err) {
      console.error("Failed to load saved trims:", err);
    } finally {
      setLoadingMyTrims(false);
    }
  };

  useEffect(() => {
    fetchSongs();
    fetchMyTrimClips();
  }, []);

  // Fetch the logged-in user's own watermarks
  const fetchUserWatermarks = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;

    setLoadingWatermarks(true);
    try {
      const res = await axios.get(API.watermark.byUser(user.UserId));
      const list = res.data || [];
      setUserWatermarks(list);
      if (list.length > 0) {
        setSelectedWatermarkId((prev) => prev || list[0].WatermarkId);
      }
    } catch (err) {
      console.error("Failed to load watermarks:", err);
    } finally {
      setLoadingWatermarks(false);
    }
  };

  useEffect(() => {
    if (includeWatermark) {
      fetchUserWatermarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeWatermark]);

  // Upload a watermark file for the current user
  const handleUploadWatermark = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const user = getCurrentUser();
    if (!user.UserId) {
      setWatermarkUploadError("You must be logged in to upload a watermark");
      return;
    }

    setUploadingWatermark(true);
    setWatermarkUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("UserId", user.UserId);

      const res = await axios.post(API.watermark.add, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        await fetchUserWatermarks();
      } else {
        setWatermarkUploadError(res.data.message || "Watermark upload failed");
      }
    } catch (err) {
      console.error("Watermark upload error:", err);
      setWatermarkUploadError("Watermark upload failed. Please try again.");
    } finally {
      setUploadingWatermark(false);
      e.target.value = "";
    }
  };

  // Keep watermark locked at sequence 1 whenever the toggle changes
  useEffect(() => {
    setClips((prev) => {
      const withoutWatermark = prev.filter((c) => !c.isWatermark);
      const next = includeWatermark
        ? [{ ...WATERMARK_CLIP }, ...withoutWatermark]
        : withoutWatermark;
      return next.map((c, i) => ({ ...c, sequence: i + 1 }));
    });
    setSavedMedleyId(null);
    setMashupUrl(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeWatermark]);

  // Preview playback — play the pre-trimmed clip file if available,
  // otherwise fall back to the source song with a seek offset.
  useEffect(() => {
    if (playingClipIndex < 0 || playingClipIndex >= clipsRef.current.length) return;
    const clip = clipsRef.current[playingClipIndex];
    if (!audioRef.current) return;

    audioRef.current.pause();

    if (clip.filePath) {
      audioRef.current.src = buildFileUrl(clip.filePath);
      audioRef.current.load();
      audioRef.current.oncanplay = () => {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => console.error(err));
      };
    } else if (clip.songId) {
      const src = songs.find((s) => s.SongId === clip.songId);
      if (src) {
        audioRef.current.src = buildFileUrl(src.FilePath);
        audioRef.current.load();
        audioRef.current.oncanplay = () => {
          audioRef.current.currentTime = clip.startMs / 1000;
          audioRef.current.play().catch((err) => console.error(err));
        };
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playingClipIndex]);

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current || playingClipIndex < 0) return;
    const clip = clipsRef.current[playingClipIndex];
    if (!clip) return;

    if (!clip.filePath && audioRef.current.currentTime >= clip.endMs / 1000) {
      audioRef.current.pause();
      const nextIndex = playingClipIndex + 1;
      if (nextIndex < clipsRef.current.length) {
        setPlayingClipIndex(nextIndex);
      } else {
        handleStopOutput();
      }
    }
  };

  const handleAudioEnded = () => {
    if (playingClipIndex < 0) return;
    const nextIndex = playingClipIndex + 1;
    if (nextIndex < clipsRef.current.length) {
      setPlayingClipIndex(nextIndex);
    } else {
      handleStopOutput();
    }
  };

  const filteredSongs = songs.filter((song) => {
    const term = search.toLowerCase();
    if (filter === "Title") return song.SongTitle?.toLowerCase().includes(term);
    if (filter === "Artist") return song.ArtistName?.toLowerCase().includes(term);
    if (filter === "Movie") return song.MovieName?.toLowerCase().includes(term);
    if (filter === "Theme")
      return String(song.ThemeName ?? song.ThemeId ?? "")
        .toLowerCase()
        .includes(term);
    return true;
  });

  const formatMs = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleTrimSaved = (clip) => {
    setSavedMedleyId(null);
    setMashupUrl(null);
    setClips((prev) => [...prev, { ...clip, sequence: prev.length + 1 }]);
    // Refresh the "My Saved Trims" list so the new one appears there too
    fetchMyTrimClips();
  };

  // ==========================
  // Saved Trim → Queue toggle
  // ==========================
  const isTrimInQueue = (trimClipId) =>
    clips.some((c) => (c.trimClipId || c.TrimClipId) === trimClipId);

  const toggleTrimInQueue = (trim) => {
    const trimId = trim.TrimClipId;

    if (isTrimInQueue(trimId)) {
      // Remove from queue
      setClips((prev) => prev.filter((c) => (c.trimClipId || c.TrimClipId) !== trimId));
    } else {
      // Add to queue — normalize field names to lowercase (matches clips shape)
      const newClip = {
        trimClipId: trim.TrimClipId,
        clipName: trim.ClipName || `Clip #${trim.TrimClipId}`,
        startMs: trim.StartMs,
        endMs: trim.EndMs,
        songId: trim.SongId,
        songTitle: trim.SongTitle,
        artistName: trim.ArtistName,
        filePath: trim.FilePath,
      };
      setClips((prev) => [...prev, newClip]);
    }

    setSavedMedleyId(null);
    setMashupUrl(null);
  };

  // Preview a saved trim in-place (small audio element next to it)
  const toggleTrimPreview = (trimId) => {
    setTrimPreviewId((prev) => (prev === trimId ? null : trimId));
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    if (clips[index - 1]?.isWatermark) return;
    const updated = [...clips];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setClips(updated.map((c, i) => ({ ...c, sequence: i + 1 })));
    setSavedMedleyId(null);
    setMashupUrl(null);
  };

  const handleMoveDown = (index) => {
    if (index === clips.length - 1) return;
    if (clips[index]?.isWatermark) return;
    const updated = [...clips];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setClips(updated.map((c, i) => ({ ...c, sequence: i + 1 })));
    setSavedMedleyId(null);
    setMashupUrl(null);
  };

  const handlePlayOutput = () => {
    if (clips.length === 0) return;
    setPlayingClipIndex(0);
  };

  const handleStopOutput = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setPlayingClipIndex(-1);
  };

  // ==========================
  // REMOVE CLIP FROM QUEUE — now goes through ConfirmModal
  // ==========================
  const confirmRemoveClip = (clip, index) => {
    openConfirm({
      title: "Remove clip?",
      message: `Remove "${clip.clipName}" from this medley's queue?\n\nThis only removes it from the current queue — your saved trim will still be available in "My Saved Trims".`,
      confirmText: "Yes, Remove",
      variant: "warning",
      icon: "🗑️",
      onConfirm: () => handleRemoveClip(index),
    });
  };

  const handleRemoveClip = (index) => {
    setClips((prev) => prev.filter((_, i) => i !== index));
    setSavedMedleyId(null);
    closeConfirm();
  };

  // ================================================================
  // EXPORT MEDLEY — three-step backend flow
  //   1) POST /api/medleys/add                (create Medley row)
  //   2) POST /api/medleyclips/add (loop)     (link every TrimClip)
  //   3) POST /api/medleys/merge/{medleyId}   (FFmpeg concat)
  // ================================================================
  const handleExportMedley = async () => {
    if (clips.length === 0) {
      alert(
        "Your medley queue is empty. Trim a new clip, or check a saved trim from the 'My Saved Trims' list."
      );
      return;
    }

    if (!medleyName.trim()) {
      alert("Please enter a Medley Name before exporting");
      return;
    }

    if (includeWatermark && !selectedWatermarkId) {
      alert("Please select or upload your watermark before exporting");
      return;
    }

    const user = getCurrentUser();
    if (!user.UserId) {
      alert("You must be logged in to export a medley");
      return;
    }

    const totalDurationMs = clips.reduce(
      (sum, c) => sum + Math.max(0, (c.endMs || 0) - (c.startMs || 0)),
      0
    );

    const themeIdParsed = parseInt(medleyTheme, 10);
    const themeId = Number.isFinite(themeIdParsed) ? themeIdParsed : null;

    const createPayload = {
      MedleyName: medleyName.trim(),
      UserId: user.UserId,
      ThemeId: themeId,
      ClipCount: clips.length,
      ComposerName: medleyComposer.trim() || "",
      TotalDurationMs: totalDurationMs,
      IsFinal: false,
      OutputFilePath: "",
      WatermarkId: includeWatermark ? selectedWatermarkId : null,
      WatermarkStartTimeMs: includeWatermark ? watermarkStartTimeSec * 1000 : null,
    };

    setExporting(true);
    try {
      const createRes = await axios.post(API.medleys.add, createPayload);
      if (!createRes.data.success || !createRes.data.medleyId) {
        alert(createRes.data.message || "Failed to create medley");
        return;
      }
      const medleyId = createRes.data.medleyId;

      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const trimClipId = clip.trimClipId || clip.TrimClipId;
        if (!trimClipId) {
          console.warn("Skipping clip without TrimClipId:", clip);
          continue;
        }
        await axios.post(API.medleyClips.add, {
          MedleyId: medleyId,
          TrimClipId: trimClipId,
          SequenceNumber: i + 1,
        });
      }

      let mergedUrl = null;
      let renderError = null;
      try {
        const mergeRes = await axios.post(API.medleys.merge(medleyId));
        if (mergeRes.data.success && mergeRes.data.outputFilePath) {
          mergedUrl = buildFileUrl(mergeRes.data.outputFilePath);
        } else {
          renderError = mergeRes.data.message || "Merge failed";
        }
      } catch (mergeErr) {
        console.error("Merge error:", mergeErr);
        renderError =
          mergeErr.response?.data?.Message ||
          mergeErr.response?.data?.message ||
          mergeErr.message ||
          "Merge failed";
      }

      setSavedMedleyId(medleyId);
      setMashupUrl(mergedUrl);

      if (mergedUrl) {
        alert(
          `✅ Mashup ready!\nMedley ID: ${medleyId}\nClips: ${clips.length}\n\nYou can now play / download the mashup, or share it with other users.`
        );
      } else {
        alert(
          `⚠️ Medley saved (ID: ${medleyId}), but mashup rendering failed:\n${
            renderError || "Unknown error"
          }\n\nYou can retry export, or check the FFmpeg path on the server.`
        );
      }
    } catch (err) {
      console.error("Export error:", err);
      console.error("Export error response body:", err.response?.data);
      const serverMessage =
        err.response?.data?.Message ||
        err.response?.data?.message ||
        err.response?.data?.ExceptionMessage;
      alert(
        serverMessage ||
          "Export failed. Please try again. Check the console / network tab for the exact server error."
      );
    } finally {
      setExporting(false);
    }
  };

  // ================================================================
  // SHARE FLOW
  // ================================================================
  const handleOpenShare = async () => {
    if (!savedMedleyId) {
      alert("Please export / save the medley first before sharing.");
      return;
    }

    setShareError("");
    setShareSuccessMsg("");
    setSelectedUserIds([]);
    setUserDropdownOpen(false);
    setShowShareModal(true);
    setLoadingUsers(true);

    try {
      const res = await axios.get(API.users.all);
      const user = getCurrentUser();
      const others = (res.data || []).filter(
        (u) => (u.UserId || u.userId) !== user.UserId
      );
      setAllUsers(others);
    } catch (err) {
      console.error("Failed to load users:", err);
      setShareError("Could not load users list. Check that GET /api/users/all exists.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleConfirmShare = async () => {
    if (selectedUserIds.length === 0) {
      setShareError("Select at least one user to share with");
      return;
    }

    const user = getCurrentUser();
    setShareError("");
    setSharing(true);

    const results = { success: 0, failures: [] };

    try {
      for (const uid of selectedUserIds) {
        try {
          const response = await axios.post(API.medleyShare.share, {
            MedleyId: savedMedleyId,
            SharedByUserId: user.UserId,
            SharedWithUserId: uid,
          });
          if (response.data.success) {
            results.success += 1;
          } else {
            results.failures.push({ uid, msg: response.data.message || "Failed" });
          }
        } catch (err) {
          const serverMessage =
            err.response?.data?.Message || err.response?.data?.message || err.message;
          results.failures.push({ uid, msg: serverMessage || "Failed" });
        }
      }

      if (results.success > 0 && results.failures.length === 0) {
        setShareSuccessMsg(`Shared with ${results.success} user(s) successfully!`);
        setSelectedUserIds([]);
      } else if (results.success > 0 && results.failures.length > 0) {
        setShareSuccessMsg(`Shared with ${results.success} user(s).`);
        setShareError(
          `Failed for ${results.failures.length}: ${results.failures
            .map((f) => `#${f.uid} (${f.msg})`)
            .join(", ")}`
        );
      } else {
        setShareError(
          results.failures.map((f) => `#${f.uid}: ${f.msg}`).join("; ") ||
            "Failed to share medley"
        );
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <audio
        ref={audioRef}
        onTimeUpdate={handleAudioTimeUpdate}
        onEnded={handleAudioEnded}
      />

      {/* Header */}
      <div className="flex justify-between items-center px-5 pt-6 pb-3">
        <div>
          <p className="text-purple-400 font-bold text-sm">🎵 Medley Maker</p>
          <p className="text-gray-500 text-xs">Cut · Trim · Merge</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-semibold"
        >
          ⬆ Upload
        </button>
      </div>

      {/* Search */}
      <div className="px-5 mb-3">
        <input
          type="text"
          placeholder="Search songs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
        />
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2 px-5 mb-4 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap ${
              filter === f ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"
            }`}
          >
            {f === "Sad Song" && "🎵 "}
            {f === "Romentic song" && "🎤 "}
            {f === "Birthday song" && "🎨 "}
            {f === "Party song" && "🎬 "}
            {f}
          </button>
        ))}
      </div>

      {/* ============================================ */}
      {/* MY SAVED TRIM CLIPS — checkbox list          */}
      {/* ============================================ */}
      <div className="px-5 mb-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="font-bold text-lg">✂️ My Saved Trims</h2>
              <p className="text-gray-500 text-xs">
                Check the trims you want to include in this medley
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <button
                onClick={fetchMyTrimClips}
                className="text-gray-400 hover:text-white text-xs"
                title="Refresh"
              >
                ⟳
              </button>
              <button
                onClick={() => setShowMyTrims((prev) => !prev)}
                className="text-gray-400 hover:text-white text-xs"
              >
                {showMyTrims ? "▲ Hide" : "▼ Show"}
              </button>
            </div>
          </div>

          {showMyTrims && (
            <>
              {loadingMyTrims ? (
                <p className="text-gray-400 text-sm text-center py-4">Loading your trims...</p>
              ) : myTrimClips.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">
                  You haven't trimmed any clips yet. Select a song below and hit "Trim & Add to Queue".
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {myTrimClips.map((trim) => {
                    const checked = isTrimInQueue(trim.TrimClipId);
                    const previewing = trimPreviewId === trim.TrimClipId;
                    return (
                      <div
                        key={trim.TrimClipId}
                        className={`rounded-lg px-3 py-2 flex items-center gap-3 ${
                          checked ? "bg-purple-900 border border-purple-600" : "bg-gray-900"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTrimInQueue(trim)}
                          className="accent-purple-500 w-4 h-4 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {trim.ClipName || `Clip #${trim.TrimClipId}`}
                          </p>
                          <p className="text-gray-400 text-xs truncate">
                            {trim.SongTitle && `🎵 ${trim.SongTitle} · `}
                            {formatMs(trim.StartMs)} → {formatMs(trim.EndMs)} ·{" "}
                            {formatMs(trim.ClipLengthMs || trim.EndMs - trim.StartMs)}
                          </p>
                        </div>
                        <button
                          onClick={() => toggleTrimPreview(trim.TrimClipId)}
                          className="text-purple-400 hover:text-purple-300 text-xs flex-shrink-0"
                          title="Preview clip"
                        >
                          {previewing ? "⏸" : "▶"}
                        </button>
                        {previewing && trim.FilePath && (
                          <audio
                            ref={trimPreviewRef}
                            autoPlay
                            controls
                            src={buildFileUrl(trim.FilePath)}
                            onEnded={() => setTrimPreviewId(null)}
                            className="w-40 flex-shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {myTrimClips.length > 0 && (
                <p className="text-gray-500 text-xs mt-3 text-center">
                  {clips.filter((c) => !c.isWatermark).length} selected · Fill in Medley Name below and hit Export
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Choose a Track */}
      <div className="flex justify-between items-center px-5 mb-3">
        <div>
          <h2 className="font-bold text-lg">Choose a Track</h2>
          <p className="text-gray-500 text-xs">Select, trim & mix into your medley</p>
        </div>
        <div className="bg-purple-600 px-3 py-1 rounded-xl text-sm font-bold">
          {filteredSongs.length} tracks
        </div>
      </div>

      {/* Songs List */}
      <div className="px-5 space-y-2 mb-4">
        {loading ? (
          <p className="text-gray-400 text-center py-6">Loading songs...</p>
        ) : filteredSongs.length === 0 ? (
          <p className="text-gray-400 text-center py-6">No songs found</p>
        ) : (
          filteredSongs.map((song) => (
            <div
              key={song.SongId}
              className="bg-gray-800 rounded-xl px-4 py-3 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-sm">{song.SongTitle}</p>
                <p className="text-gray-400 text-xs">
                  • {song.ArtistName}
                  {song.DurationMs > 0 && ` · ${formatMs(song.DurationMs)}`}
                </p>
                {song.MovieName && (
                  <p className="text-gray-500 text-xs">🎬 {song.MovieName}</p>
                )}
                {song.ThemeName && (
                  <p className="text-gray-500 text-xs">🎨 {song.ThemeName}</p>
                )}
              </div>
              <button
                onClick={() => {
                  setSelectedSong(song);
                  setShowTrimmer(true);
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl text-sm font-semibold"
              >
                Select ›
              </button>
            </div>
          ))
        )}
      </div>

      {/* Medley Queue */}
      {clips.length > 0 && (
        <div className="px-5 mb-4">
          <div className="mb-3 space-y-2">
            <input
              type="text"
              placeholder="Medley Name"
              value={medleyName}
              onChange={(e) => setMedleyName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
            />
            <input
              type="text"
              placeholder="Theme Type"
              value={medleyTheme}
              onChange={(e) => setMedleyTheme(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
            />
            <input
              type="text"
              placeholder="Composer Name "
              value={medleyComposer}
              onChange={(e) => setMedleyComposer(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
            />
            {/* <input
              type="text"
              placeholder="Category Name "
              value={medleyCategory}
              onChange={(e) => setMedleyCategory(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
            /> */}
          </div>

          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold">
              Medley Queue
              {playingClipIndex >= 0 && (
                <span className="ml-2 text-purple-400 text-sm animate-pulse">
                  ▶ {playingClipIndex + 1}/{clips.length}
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleOpenShare}
                className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-lg text-xs"
                title={savedMedleyId ? "Share this medley" : "Export first to enable sharing"}
              >
                ↗ Share
              </button>
              <button
                onClick={playingClipIndex >= 0 ? handleStopOutput : handlePlayOutput}
                className="bg-purple-600 hover:bg-purple-700 px-3 py-1 rounded-lg text-xs"
              >
                {playingClipIndex >= 0 ? "⏹ Stop" : "▶ Preview"}
              </button>
            </div>
          </div>
          <p className="text-gray-500 text-xs mb-3">
            {clips.length} clips · reorder with arrows
            {savedMedleyId && (
              <span className="text-green-400"> · Saved (ID: {savedMedleyId})</span>
            )}
          </p>

          {mashupUrl && (
            <div className="bg-gray-800 rounded-xl p-3 mb-3">
              <p className="text-green-400 text-xs font-semibold mb-2">
                🎧 Full Mashup Ready
              </p>
              <audio controls src={mashupUrl} className="w-full mb-2" />
              <a href={mashupUrl} download className="text-purple-400 text-xs underline">
                ⬇ Download mashup file
              </a>
            </div>
          )}

          <div className="space-y-2">
            {clips.map((clip, index) => (
              <div
                key={index}
                className={`rounded-xl px-4 py-3 flex items-center gap-3 ${
                  clip.isWatermark
                    ? "bg-purple-950 border border-purple-700"
                    : playingClipIndex === index
                    ? "bg-purple-900 border border-purple-500"
                    : "bg-gray-800"
                }`}
              >
                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-bold text-purple-400">
                  {clip.isWatermark ? "🔖" : playingClipIndex === index ? "▶" : index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {clip.clipName}
                    {clip.isWatermark && (
                      <span className="ml-2 text-purple-400 text-xs">(locked)</span>
                    )}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {formatMs(clip.startMs)} → {formatMs(clip.endMs)} ·{" "}
                    {formatMs(clip.endMs - clip.startMs)}
                  </p>
                  {clip.songTitle && (
                    <p className="text-gray-500 text-xs">🎵 {clip.songTitle}</p>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0 || clip.isWatermark || clips[index - 1]?.isWatermark}
                    className="text-gray-400 hover:text-white disabled:opacity-30 text-xs"
                  >▲</button>
                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === clips.length - 1 || clip.isWatermark}
                    className="text-gray-400 hover:text-white disabled:opacity-30 text-xs"
                  >▼</button>
                </div>
                {!clip.isWatermark && (
                  // NEW — now opens ConfirmModal instead of deleting immediately
                  <button
                    onClick={() => confirmRemoveClip(clip, index)}
                    className="text-red-400 hover:text-red-300 text-lg"
                  >🗑</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Buttons */}
      {clips.length > 0 && (
        <div className="flex gap-3 px-5 pb-8">
          <button
            onClick={handleExportMedley}
            disabled={exporting}
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {exporting ? "Saving..." : savedMedleyId ? "✅ Saved — Export Again" : "↗ Export Medley"}
          </button>
          <button
            onClick={playingClipIndex >= 0 ? handleStopOutput : handlePlayOutput}
            className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold text-sm"
          >
            {playingClipIndex >= 0 ? "⏹ Stop" : "▶ Play Output"}
          </button>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50">
          <div className="bg-gray-900 p-6 rounded-2xl w-[500px] max-h-[80vh] overflow-y-auto text-white">
            <h2 className="text-xl font-bold mb-1">↗ Share Medley</h2>
            <p className="text-gray-400 text-sm mb-4">
              Select the users you want to share this medley with:
            </p>

            {loadingUsers ? (
              <p className="text-gray-400 text-sm text-center py-6">Loading users...</p>
            ) : allUsers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No users found</p>
            ) : (
              <div className="relative mb-4">
                <button
                  type="button"
                  onClick={() => setUserDropdownOpen((prev) => !prev)}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-left text-sm flex justify-between items-center"
                >
                  <span>
                    {selectedUserIds.length === 0
                      ? "Select users..."
                      : `${selectedUserIds.length} user(s) selected`}
                  </span>
                  <span className="text-gray-400">{userDropdownOpen ? "▲" : "▼"}</span>
                </button>

                {userDropdownOpen && (
                  <div className="absolute z-10 w-full bg-gray-800 border border-gray-600 rounded-lg mt-1 max-h-56 overflow-y-auto shadow-lg">
                    {allUsers.map((u) => {
                      const uid = u.UserId || u.userId;
                      const name = u.UserName || u.Name || u.Email || `User #${uid}`;
                      const checked = selectedUserIds.includes(uid);
                      return (
                        <label
                          key={uid}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-700 ${
                            checked ? "bg-purple-900" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleUserSelection(uid)}
                            className="accent-purple-500"
                          />
                          <span className="text-sm">{name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {shareError && <p className="text-red-400 text-sm mb-3">{shareError}</p>}
            {shareSuccessMsg && (
              <p className="text-green-400 text-sm mb-3">✅ {shareSuccessMsg}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleConfirmShare}
                disabled={sharing || loadingUsers}
                className="flex-1 bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50"
              >
                {sharing ? "Sharing..." : `Share with ${selectedUserIds.length || ""} user(s)`}
              </button>
              <button
                onClick={() => setShowShareModal(false)}
                className="flex-1 bg-red-500 hover:bg-red-600 py-3 rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AddNewSongModal
        isOpen={showUpload}
        onClose={() => setShowUpload(false)}
        onSongUploaded={() => fetchSongs()}
      />

      <SongTrimmerModal
        isOpen={showTrimmer}
        onClose={() => {
          setShowTrimmer(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
        onTrimSaved={handleTrimSaved}
      />

      {/* ================================================ */}
      {/* REUSABLE CONFIRM MODAL — used for all confirms   */}
      {/* ================================================ */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onClose={closeConfirm}
        onConfirm={confirmState.onConfirm}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        variant={confirmState.variant}
        icon={confirmState.icon}
      />

    </div>
  );
};

export default CreateMedley;