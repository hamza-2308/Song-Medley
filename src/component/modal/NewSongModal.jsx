import { useState } from "react";
import axios from "axios";

const AddNewSongModal = ({ isOpen, onClose, onSongUploaded }) => {
  const [songTitle, setSongTitle] = useState("");
  const [artistName, setArtistName] = useState("");
  const [movieName, setMovieName] = useState("");
  const [themeName, setThemeName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleUpload = async () => {
    // Validation
    if (!songTitle.trim()) {
      setError("Song Title is required");
      return;
    }

    if (!artistName.trim()) {
      setError("Artist Name is required");
      return;
    }

    if (!file) {
      setError("Please select an MP3 file");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("SongTitle", songTitle.trim());
      formData.append("ArtistName", artistName.trim());
      formData.append("MovieName", movieName.trim());
      formData.append("ThemeName", themeName.trim());
      formData.append("file", file);

      const response = await axios.post(
        "https://localhost:44307/api/songs/upload",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      if (response.data.success) {
        alert("Song Uploaded Successfully!");

        if (onSongUploaded) {
          onSongUploaded(response.data.filePath);
        }

        setSongTitle("");
        setArtistName("");
        setMovieName("");
        setThemeName("");
        setFile(null);

        onClose();
      } else {
        // Backend se "already exists" jese messages yahan aayenge
        setError(response.data.message);
      }
    } catch (err) {
      console.error(err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl w-[500px] text-black">
        <h2 className="text-2xl font-bold mb-4">Upload New Song</h2>

        {error && <p className="text-red-500 mb-3">{error}</p>}

        <input
          type="text"
          placeholder="Song Title"
          value={songTitle}
          onChange={(e) => setSongTitle(e.target.value)}
          className="w-full border p-3 rounded-lg mb-3"
        />

        <input
          type="text"
          placeholder="Artist Name"
          value={artistName}
          onChange={(e) => setArtistName(e.target.value)}
          className="w-full border p-3 rounded-lg mb-3"
        />

        <input
          type="text"
          placeholder="Movie Name"
          value={movieName}
          onChange={(e) => setMovieName(e.target.value)}
          className="w-full border p-3 rounded-lg mb-3"
        />

        <input
          type="text"
          placeholder="Theme"
          value={themeName}
          onChange={(e) => setThemeName(e.target.value)}
          className="w-full border p-3 rounded-lg mb-3"
        />

        <input
          type="file"
          accept="audio/mp3,audio/mpeg"
          onChange={(e) => setFile(e.target.files[0])}
          className="w-full border p-3 rounded-lg mb-4"
        />

        <div className="flex gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="flex-1 bg-green-600 text-white py-3 rounded-lg disabled:opacity-50"
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          <button
            onClick={onClose}
            className="flex-1 bg-red-500 text-white py-3 rounded-lg"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddNewSongModal;