import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/authContext';
import { automationService } from '../services/automationService';

function formatWhen(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function SavedDesigns({ refreshToken, onOpenDesign }) {
  const { user } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [images, setImages] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await automationService.listDesigns();
      setDesigns(result.designs);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshToken]);

  // Thumbnails are fetched one record at a time and only for designs that have
  // artwork, so an archive of concepts costs no image traffic at all.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      for (const record of designs) {
        if (!record.hasImage || images[record.id]) continue;
        try {
          const result = await automationService.getDesignImage(record.id);
          if (cancelled) return;
          setImages((current) => ({ ...current, [record.id]: result.imageUrl }));
        } catch {
          // A missing image is not worth an error banner — the card simply
          // stays in its no-artwork state.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [designs, images]);

  /**
   * Saves the PNG straight from the archive, without going through the editor
   * first. The artwork may not be in `images` yet — thumbnails load one at a
   * time — so it is fetched on demand when it is missing.
   */
  const handleDownload = async (record) => {
    setDownloadingId(record.id);
    try {
      const imageUrl = images[record.id] || (await automationService.getDesignImage(record.id)).imageUrl;
      const blob = await (await fetch(imageUrl)).blob();
      const objectUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${record.design?.name || 'trendmint-design'}.png`.replace(/\s+/g, '-').toLowerCase();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(`Could not download: ${err.message}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (record) => {
    if (!window.confirm(`Delete "${record.design?.name || 'this design'}"?`)) return;
    try {
      await automationService.deleteDesign(record.id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500">⏳ Loading saved designs...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">📁 Saved Designs ({designs.length})</h2>
        <button
          onClick={load}
          className="px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200"
        >
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800" role="alert">
          {error}
        </div>
      )}

      {designs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-1">No saved designs yet.</p>
          <p className="text-gray-400 text-sm">
            Turn automation on above, or press &ldquo;Run now&rdquo; to generate the first batch.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {designs.map((record) => (
            <div key={record.id} className="border border-gray-200 rounded-lg overflow-hidden flex flex-col">
              <div className="aspect-square bg-gray-50 flex items-center justify-center">
                {images[record.id] ? (
                  <img
                    src={images[record.id]}
                    alt={record.design?.name || 'Design'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-center px-4">
                    <p className="text-4xl mb-2">🎨</p>
                    <p className="text-xs text-gray-400">
                      {record.hasImage ? 'Loading artwork...' : 'Concept only — no artwork yet'}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3 flex-1 flex flex-col">
                <h3 className="font-semibold text-gray-800 text-sm leading-tight">
                  {record.design?.name || 'Untitled'}
                </h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{record.design?.description}</p>

                {record.trendName && (
                  <p className="text-xs text-gray-400 mt-2 truncate" title={record.trendName}>
                    from: {record.trendName}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">{record.source}</span>
                  <span className="text-[10px] text-gray-400">{formatWhen(record.createdAt)}</span>
                </div>

                {record.design?.colors?.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {record.design.colors.slice(0, 6).map((color, index) => (
                      <span
                        key={`${record.id}-${color.hex}-${index}`}
                        className="w-4 h-4 rounded border border-gray-200"
                        style={{ backgroundColor: color.hex }}
                        title={color.name}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => onOpenDesign(record, images[record.id])}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-green-500 text-white hover:bg-green-600 transition-all"
                  >
                    Open
                  </button>
                  {/* Only where there is artwork to save — a concept has
                      nothing to put in a PNG. */}
                  {record.hasImage && (
                    <button
                      onClick={() => handleDownload(record)}
                      disabled={downloadingId === record.id}
                      title="Download PNG"
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-300 transition-all"
                    >
                      {downloadingId === record.id ? '⏳' : '📥 PNG'}
                    </button>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      onClick={() => handleDelete(record)}
                      className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-50 text-red-700 hover:bg-red-100 transition-all"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
