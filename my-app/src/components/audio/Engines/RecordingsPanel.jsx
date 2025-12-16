import React, { useState } from "react";
import { API_BASE } from "../constants";

export default function RecordingsPanel({
  isOpen = true,
  onToggle,
  recordings = [],
  recordingsError,
  storageFiles = [],
  storageError,
}) {
  const [isRecFolderOpen, setIsRecFolderOpen] = useState(true);
  const [isStorageFolderOpen, setIsStorageFolderOpen] = useState(true);

  return (
    <div className={`recPanel ${isOpen ? "" : "recPanel--collapsed"}`}>
      <button
        type="button"
        className="recPanel__header"
        onClick={onToggle}
        title={isOpen ? "Collapse" : "Expand"}
      >
        <span className="recPanel__title">Files</span>
        <span className="recPanel__chev">{isOpen ? "▾" : "▸"}</span>
      </button>

      {!isOpen ? null : (
        <div className="recPanel__body">
          {/* Recordings folder */}
          <div className="recPanel__folder">
            <button
              type="button"
              className="recPanel__folderHeader"
              onClick={() => setIsRecFolderOpen((v) => !v)}
            >
              <span className="recPanel__folderIcon">📁</span>
              <span className="recPanel__folderName">Recordings</span>
              <span className="recPanel__chevSmall">
                {isRecFolderOpen ? "▾" : "▸"}
              </span>
            </button>

            {isRecFolderOpen ? (
              recordingsError ? (
                <div className="recPanel__error">
                  Error loading recordings: {recordingsError}
                </div>
              ) : recordings.length === 0 ? (
                <div className="recPanel__empty">No recordings yet</div>
              ) : (
                <ul className="recPanel__list">
                  {recordings.map((file) => (
                    <li key={file} className="recPanel__item">
                      <a
                        href={`${API_BASE}/recordings/${file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="recPanel__link"
                      >
                        {file}
                      </a>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>

          {/* Storage folder */}
          <div className="recPanel__folder">
            <button
              type="button"
              className="recPanel__folderHeader"
              onClick={() => setIsStorageFolderOpen((v) => !v)}
            >
              <span className="recPanel__folderIcon">📁</span>
              <span className="recPanel__folderName">Storage</span>
              <span className="recPanel__chevSmall">
                {isStorageFolderOpen ? "▾" : "▸"}
              </span>
            </button>

            {isStorageFolderOpen ? (
              storageFiles.length === 0 ? (
                <div className="recPanel__empty">No files yet</div>
              ) : storageError ? (
                <div className="recPanel__error">{storageError}</div>
              ) : (
                <ul className="recPanel__list">
                  {storageFiles.map((file) => (
                    <li key={file} className="recPanel__item">
                      <a
                        href={`${API_BASE}/storage/${file}`}
                        target="_blank"
                        rel="noreferrer"
                        className="recPanel__link"
                      >
                        {file}
                      </a>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
