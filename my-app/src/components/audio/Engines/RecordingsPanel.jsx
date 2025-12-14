import React from "react";
import { API_BASE } from "../constants";

export default function RecordingsPanel({ recordings, recordingsError }) {
  return (
    <div className="recPanel">
      <div className="recPanel__title">
        Recordings
      </div>
      {recordingsError ? (
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
      )}
    </div>
  );
}