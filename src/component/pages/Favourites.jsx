import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const BASE_URL = "https://localhost:44307";

const getCurrentUser = () => JSON.parse(localStorage.getItem("user") || "{}");

const Favourites = () => {
  const navigate = useNavigate();
  const [favSongs, setFavSongs] = useState([]);
  const [favMedleys, setFavMedleys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);

  const fetchFavourites = async () => {
    const user = getCurrentUser();
    if (!user.UserId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [songsRes, medleysRes] = await Promise.all([
        axios.get(`${BASE_URL}/api/favorites/songs/${user.UserId}`),
        axios.get(`${BASE_URL}/api/favorites/medleys/${user.UserId}`)
      ]);
      setFavSongs(songsRes.data || []);
      setFavMedleys(medleysRes.data || []);
    } catch (err) {
      console.error("Failed to load favourites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  const removeFavouriteSong = async (songId) => {
    const user = getCurrentUser();
    try {
      await axios.delete(`${BASE_URL}/api/favorites/remove`, {
        params: { userId: user.UserId, itemType: "Song", itemId: songId }
      });
      setFavSongs((prev) => prev.filter((s) => s.SongId !== songId));
    } catch (err) {
      console.error("Remove favourite failed:", err);
    }
  };

  const removeFavouriteMedley = async (medleyId) => {
    const user = getCurrentUser();
    try {
      await axios.delete(`${BASE_URL}/api/favorites/remove`, {
        params: { userId: user.UserId, itemType: "Medley", itemId: medleyId }
      });
      setFavMedleys((prev) => prev.filter((m) => m.MedleyId !== medleyId));
    } catch (err) {
      console.error("Remove favourite failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white px-5 py-8">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => navigate("/home")}
          className="text-gray-400 hover:text-white text-xl"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold">❤️ Favourites</h1>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-10">Loading...</p>
      ) : favSongs.length === 0 && favMedleys.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">🤍</p>
          <p className="text-gray-400">No favourites yet.</p>
          <p className="text-gray-500 text-sm mt-1">
            Add songs or medleys from Library by tapping ❤️
          </p>
        </div>
      ) : (
        <>
          {/* Songs */}
          {favSongs.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-bold mb-3">🎵 Songs</h2>
              <div className="space-y-3">
                {favSongs.map((song) => (
                  <div
                    key={song.SongId}
                    className="bg-gray-800 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{song.SongTitle}</p>
                        <p className="text-gray-400 text-sm">
                          {song.ArtistName}
                          {song.MovieName && ` • ${song.MovieName}`}
                        </p>
                      </div>

                      <div className="flex gap-2 items-center">
                        <button
                          onClick={() =>
                            setCurrentlyPlaying(
                              currentlyPlaying === `song-${song.SongId}` ? null : `song-${song.SongId}`
                            )
                          }
                          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm"
                        >
                          {currentlyPlaying === `song-${song.SongId}` ? "⏸" : "▶"}
                        </button>

                        <button
                          onClick={() => removeFavouriteSong(song.SongId)}
                          className="text-red-400 hover:text-red-300 text-xl"
                        >
                          ❤️
                        </button>
                      </div>
                    </div>

                    {currentlyPlaying === `song-${song.SongId}` && (
                      <audio
                        className="w-full mt-3"
                        src={`${BASE_URL}/api/songs/stream/${song.SongId}`}
                        controls
                        autoPlay
                        onEnded={() => setCurrentlyPlaying(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medleys */}
          {favMedleys.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">🎧 Medleys</h2>
              <div className="space-y-3">
                {favMedleys.map((medley) => (
                  <div
                    key={medley.MedleyId}
                    className="bg-gray-800 rounded-xl p-4"
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-semibold">{medley.MedleyName}</p>
                        <p className="text-gray-400 text-sm">
                          {medley.ClipCount} clips
                        </p>
                      </div>

                      <div className="flex gap-2 items-center">
                        {medley.OutputFilePath && (
                          <button
                            onClick={() =>
                              setCurrentlyPlaying(
                                currentlyPlaying === `medley-${medley.MedleyId}` ? null : `medley-${medley.MedleyId}`
                              )
                            }
                            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm"
                          >
                            {currentlyPlaying === `medley-${medley.MedleyId}` ? "⏸" : "▶"}
                          </button>
                        )}

                        <button
                          onClick={() => removeFavouriteMedley(medley.MedleyId)}
                          className="text-red-400 hover:text-red-300 text-xl"
                        >
                          ❤️
                        </button>
                      </div>
                    </div>

                    {currentlyPlaying === `medley-${medley.MedleyId}` && (
                      <audio
                        className="w-full mt-3"
                        src={`${BASE_URL}/api/medley/download/${medley.MedleyId}`}
                        controls
                        autoPlay
                        onEnded={() => setCurrentlyPlaying(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Favourites;