import { useState, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import axios from "axios";
import { API, buildFileUrl } from "../service/ipConfig";

/**
 * Re-trim an EXISTING TrimClip (keeps the same TrimClipId).
 * Loads the ORIGINAL song's waveform, seeds the selection region with
 * the clip's current start/end, lets the user drag to adjust, and on
 * save re-cuts from the original song and updates the same TrimClip row.
 *
 * Props:
 *  - trimClipId: number (required)
 *  - onClose: () => void
 *  - onSaved: ({ trimClipId, startMs, endMs, file }) => void
 */
const ClipReTrimModal = ({ trimClipId, onClose, onSaved }) => {
  const waveformRef = useRef(null);
  const wavesurfer = useRef(null);
  const regionsPlugin = useRef(null);

  const [clip, setClip] = useState(null);
  const [loadingClip, setLoadingClip] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveLoading, setWaveLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 1. Fetch the clip's details (SongId, current StartMs/EndMs, OriginalSongFilePath)
  useEffect(() => {
    if (!trimClipId) return;
    setLoadingClip(true);
    setLoadError("");
    axios
      .get(API.trimClips.byId(trimClipId))
      .then((res) => {
        if (res.data && res.data.success !== false) {
          setClip(res.data);
        } else {
          setLoadError(res.data?.message || "Could not load clip");
        }
      })
      .catch(() => setLoadError("Could not load clip"))
      .finally(() => setLoadingClip(false));
  }, [trimClipId]);

  // 2. Once we have the clip, load the ORIGINAL SONG's waveform and seed
  //    the region with the clip's current start/end (not 0..duration)
  useEffect(() => {
    if (!clip || !clip.OriginalSongFilePath || !waveformRef.current) return;

    setWaveLoading(true);
    setStartMs(clip.StartMs || 0);
    setEndMs(clip.EndMs || 0);
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
      height: 100,
      plugins: [regionsPlugin.current],
    });

    wavesurfer.current.load(buildFileUrl(clip.OriginalSongFilePath));

    wavesurfer.current.on("ready", () => {
      const dur = wavesurfer.current.getDuration();
      setDuration(dur);

      const initStart = Math.min((clip.StartMs || 0) / 1000, dur);
      const initEnd = Math.min((clip.EndMs || dur * 1000) / 1000, dur);

      regionsPlugin.current.addRegion({
        id: "retrim-region",
        start: initStart,
        end: initEnd > initStart ? initEnd : dur,
        color: "rgba(168, 85, 247, 0.25)",
        drag: true,
        resize: true,
      });

      setWaveLoading(false);
    });

    regionsPlugin.current.on("region-updated", (region) => {
      setStartMs(Math.round(region.start * 1000));
      setEndMs(Math.round(region.end * 1000));
    });

    wavesurfer.current.on("timeupdate", (time) => setCurrentTime(time));
    wavesurfer.current.on("finish", () => setIsPlaying(false));

    return () => {
      if (wavesurfer.current) {
        wavesurfer.current.destroy();
        wavesurfer.current = null;
      }
    };
  }, [clip]);

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

  const handleSaveRetrim = async () => {
    if (startMs >= endMs) {
      setError("End time must be greater than Start time");
      return;
    }
    if (endMs - startMs < 1000) {
      setError("Clip must be at least 1 second long");
      return;
    }

    setError("");
    setSaving(true);
    try {
      const url = API.trimClips.update(trimClipId, startMs, endMs);
      const res = await axios.put(url);
      if (res.data.success) {
        onSaved &&
          onSaved({
            trimClipId,
            startMs,
            endMs,
            file: res.data.file,
          });
      } else {
        setError(res.data.message || "Failed to save re-trim");
      }
    } catch (err) {
      setError(
        err.response?.data?.Message ||
          err.response?.data?.message ||
          "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex justify-center items-center z-[70] px-4">
      <div className="bg-gray-900 text-white p-6 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">
              ✂️ Re-trim {clip?.SongTitle ? `"${clip.SongTitle}"` : `TrimClip #${trimClipId}`}
            </h2>
            {clip?.ArtistName && <p className="text-gray-400 text-sm">{clip.ArtistName}</p>}
          </div>
          <button
            onClick={onClose}
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm"
          >
            ✕ Close
          </button>
        </div>

        {loadingClip ? (
          <p className="text-gray-400 text-sm text-center py-8">Loading clip...</p>
        ) : loadError || !clip?.OriginalSongFilePath ? (
          <p className="text-red-400 text-sm text-center py-8">
            {loadError || "Could not find the original song for this clip."}
          </p>
        ) : (
          <>
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
              {waveLoading && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce delay-200" />
                  <p className="text-gray-400 ml-2">Loading waveform...</p>
                </div>
              )}
              <div ref={waveformRef} />
              {!waveLoading && (
                <p className="text-gray-500 text-xs text-center mt-2">
                  Drag purple region edges to adjust Start & End
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
                disabled={waveLoading}
                className="bg-purple-600 hover:bg-purple-700 w-14 h-14 rounded-full text-2xl flex items-center justify-center disabled:opacity-50"
              >
                {isPlaying ? "⏸" : "▶️"}
              </button>
              <button
                onClick={() => handleSkip(5)}
                className="bg-gray-700 hover:bg-gray-600 w-10 h-10 rounded-full flex items-center justify-center"
              >⏩</button>
            </div>

            {endMs > startMs && (
              <p className="text-green-400 text-sm mb-3 text-center">
                ✅ New Clip Duration: {formatMs(endMs - startMs)}
              </p>
            )}

            {error && <p className="text-red-400 mb-3 text-sm">{error}</p>}

            <button
              onClick={handleSaveRetrim}
              disabled={saving || waveLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {saving ? "Saving..." : "✂️ Save Re-trim (same clip slot)"}
            </button>
            <p className="text-gray-500 text-xs text-center mt-2">
              This updates TrimClip #{trimClipId} in place — its position in every sequence stays the same.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default ClipReTrimModal;