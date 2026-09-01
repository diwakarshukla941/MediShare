import { useEffect, useRef } from "react";
import { Stage, Layer, Group, Rect, Text, Ellipse, Line, Image as KonvaImage, Transformer } from "react-konva";
import useImage from "use-image";

function ImageFill({ src, width, height, objectFit }) {
  const [img] = useImage(src, "anonymous");
  if (!img) return <Rect width={width} height={height} fill="#e2e8f0" />;
  return (
    <KonvaImage
      image={img}
      width={width}
      height={height}
      listening={false}
      // Konva doesn't have native object-fit; "cover" is close enough visually
      // for the designer canvas (the burned-in render handles true cover/contain).
      opacity={objectFit === "contain" ? 1 : 1}
    />
  );
}

function ElementShape({ el }) {
  switch (el.type) {
    case "video":
      return (
        <>
          <Rect width={el.width} height={el.height} fill="#1e293b" cornerRadius={el.borderRadius || 0} />
          <Rect
            width={el.width}
            height={el.height}
            stroke="#94a3b8"
            dash={[10, 6]}
            strokeWidth={2}
            cornerRadius={el.borderRadius || 0}
            listening={false}
          />
          <Text
            text="VIDEO AREA"
            width={el.width}
            height={el.height}
            align="center"
            verticalAlign="middle"
            fill="#cbd5e1"
            fontStyle="bold"
            fontSize={16}
            listening={false}
          />
        </>
      );
    case "text":
      return (
        <>
          {el.background && el.background !== "transparent" && (
            <Rect width={el.width} height={el.height} fill={el.background} cornerRadius={el.borderRadius || 0} />
          )}
          {el.border?.width > 0 && (
            <Rect
              width={el.width}
              height={el.height}
              stroke={el.border.color || "#000"}
              strokeWidth={el.border.width}
              cornerRadius={el.borderRadius || 0}
              listening={false}
            />
          )}
          <Text
            text={el.content || "Text"}
            width={el.width}
            height={el.height}
            align={el.align || "center"}
            verticalAlign="middle"
            fontFamily={el.fontFamily || "Inter"}
            fontSize={el.fontSize || 24}
            fontStyle={el.fontWeight >= 700 ? "bold" : "normal"}
            fill={el.color || "#111827"}
            letterSpacing={el.letterSpacing || 0}
            lineHeight={(el.lineHeight || (el.fontSize || 24) * 1.25) / (el.fontSize || 24)}
            padding={el.padding || 0}
            wrap="word"
          />
        </>
      );
    case "image":
      return el.src ? (
        <ImageFill src={el.src} width={el.width} height={el.height} objectFit={el.objectFit} />
      ) : (
        <Rect width={el.width} height={el.height} fill="#e2e8f0" stroke="#cbd5e1" dash={[6, 4]} />
      );
    case "rect":
      return (
        <Rect
          width={el.width}
          height={el.height}
          fill={el.fill || "transparent"}
          stroke={el.stroke?.width ? el.stroke.color : undefined}
          strokeWidth={el.stroke?.width || 0}
          cornerRadius={el.borderRadius || 0}
        />
      );
    case "circle":
      return (
        <Ellipse
          x={el.width / 2}
          y={el.height / 2}
          radiusX={el.width / 2}
          radiusY={el.height / 2}
          fill={el.fill || "transparent"}
          stroke={el.stroke?.width ? el.stroke.color : undefined}
          strokeWidth={el.stroke?.width || 0}
        />
      );
    case "line":
      return <Line points={[0, 0, el.width, el.height]} stroke={el.stroke?.color || "#111827"} strokeWidth={el.stroke?.width || 2} />;
    default:
      return null;
  }
}

export default function DesignerCanvas({ frame, selectedId, onSelect, onUpdate, onDropVariable, scale }) {
  const trRef = useRef(null);
  const nodeRefs = useRef({});
  const stageRef = useRef(null);

  useEffect(() => {
    const tr = trRef.current;
    const node = selectedId ? nodeRefs.current[selectedId] : null;
    if (tr && node) {
      tr.nodes([node]);
      tr.getLayer()?.batchDraw();
    } else if (tr) {
      tr.nodes([]);
    }
  }, [selectedId, frame.elements]);

  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-8">
      <div
        className="mx-auto bg-white shadow-lg"
        style={{ width: frame.width * scale, height: frame.height * scale }}
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("application/x-medishare-variable")) e.preventDefault();
        }}
        onDrop={(e) => {
          const key = e.dataTransfer.getData("application/x-medishare-variable");
          if (!key || !onDropVariable) return;
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          onDropVariable(key, (e.clientX - rect.left) / scale, (e.clientY - rect.top) / scale);
        }}
      >
        <Stage
          ref={stageRef}
          width={frame.width * scale}
          height={frame.height * scale}
          scale={{ x: scale, y: scale }}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null);
          }}
        >
          <Layer>
            {frame.background?.type === "color" && (
              <Rect width={frame.width} height={frame.height} fill={frame.background.value || "#eef2ff"} listening={false} />
            )}
            {frame.background?.type === "image" && frame.background.value && (
              <ImageFill src={frame.background.value} width={frame.width} height={frame.height} objectFit="cover" />
            )}

            {frame.elements
              .filter((el) => !el.hidden)
              .map((el) => (
                <Group
                  key={el.id}
                  ref={(node) => {
                    if (node) nodeRefs.current[el.id] = node;
                  }}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rotation={el.rotation || 0}
                  opacity={el.opacity ?? 1}
                  draggable={!el.locked}
                  onClick={() => onSelect(el.id)}
                  onTap={() => onSelect(el.id)}
                  onDragMove={(e) => onUpdate(el.id, { x: e.target.x(), y: e.target.y() }, { record: false })}
                  onDragEnd={(e) => onUpdate(el.id, { x: e.target.x(), y: e.target.y() }, { record: true })}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onUpdate(
                      el.id,
                      {
                        x: node.x(),
                        y: node.y(),
                        width: Math.max(10, Math.round(node.width() * scaleX)),
                        height: Math.max(10, Math.round(node.height() * scaleY)),
                        rotation: Math.round(node.rotation()),
                      },
                      { record: true }
                    );
                  }}
                >
                  <ElementShape el={el} />
                </Group>
              ))}

            <Transformer
              ref={trRef}
              rotateEnabled
              flipEnabled={false}
              boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
