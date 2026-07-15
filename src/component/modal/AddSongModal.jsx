const AddSongModal = ({
  isOpen,
  onClose,
  onAddNewSong,
  onAddFromLibrary,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-50">
      <div className="bg-white text-black p-6 rounded-xl w-96">
        <h2 className="text-2xl font-bold mb-5">
          Add Song
        </h2>

        <div className="space-y-4">
          <button
            onClick={onAddNewSong}
            className="w-full bg-purple-600 text-white py-3 rounded-lg hover:bg-purple-700"
          >
            Add New Song
          </button>

          <button
            onClick={onAddFromLibrary}
            className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
          >
            Add From Library
          </button>

          <button
            onClick={onClose}
            className="w-full bg-red-500 text-white py-3 rounded-lg hover:bg-red-600"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSongModal;