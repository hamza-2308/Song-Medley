import { useState, useEffect } from "react";
import SongList from "../SongList";

const LibraryModal = ({ isOpen, onClose, onSelectSong }) => {
  const [search, setSearch] = useState("");
  const [favourites, setFavourites] = useState([]);
  const [audioBustToken, setAudioBustToken] = useState(Date.now());

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("favourites") || "[]");
    setFavourites(saved);
  }, [isOpen]);

  const isFavourite = (songId) => {
    return favourites.some((f) => f.SongId === songId);
  };

  const toggleFavourite = (song) => {
    let updated;
    if (isFavourite(song.SongId)) {
      updated = favourites.filter((f) => f.SongId !== song.SongId);
    } else {
      updated = [...favourites, song];
    }
    setFavourites(updated);
    localStorage.setItem("favourites", JSON.stringify(updated));
  };
  // Adds a cache-busting query param so the browser doesn't play a
// stale copy after the backend re-renders the mashup file.
const buildAudioUrl = (path) => {
  if (!path) return "";
  const base = buildFileUrl(path);
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}v=${audioBustToken}`;
};

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-gray-900 p-6 rounded-xl w-[600px] max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4 text-white">
          Search Library
        </h2>

        <input
          type="text"
          placeholder="Search Song..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border p-3 rounded-lg mb-4 text-black"
        />

        <div className="border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
          <SongList
            searchTerm={search}
            onSelectSong={(song) => {
              if (onSelectSong) onSelectSong(song);
              onClose();
            }}
            onToggleFavourite={toggleFavourite}
            isFavourite={isFavourite}
          />
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 bg-red-500 text-white py-3 rounded-lg"
        >
          Close
        </button>
      </div>
    </div>
  );
};

export default LibraryModal;