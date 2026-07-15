import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import SongTrimmerModal from "../modal/SongTrimmerModal";
import AddNewSongModal from "../modal/NewSongModal";

const BASE_URL = "https://localhost:44307";

// Fixed watermark clip — always the same TrimClipId, always locked at sequence 1
const WATERMARK_TRIM_CLIP_ID = 1047;
const WATERMARK_CLIP = {
  trimClipId: WATERMARK_TRIM_CLIP_ID,
  clipName: "watermark",
  startMs: 0,
  endMs: 6321,
  songTitle: "watermark",
  isWatermark: true
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

  // Watermark toggle
  const [includeWatermark, setIncludeWatermark] = useState(false);

  // NEW: real, per-user, backend-driven watermark (tied to Medley.WatermarkId / WatermarkStartTimeMs)
  const [userWatermarks, setUserWatermarks] = useState([]);
  const [loadingWatermarks, setLoadingWatermarks] = useState(false);
  const [selectedWatermarkId, setSelectedWatermarkId] = useState(null);
  const [watermarkStartTimeSec, setWatermarkStartTimeSec] = useState(0);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);
  const [watermarkUploadError, setWatermarkUploadError] = useState("");

  // Medley must be saved before it can be shared
  const [savedMedleyId, setSavedMedleyId] = useState(null);

  // Medley Name + Theme (set by user before export, used for save + share)
  const [medleyName, setMedleyName] = useState("");
  const [medleyTheme, setMedleyTheme] = useState("");

  // URL of the FFmpeg-rendered single mashup file (null until render succeeds)
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
      const res = await axios.get(`${BASE_URL}/api/songs/all`);
      setSongs(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, []);

  // NEW: fetch the logged-in user's own watermarks from the backend
  const fetchUserWatermarks = async () => {
    const user = getCurrentUser();
    if (!user.UserId) return;

    setLoadingWatermarks(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/watermark/user/${user.UserId}`);
      const list = res.data || [];
      setUserWatermarks(list);

      // Agar user ka pehle se koi watermark hai aur abhi tak koi select nahi hua, default select kar do
      if (list.length > 0) {
        setSelectedWatermarkId((prev) => prev || list[0].WatermarkId);
      }
    } catch (err) {
      console.error("Failed to load watermarks:", err);
    } finally {
      setLoadingWatermarks(false);
    }
  };

  // NEW: jab bhi watermark toggle ON ho, us user ke watermarks fetch karo
  useEffect(() => {
    if (includeWatermark) {
      fetchUserWatermarks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeWatermark]);

  // NEW: user apna khud ka watermark file upload kare (POST /api/watermark/add)
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

      const res = await axios.post(`${BASE_URL}/api/watermark/add`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
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

  useEffect(() => {
    if (playingClipIndex >= 0 && playingClipIndex < clipsRef.current.length) {
      const clip = clipsRef.current[playingClipIndex];
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = `${BASE_URL}/api/songs/stream/${clip.songId}`;
        audioRef.current.load();
        audioRef.current.oncanplay = () => {
          audioRef.current.currentTime = clip.startMs / 1000;
          audioRef.current.play().catch((err) => console.error(err));
        };
      }
    }
  }, [playingClipIndex]);

  const handleAudioTimeUpdate = () => {
    if (!audioRef.current || playingClipIndex < 0) return;
    const clip = clipsRef.current[playingClipIndex];
    if (!clip) return;
    if (audioRef.current.currentTime >= clip.endMs / 1000) {
      audioRef.current.pause();
      const nextIndex = playingClipIndex + 1;
      if (nextIndex < clipsRef.current.length) {
        setPlayingClipIndex(nextIndex);
      } else {
        handleStopOutput();
      }
    }
  };

  const filteredSongs = songs.filter((song) => {
    const term = search.toLowerCase();
    if (filter === "Title") return song.SongTitle.toLowerCase().includes(term);
    if (filter === "Artist") return song.ArtistName.toLowerCase().includes(term);
    if (filter === "Movie") return song.MovieName?.toLowerCase().includes(term);
    if (filter === "Theme") return song.ThemeId?.toLowerCase().includes(term);
    return true;
  });

  const formatMs = (ms) => {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const handleTrimSaved = (clip) => {
    // A fresh set of clips means any previously-saved medley/mashup is stale
    setSavedMedleyId(null);
    setMashupUrl(null);
    setClips((prev) => [...prev, { ...clip, sequence: prev.length + 1 }]);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    if (clips[index - 1]?.isWatermark) return; // can't swap into the watermark's locked slot
    const updated = [...clips];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setClips(updated.map((c, i) => ({ ...c, sequence: i + 1 })));
    setSavedMedleyId(null);
    setMashupUrl(null);
  };

  const handleMoveDown = (index) => {
    if (index === clips.length - 1) return;
    if (clips[index]?.isWatermark) return; // watermark itself can't move
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

  const handleExportMedley = async () => {
    if (clips.length === 0) return;

    if (!medleyName.trim()) {
      alert("Please enter a Medley Name before exporting");
      return;
    }

    // NEW: agar watermark toggle ON hai to watermark select/upload hona zaroori hai
    if (includeWatermark && !selectedWatermarkId) {
      alert("Please select or upload your watermark before exporting");
      return;
    }

    const user = getCurrentUser();

    if (!user.UserId) {
      alert("You must be logged in to export a medley");
      return;
    }

    const payload = {
      MedleyName: medleyName.trim(),
      ThemeId: medleyTheme.trim() || null,
      UserId: user.UserId,
      Clips: clips.map((clip, index) => ({
        TrimClipId: clip.trimClipId || clip.TrimClipId,
        SequenceNumber: index + 1
      })),
      // NEW: real watermark reference + start time (seconds -> ms)
      WatermarkId: includeWatermark ? selectedWatermarkId : null,
      WatermarkStartTimeMs: includeWatermark ? watermarkStartTimeSec * 1000 : null
    };

    setExporting(true);
    try {
      const response = await axios.post(`${BASE_URL}/api/medley/create`, payload);
      if (response.data.success) {
        setSavedMedleyId(response.data.medleyId);

        if (response.data.outputFilePath) {
          setMashupUrl(`${BASE_URL}/api/medley/download/${response.data.medleyId}`);
          alert(
            `✅ Mashup ready!\nMedley ID: ${response.data.medleyId}\nClips: ${response.data.clipCount}\n\nYou can now play/download the mashup, or share it with other users.`
          );
        } else {
          setMashupUrl(null);
          alert(
            `⚠️ Medley saved, but mashup rendering failed:\n${response.data.renderError || "Unknown error"}\n\nYou can retry export, or contact support if this keeps happening.`
          );
        }
      } else {
        alert(response.data.message || "Failed to save medley");
      }
    } catch (err) {
      console.error("Export error:", err);
      const serverMessage = err.response?.data?.Message || err.response?.data?.message;
      alert(serverMessage || "Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  // ==========================
  // SHARE FLOW (DB-backed, multiple users)
  // ==========================
  const handleOpenShare = async () => {
    if (!savedMedleyId) {
      alert("Please export/save the medley first before sharing.");
      return;
    }

    setShareError("");
    setShareSuccessMsg("");
    setSelectedUserIds([]);
    setUserDropdownOpen(false);
    setShowShareModal(true);
    setLoadingUsers(true);

    try {
      // Assumed endpoint, matching the api/songs/all pattern.
      // If your Users endpoint has a different route, update this URL.
      const res = await axios.get(`${BASE_URL}/api/users/all`);
      const user = getCurrentUser();
      const others = (res.data || []).filter(
        (u) => (u.UserId || u.userId) !== user.UserId
      );
      setAllUsers(others);
    } catch (err) {
      console.error("Failed to load users:", err);
      setShareError(
        "Could not load users list. Check that GET /api/users/all exists."
      );
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

    try {
      const response = await axios.post(`${BASE_URL}/api/medley/share`, {
        MedleyId: savedMedleyId,
        SharedByUserId: user.UserId,
        SharedWithUserIds: selectedUserIds
      });

      if (response.data.success) {
        setShareSuccessMsg(response.data.message || "Medley shared successfully!");
        setSelectedUserIds([]);
      } else {
        setShareError(response.data.message || "Failed to share medley");
      }
    } catch (err) {
      console.error("Share error:", err);
      const serverMessage = err.response?.data?.Message || err.response?.data?.message;
      setShareError(serverMessage || "Sharing failed. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      <audio ref={audioRef} onTimeUpdate={handleAudioTimeUpdate} />

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
            {f === "Title" && "🎵 "}
            {f === "Artist" && "🎤 "}
            {f === "Theme" && "🎨 "}
            {f === "Movie" && "🎬 "}
            {f}
          </button>
        ))}
      </div>

      {/* Watermark Toggle — always visible, independent of queue state */}
      <div className="px-5 mb-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800 rounded-xl px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={includeWatermark}
            onChange={(e) => setIncludeWatermark(e.target.checked)}
            className="accent-purple-500 w-4 h-4"
          />
          🔖 Add Watermark (always first, position locked)
        </label>

        {/* NEW: per-user watermark selection — tied to Medley.WatermarkId / WatermarkStartTimeMs */}
        {includeWatermark && (
          <div className="mt-2 bg-gray-800 rounded-xl px-4 py-3 space-y-3">
            {loadingWatermarks ? (
              <p className="text-gray-400 text-xs">Loading your watermarks...</p>
            ) : userWatermarks.length === 0 ? (
              <p className="text-gray-400 text-xs">
                You don't have a watermark uploaded yet — upload one below.
              </p>
            ) : (
              <div>
                <label className="text-gray-400 text-xs block mb-1">
                  Your watermark
                </label>
                <select
                  value={selectedWatermarkId || ""}
                  onChange={(e) => setSelectedWatermarkId(Number(e.target.value))}
                  className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-white text-sm"
                >
                  {userWatermarks.map((w) => (
                    <option key={w.WatermarkId} value={w.WatermarkId}>
                      {w.FilePath.split("/").pop()}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-gray-400 text-xs block mb-1">
                Watermark start time (seconds)
              </label>
              <input
                type="number"
                min="0"
                value={watermarkStartTimeSec}
                onChange={(e) => setWatermarkStartTimeSec(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-700 p-2 rounded-lg text-white text-sm"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs block mb-1">
                {userWatermarks.length === 0
                  ? "Upload your watermark"
                  : "Upload a different watermark"}
              </label>
              <input
                type="file"
                accept="audio/*"
                onChange={handleUploadWatermark}
                disabled={uploadingWatermark}
                className="w-full text-xs text-gray-300"
              />
              {uploadingWatermark && (
                <p className="text-purple-400 text-xs mt-1">Uploading...</p>
              )}
              {watermarkUploadError && (
                <p className="text-red-400 text-xs mt-1">{watermarkUploadError}</p>
              )}
            </div>
          </div>
        )}
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
                {song.ThemeId && (
  <p className="text-gray-500 text-xs">🎨 {song.ThemeId}</p>
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
          {/* Medley Name + Theme (used when saving/exporting and later when sharing) */}
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
              placeholder="Theme (optional)"
              value={medleyTheme}
              onChange={(e) => setMedleyTheme(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 p-3 rounded-xl text-white placeholder-gray-500 text-sm"
            />
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
              <a>
                href={mashupUrl}
                download
                className="text-purple-400 text-xs underline"
              
              
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
                    {formatMs(clip.startMs)} → {formatMs(clip.endMs)} · {formatMs(clip.endMs - clip.startMs)}
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
                  <button
                    onClick={() => {
                      setClips(clips.filter((_, i) => i !== index));
                      setSavedMedleyId(null);
                    }}
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

      {/* Share Modal — pick users from DB, save to MedleyShare table */}
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
            {shareSuccessMsg && <p className="text-green-400 text-sm mb-3">✅ {shareSuccessMsg}</p>}

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

    </div>
  );
};

export default CreateMedley;