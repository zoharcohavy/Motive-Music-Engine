import InstrumentPage from "./InstrumentPage";

// For now, this is intentionally a 1:1 copy of the drums experience.
// Later, you can swap the sound engine / samples while keeping the same UI.
export default function SamplerPage() {
  return <InstrumentPage instrument="sampler" />;
}
