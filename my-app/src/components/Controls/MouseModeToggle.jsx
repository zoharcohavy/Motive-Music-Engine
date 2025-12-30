import DeleteIcon from "../../assets/icons/bin-half.svg";
import DragIcon from "../../assets/icons/drag-hand-gesture.svg";
import HeadIcon from "../../assets/icons/italic.svg";
import CutIcon from "../../assets/icons/cut.svg";
import CropIcon from "../../assets/icons/crop.svg";
import PointerIcon from "../../assets/icons/cursor-pointer.svg";


export default function MouseModeToggle({
  mouseMode,
  setMouseMode,
}) {
  return (
    <div className="mouseModeGrid" aria-label="Mouse mode">
      <SmartModeButton
        topIcon={PointerIcon}
        bottomIcons={[HeadIcon, DragIcon, CropIcon]}
        label="Smart mouse"
        active={mouseMode === "smart"}
        onClick={() => setMouseMode("smart")}
      />

      <ModeButton
        icon={DragIcon}
        label="Move clips"
        active={mouseMode === "move"}
        onClick={() => setMouseMode("move")}
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
      <ModeButton
        icon={CropIcon}
        label="Crop"
        active={mouseMode === "crop"}
        onClick={() => setMouseMode("crop")}
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

function SmartModeButton({ topIcon, bottomIcons, label, active, onClick }) {
  return (
    <button
      type="button"
      className={`mouseModeBtn mouseModeBtn--smart ${active ? "active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      title={label}
    >
      <div className="smartMouseIcon">
        <div className="smartMouseTop">
          <img src={topIcon} alt="" draggable={false} />
        </div>

        <div className="smartMouseDivider" />

        <div className="smartMouseBottom">
          <img src={bottomIcons[0]} alt="" draggable={false} />
          <div className="smartMouseVDivider" />
          <img src={bottomIcons[1]} alt="" draggable={false} />
          <div className="smartMouseVDivider" />
          <img src={bottomIcons[2]} alt="" draggable={false} />
        </div>
      </div>
    </button>
  );
}

