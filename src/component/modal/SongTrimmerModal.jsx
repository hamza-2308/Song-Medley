import { useState, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import { API, buildFileUrl } from "../service/ipConfig";

const SongTrimmerModal = ({ isOpen, onClose, song, onTrimSaved }) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const regionsPlugin = useRef(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [clipName, setClipName] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen || !song || !waveformRef.current) return;

    setLoading(true);
    setStartMs(0);
    setEndMs(0);
    setCurrentTime(0);
    setIsPlaying(false);

    if (wavesurfer.current) {
      wavesurfer.current.destroy();
      wavesurfer.current = null;
    }

    regionsPlugin.current = RegionsPlugin.create();

    wavesurfer.current = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: "#6b21a8",
      progressColor: "#a855f7",
      cursorColor: "#ffffff",
      barWidth: 3,
      barRadius: 3,
      height: 120,
      plugins: [regionsPlugin.current],
    });

    // Backend has no /api/songs/stream/{id} endpoint — the mp3 is served
    // as a static file at song.FilePath (e.g. "/Uploads/xyz.mp3").
    wavesurfer.current.load(buildFileUrl(song.FilePath));

    wavesurfer.current.on("ready", () => {
      const dur = wavesurfer.current.getDuration();
      setDuration(dur);
      setStartMs(0);
      setEndMs(Math.floor(dur * 1000));

      regionsPlugin.current.addRegion({
        id: "trim-region",
        start: 0,
        end: dur,
        color: "rgba(168, 85, 247, 0.25)",
        drag: true,
        resize: true,
      });

      setLoading(false);
    });

    regionsPlugin.current.on("region-updated", (region) => {
      setStartMs(Math.floor(region.start * 1000));
      setEndMs(Math.floor(region.end * 1000));
    });

    wavesurfer.current.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    wavesurfer.current.on("finish", () => {
      setIsPlaying(false);
    });

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
    };
  }, [isOpen, song]);

  if (!isOpen || !song) return null;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatMs = (ms) => formatTime(ms / 1000);

  const handlePlayPause = () => {
    if (!wavesurfer.current) return;
    if (isPlaying) {
      wavesurfer.current.pause();
      setIsPlaying(false);
    } else {
      wavesurfer.current.play(startMs / 1000, endMs / 1000);
      setIsPlaying(true);
    }
  };

  const handleSkip = (seconds) => {
    if (!wavesurfer.current || duration === 0) return;
    const current = wavesurfer.current.getCurrentTime();
    const newTime = Math.min(Math.max(0, current + seconds), duration);
    wavesurfer.current.seekTo(newTime / duration);
  };

  const handleSaveTrim = async () => {
    if (!clipName.trim()) {
      setError("Clip name is required");
      return;
    }
    if (startMs >= endMs) {
      setError("End time must be greater than Start time");
      return;
    }
    if (endMs - startMs < 1000) {
      setError("Clip must be at least 1 second long");
      return;
    }

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.UserId) {
      setError("You must be logged in to save a clip");
      return;
    }

    setError("");
    setSaving(true);

    try {
      // Backend expects query-string params, not JSON body:
      //   POST /api/trimclips/create?songId=&userId=&startMs=&endMs=&clipName=
      const params = new URLSearchParams({
        songId: song.SongId,
        userId: user.UserId,
        startMs: String(startMs),
        endMs: String(endMs),
        clipName: clipName.trim(),
      });
      const url = `${API.trimClips.create}?${params.toString()}`;

      const response = await fetch(url, { method: "POST" });

      if (!response.ok) {
        let message = "Failed to save clip";
        try {
          const errData = await response.json();
          message = errData.message || errData.Message || message;
        } catch {
          // response wasn't JSON — keep generic message
        }
        setError(message);
        return;
      }

      const data = await response.json();

      if (data.success) {
        if (onTrimSaved)
          onTrimSaved({
            trimClipId: data.trimClipId,
            clipName: clipName.trim(),
            startMs,
            endMs,
            songId: song.SongId,
            songTitle: song.SongTitle,
            artistName: song.ArtistName,
            filePath: data.file, // backend returns { file: "/Uploads/Clips/clip_xxx.mp3" }
          });
        setClipName("");
        setError("");
      } else {
        setError(data.message || "Failed to save clip");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex justify-center items-center z-50">
      <div className="bg-gray-900 text-white p-6 rounded-2xl w-[650px] max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">{song.SongTitle}</h2>
            <p className="text-gray-400 text-sm">{song.ArtistName}</p>
          </div>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm"
          >
            ✕ Close
          </button>
        </div>

        {/* Time Display */}
        <div className="flex justify-between bg-gray-800 rounded-lg p-3 mb-3">
          <div>
            <p className="text-gray-400 text-xs">START</p>
            <p className="text-blue-400 font-bold text-lg">{formatMs(startMs)}</p>
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-xs">CURRENT</p>
            <p className="text-white font-bold text-lg">{formatTime(currentTime)}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">END</p>
            <p className="text-orange-400 font-bold text-lg">{formatMs(endMs)}</p>
          </div>
        </div>

        {/* Waveform */}
        <div className="bg-gray-800 rounded-lg p-3 mb-4">
          {loading && (
            <div className="flex items-center justify-center py-8 gap-2">
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
              <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
              <p className="text-gray-400 ml-2">Loading waveform...</p>
            </div>
          )}
          <div ref={waveformRef} />
          {!loading && (
            <p className="text-gray-500 text-xs text-center mt-2">
              Drag purple region edges to set Start & End points
            </p>
          )}
        </div>

        {/* Player Controls */}
        <div className="flex justify-center items-center gap-4 mb-4">
          <button
            onClick={() => handleSkip(-5)}
            className="bg-gray-700 hover:bg-gray-600 w-10 h-10 rounded-full flex items-center justify-center"
          >⏪</button>
          <button
            onClick={handlePlayPause}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 w-14 h-14 rounded-full text-2xl flex items-center justify-center disabled:opacity-50"
          >
            {isPlaying ? "⏸" : "▶️"}
          </button>
          <button
            onClick={() => handleSkip(5)}
            className="bg-gray-700 hover:bg-gray-600 w-10 h-10 rounded-full flex items-center justify-center"
          >⏩</button>
        </div>

        {/* Clip Duration */}
        {endMs > startMs && (
          <p className="text-green-400 text-sm mb-3 text-center">
            ✅ Clip Duration: {formatMs(endMs - startMs)}
          </p>
        )}

        {/* Clip Name */}
        <input
          type="text"
          placeholder="Clip Name (e.g. Chorus Part)"
          value={clipName}
          onChange={(e) => setClipName(e.target.value)}
          className="w-full bg-gray-800 border border-gray-600 p-3 rounded-lg mb-3 text-white"
        />

        {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

        <button
          onClick={handleSaveTrim}
          disabled={saving || loading}
          className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {saving ? "Saving..." : "✂️ Trim & Add to Queue"}
        </button>

        <p className="text-gray-500 text-xs text-center mt-2">
          You can add multiple clips from this song before closing
        </p>

      </div>
    </div>
  );
};

export default SongTrimmerModal;