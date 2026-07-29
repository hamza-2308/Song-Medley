import { useState, useEffect } from "react";
import axios from "axios";
import SongTrimmerModal from "./modal/SongTrimmerModal";
import { API, buildFileUrl } from "./service/ipConfig";
import ConfirmModal from "./ConfirmModal"; // ← NEW IMPORT

const SongList = ({
  onSelectSong,
  searchTerm = "",
  onToggleFavourite,
  isFavourite,
  onSongDeleted, // optional callback(songId) — lets a parent (e.g. favourites list) react to a delete
}) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showTrimmer, setShowTrimmer] = useState(false);

  // Track which song is currently being deleted (disables its buttons + shows spinner in modal)
  const [deletingSongId, setDeletingSongId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

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

  const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(API.songs.all);
      setSongs(response.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load songs.");
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = (songId) => {
    setCurrentlyPlaying(songId === currentlyPlaying ? null : songId);
  };

  const handleSelect = (song) => {
    setSelectedSong(song);
    setShowTrimmer(true);
  };

  // ==========================
  // DELETE SONG — soft delete via ConfirmModal
  // Hits DELETE /api/songs/delete/{id}?userId={id} (SongController.DeleteSong)
  // Song moves to "Recently Deleted" on the backend, so wording reflects that.
  // ==========================
  const confirmDeleteSong = (song) => {
    setDeleteError("");
    openConfirm({
      title: "Delete song?",
      message: `"${song.SongTitle}" will be moved to Recently Deleted.\n\nYou (or an admin) can restore it later from there.`,
      confirmText: "Yes, Delete",
      variant: "danger",
      icon: "🗑️",
      onConfirm: () => handleDeleteSong(song),
    });
  };

  const handleDeleteSong = async (song) => {
    const user = getCurrentUser();
    setDeletingSongId(song.SongId);
    try {
      const res = await axios.delete(API.songs.delete(song.SongId), {
        params: { userId: user.UserId || 0 },
      });

      if (res.data.success) {
        setSongs((prev) => prev.filter((s) => s.SongId !== song.SongId));
        if (currentlyPlaying === song.SongId) setCurrentlyPlaying(null);
        onSongDeleted?.(song.SongId);
        closeConfirm();
      } else {
        setDeleteError(res.data.message || "Delete failed");
      }
    } catch (err) {
      setDeleteError(
        err.response?.data?.Message || err.response?.data?.message || "Delete failed"
      );
    } finally {
      setDeletingSongId(null);
    }
  };

  const filteredSongs = songs.filter((song) =>
    song.SongTitle.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <p className="text-gray-400 text-center py-6">Loading songs...</p>;
  if (error) return <p className="text-red-500 text-center py-6">{error}</p>;
  if (filteredSongs.length === 0) return <p className="text-gray-400 text-center py-6">No songs found.</p>;

  return (
    <>
      <div className="space-y-3 w-full">
        {filteredSongs.map((song) => (
          <div key={song.SongId} className="bg-gray-800 rounded-xl p-4 text-white">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-lg">{song.SongTitle}</h3>
                <p className="text-gray-400 text-sm">
                  {song.ArtistName} {song.MovieName && `• ${song.MovieName}`}
                </p>
              </div>

              <div className="flex gap-2 items-center">

                {/* Favourite Button */}
                {onToggleFavourite && (
                  <button
                    onClick={() => onToggleFavourite(song)}
                    className="text-xl"
                    title={isFavourite && isFavourite(song.SongId) ? "Remove from favourites" : "Add to favourites"}
                  >
                    {isFavourite && isFavourite(song.SongId) ? "❤️" : "🤍"}
                  </button>
                )}

                {/* Play Button */}
                <button
                  onClick={() => handlePlay(song.SongId)}
                  className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm"
                >
                  {currentlyPlaying === song.SongId ? "⏸ Pause" : "▶ Play"}
                </button>

                {/* Select Button */}
                {onSelectSong && (
                  <button
                    onClick={() => handleSelect(song)}
                    className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm"
                  >
                    Select
                  </button>
                )}

                {/* Delete Button — NEW, now goes through ConfirmModal */}
                <button
                  onClick={() => confirmDeleteSong(song)}
                  disabled={deletingSongId === song.SongId}
                  title="Delete song"
                  className="text-red-400 hover:text-red-300 disabled:opacity-40 text-lg px-1"
                >
                  🗑
                </button>
              </div>
            </div>

            {currentlyPlaying === song.SongId && (
              <audio
                className="w-full mt-3"
                src={buildFileUrl(song.FilePath)}
                controls
                autoPlay
                onEnded={() => setCurrentlyPlaying(null)}
              />
            )}
          </div>
        ))}
      </div>

      {deleteError && (
        <p className="text-red-400 text-sm text-center mt-2">{deleteError}</p>
      )}

      {/* Trimmer Modal */}
      <SongTrimmerModal
        isOpen={showTrimmer}
        onClose={() => {
          setShowTrimmer(false);
          setSelectedSong(null);
        }}
        song={selectedSong}
        onTrimSaved={(clip) => {
          if (onSelectSong) onSelectSong(clip);
        }}
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
        isLoading={deletingSongId !== null}
      />
    </>
  );
};

export default SongList;