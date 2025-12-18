import DeleteIcon from "../../assets/icons/bin-half.svg";
import DragIcon from "../../assets/icons/drag-hand-gesture.svg";
import HeadIcon from "../../assets/icons/italic.svg";
import CutIcon from "../../assets/icons/cut.svg";


export default function MouseModeToggle({ mouseMode, setMouseMode }) {
  return (
    <div className="mouseModeGrid" aria-label="Mouse mode">
      <ModeButton
        icon={DragIcon}
        label="Move clips"
        active={mouseMode === "clip"}
        onClick={() => setMouseMode("clip")}
      />
      <ModeButton
        icon={HeadIcon}
        label="Move tape head"
        active={mouseMode === "head"}
        onClick={() => setMouseMode("head")}
      />
      <ModeButton
        icon={DeleteIcon}
        label="Delete"
        active={mouseMode === "delete"}
        onClick={() => setMouseMode("delete")}
      />
      <ModeButton
        icon={CutIcon}
        label="Cut clip"
        active={mouseMode === "cut"}
        onClick={() => setMouseMode("cut")}
      />
    </div>
  );
}

function ModeButton({ icon, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`mouseModeBtn ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      title={label}
    >
      <img src={icon} alt="" draggable={false} />
    </button>
  );
}
