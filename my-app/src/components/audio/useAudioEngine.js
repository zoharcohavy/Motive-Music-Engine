// useAudioEngine.js
import { useRef, useState, useEffect } from "react";
import { KEYS } from "./constants";

export function useAudioEngine({ BASE_STRIP_SECONDS }) {
    const audioCtxRef = useRef(null);
    const analyserRef = useRef(null);
    const masterGainRef = useRef(null);
    const convolverRef = useRef(null);
    const recordDestRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordingChunksRef = useRef([]);
    const [waveform, setWaveform] = useState("sine");
    const [effect, setEffect] = useState("none");

    const playRemoteNote = (msg) => {
        // wrap your existing playNote with whatever data comes from room
        playNote({ /* build args from msg */ });
    };

    const setEffectFromRoom = (newEffect) => {
        setEffect(newEffect);
    };

    return {
        audioCtxRef,
        analyserRef,
        masterGainRef,
        convolverRef,
        recordingDestRef,
        mediaRecorderRef,

        waveform,
        setWaveform,
        effect,
        setEffect,

        playNote,
        playRemoteNote,
        setEffectFromRoom,
    };
}
