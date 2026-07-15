import { useState, useEffect } from "react";
import axios from "axios";
import SongTrimmerModal from "./modal/SongTrimmerModal";

const SongList = ({ onSelectSong, searchTerm = "", onToggleFavourite, isFavourite }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);
  const [selectedSong, setSelectedSong] = useState(null);
  const [showTrimmer, setShowTrimmer] = useState(false);

  const BASE_URL = "https://localhost:44307";

  useEffect(() => {
    fetchSongs();
  }, []);

  const fetchSongs = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${BASE_URL}/api/songs/all`);
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
              </div>
            </div>

            {currentlyPlaying === song.SongId && (
              <audio
                className="w-full mt-3"
                src={`${BASE_URL}${song.FilePath}`}
                controls
                autoPlay
                onEnded={() => setCurrentlyPlaying(null)}
              />
            )}
          </div>
        ))}
      </div>

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
    </>
  );
};

export default SongList;