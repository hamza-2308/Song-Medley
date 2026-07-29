import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { API, buildFileUrl } from "../service/ipConfig";
import {
  getFavouriteSongIds,
  getFavouriteMedleyIds,
  toggleFavouriteSong,
  toggleFavouriteMedley,
} from "../service/favouritesStorage";

const Favourites = () => {
  const navigate = useNavigate();
  const [favSongs, setFavSongs] = useState([]);
  const [favMedleys, setFavMedleys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);

  // Favourites are stored as just an array of IDs in localStorage.
  // We fetch the full song/medley lists and filter down to the
  // favourited IDs — no dedicated backend endpoint required.
  const fetchFavourites = async () => {
    setLoading(true);
    try {
      const favSongIds = getFavouriteSongIds();
      const favMedleyIds = getFavouriteMedleyIds();

      const [songsRes, medleysRes] = await Promise.all([
        favSongIds.length > 0 ? axios.get(API.songs.all) : Promise.resolve({ data: [] }),
        favMedleyIds.length > 0 ? axios.get(API.medleys.all) : Promise.resolve({ data: [] }),
      ]);

      const allSongs = songsRes.data || [];
      const allMedleys = medleysRes.data || [];

      setFavSongs(allSongs.filter((s) => favSongIds.includes(s.SongId)));
      setFavMedleys(allMedleys.filter((m) => favMedleyIds.includes(m.MedleyId)));
    } catch (err) {
      console.error("Failed to load favourites:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  const removeFavouriteSong = (songId) => {
    toggleFavouriteSong(songId);
    setFavSongs((prev) => prev.filter((s) => s.SongId !== songId));
    if (currentlyPlaying === `song-${songId}`) setCurrentlyPlaying(null);
  };

  const removeFavouriteMedley = (medleyId) => {
    toggleFavouriteMedley(medleyId);
    setFavMedleys((prev) => prev.filter((m) => m.MedleyId !== medleyId));
    if (currentlyPlaying === `medley-${medleyId}`) setCurrentlyPlaying(null);
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
            Add songs or medleys by tapping the heart icon
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
                  <div key={song.SongId} className="bg-gray-800 rounded-xl p-4">
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
                              currentlyPlaying === `song-${song.SongId}`
                                ? null
                                : `song-${song.SongId}`
                            )
                          }
                          className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg text-sm"
                        >
                          {currentlyPlaying === `song-${song.SongId}` ? "⏸" : "▶"}
                        </button>

                        <button
                          onClick={() => removeFavouriteSong(song.SongId)}
                          className="text-red-400 hover:text-red-300 text-xl"
                          title="Remove from favourites"
                        >
                          ❤️
                        </button>
                      </div>
                    </div>

                    {currentlyPlaying === `song-${song.SongId}` && (
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
            </div>
          )}

          {/* Medleys */}
          {favMedleys.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-3">🎧 Medleys</h2>
              <div className="space-y-3">
                {favMedleys.map((medley) => (
                  <div key={medley.MedleyId} className="bg-gray-800 rounded-xl p-4">
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
                                currentlyPlaying === `medley-${medley.MedleyId}`
                                  ? null
                                  : `medley-${medley.MedleyId}`
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
                          title="Remove from favourites"
                        >
                          ❤️
                        </button>
                      </div>
                    </div>

                    {currentlyPlaying === `medley-${medley.MedleyId}` && (
                      <audio
                        className="w-full mt-3"
                        src={buildFileUrl(medley.OutputFilePath)}
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