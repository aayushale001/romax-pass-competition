"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import type { CardDocument, CardNode } from "@/types/cardDocument";
import { mixColors } from "@/lib/colors";

type CardDocumentRendererProps = {
  document: CardDocument;
  qrValue: string;
  compact?: boolean;
  previewRef?: Ref<HTMLDivElement>;
  /** Optional id of the currently selected node (for the editor). */
  selectedNodeId?: string | null;
  onSelectNode?: (nodeId: string) => void;
};

function px(value: number) {
  return `${Math.max(0, value).toFixed(2)}px`;
}

function scaledPx(value: number, scale: number) {
  return px(value * scale);
}

function pct(value: number, total: number) {
  return `${((value / total) * 100).toFixed(3)}%`;
}

function frameStyle(node: CardNode, document: CardDocument): CSSProperties {
  return {
    position: "absolute",
    left: pct(node.x, document.width),
    top: pct(node.y, document.height),
    width: pct(node.w, document.width),
    height: pct(node.h, document.height),
    zIndex: node.z ?? 1,
  };
}

function textStyle(node: CardNode, scale: number): CSSProperties {
  const clamp = node.lineClamp ?? 1;
  return {
    color: node.color,
    fontSize: scaledPx(node.fontSize ?? 14, scale),
    fontWeight: node.fontWeight ?? 600,
    textAlign: node.align ?? "left",
    textTransform: node.uppercase ? "uppercase" : "none",
    letterSpacing: node.letterSpacing
      ? scaledPx(node.letterSpacing, scale)
      : undefined,
    lineHeight: 1.08,
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: clamp,
    overflow: "hidden",
    wordBreak: "break-word",
  };
}

function backgroundStyle(document: CardDocument): CSSProperties {
  const { background } = document;
  if (background.type === "gradient") {
    return {
      backgroundImage: `linear-gradient(${background.angle ?? 145}deg, ${
        background.color
      }, ${background.color2 ?? background.color})`,
    };
  }
  if (background.type === "image" && background.imageUrl) {
    return {
      backgroundColor: background.color,
      backgroundImage: `url(${JSON.stringify(background.imageUrl)})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { backgroundColor: background.color };
}

function NodeView({
  node,
  document,
  qrValue,
  selected,
  onSelect,
  scale,
}: {
  node: CardNode;
  document: CardDocument;
  qrValue: string;
  selected: boolean;
  onSelect?: (nodeId: string) => void;
  scale: number;
}) {
  const interactive = Boolean(onSelect);
  const wrapperStyle: CSSProperties = {
    ...frameStyle(node, document),
    cursor: interactive ? "pointer" : undefined,
    outline: selected ? "2px solid #2563eb" : undefined,
    outlineOffset: "2px",
  };

  const select = onSelect ? () => onSelect(node.id) : undefined;

  if (node.type === "qr") {
    const pad = node.w * 0.09;
    return (
      <div
        data-role="qr-code"
        onClick={select}
        style={{
          ...wrapperStyle,
          background: node.fill ?? "#ffffff",
          borderRadius: scaledPx(node.radius ?? 10, scale),
          border:
            node.borderColor && node.borderColor !== "transparent"
              ? `1px solid ${node.borderColor}`
              : undefined,
          padding: scaledPx(pad, scale),
          boxSizing: "border-box",
          display: "grid",
          placeItems: "center",
        }}
      >
        <QRCodeSVG
          value={qrValue}
          bgColor="#ffffff"
          fgColor="#111827"
          marginSize={0}
          style={{ width: "100%", height: "100%", display: "block" }}
        />
      </div>
    );
  }

  if (node.type === "panel") {
    return (
      <div
        data-role={node.role}
        onClick={select}
        style={{
          ...wrapperStyle,
          background: node.fill,
          borderRadius: node.radius ? scaledPx(node.radius, scale) : undefined,
          opacity: node.opacity ?? 1,
        }}
      />
    );
  }

  if (node.type === "logo" || node.type === "image") {
    const radius = node.radius ? scaledPx(node.radius, scale) : undefined;
    return (
      <div
        data-role={node.role}
        onClick={select}
        style={{
          ...wrapperStyle,
          background: node.fill,
          borderRadius: radius,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          opacity: node.opacity ?? 1,
        }}
      >
        {node.imageUrl ? (
          <img
            src={node.imageUrl}
            alt=""
            referrerPolicy="no-referrer"
            style={{
              width: "100%",
              height: "100%",
              objectFit: node.imageFit ?? "cover",
            }}
          />
        ) : node.role === "member-photo" ? (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              gap: scaledPx(5, scale),
              color: node.color,
              textAlign: "center",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                position: "relative",
                width: scaledPx(26, scale),
                height: scaledPx(20, scale),
                border: `${Math.max(1, 1.6 * scale)}px solid currentColor`,
                borderRadius: scaledPx(4, scale),
                opacity: 0.72,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: scaledPx(4, scale),
                  top: scaledPx(4, scale),
                  width: scaledPx(4, scale),
                  height: scaledPx(4, scale),
                  borderRadius: 999,
                  background: "currentColor",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  left: scaledPx(5, scale),
                  right: scaledPx(4, scale),
                  bottom: scaledPx(4, scale),
                  height: scaledPx(7, scale),
                  clipPath: "polygon(0 100%, 36% 22%, 56% 58%, 74% 32%, 100% 100%)",
                  background: "currentColor",
                }}
              />
            </span>
            <span
              style={{
                fontWeight: 900,
                fontSize: scaledPx(13, scale),
                letterSpacing: scaledPx(1.4, scale),
              }}
            >
              {node.fallbackText ?? "PH"}
            </span>
          </div>
        ) : (
          <span
            style={{
              color: node.color,
              fontWeight: 900,
              fontSize: scaledPx(node.type === "logo" ? 16 : 34, scale),
              letterSpacing: scaledPx(0.5, scale),
            }}
          >
            {node.fallbackText}
          </span>
        )}
      </div>
    );
  }

  if (node.type === "field") {
    const labelColor = mixColors(
      node.color ?? "#111827",
      document.background.color,
      0.5,
    );
    return (
      <div
        data-role={node.role}
        onClick={select}
        style={{
          ...wrapperStyle,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: scaledPx(2, scale),
          overflow: "hidden",
        }}
      >
        <span
          style={{
            color: labelColor,
            fontSize: scaledPx(9.5, scale),
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: scaledPx(0.6, scale),
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.label}
        </span>
        <span
          style={{
            color: node.color,
            fontSize: scaledPx(node.fontSize ?? 14, scale),
            fontWeight: node.fontWeight ?? 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.text}
        </span>
      </div>
    );
  }

  // text
  return (
    <div data-role={node.role} onClick={select} style={wrapperStyle}>
      <span style={textStyle(node, scale)}>{node.text}</span>
    </div>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (!ref) return;
  if (typeof ref === "function") {
    ref(value);
    return;
  }
  ref.current = value;
}

export function CardDocumentRenderer({
  document,
  qrValue,
  compact,
  previewRef,
  selectedNodeId,
  onSelectNode,
}: CardDocumentRendererProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const isPortrait = document.height > document.width;
  // Portrait passes are tall, so cap their rendered width tighter than the
  // landscape card to keep previews a sensible height.
  const maxWidth = compact
    ? isPortrait
      ? 230
      : 320
    : isPortrait
      ? 380
      : 560;
  const [scale, setScale] = useState(() => maxWidth / document.width);
  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      rootRef.current = node;
      assignRef(previewRef, node);
    },
    [previewRef],
  );

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const updateScale = () => {
      const width = node.getBoundingClientRect().width;
      if (width > 0) {
        setScale(width / document.width);
      }
    };

    updateScale();

    if (typeof ResizeObserver === "undefined") {
      const frame = window.requestAnimationFrame(updateScale);
      return () => window.cancelAnimationFrame(frame);
    }

    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [document.width, maxWidth]);

  return (
    <div
      ref={setRefs}
      data-role="card-root"
      style={{
        position: "relative",
        width: "100%",
        maxWidth,
        // Keep the aspect ratio under flex/grid parents that default to
        // align-items: stretch (mixed portrait/landscape rows otherwise
        // stretch a card vertically and distort it).
        alignSelf: "center",
        aspectRatio: `${document.width} / ${document.height}`,
        borderRadius: compact ? 14 : 22,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: compact
          ? "0 10px 24px rgba(15, 23, 42, 0.08)"
          : "0 18px 38px rgba(15, 23, 42, 0.12)",
        ...backgroundStyle(document),
      }}
    >
      {document.background.overlay ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: document.background.overlay,
            zIndex: 0,
          }}
        />
      ) : null}
      {document.nodes.map((node) => (
        <NodeView
          key={node.id}
          node={node}
          document={document}
          qrValue={qrValue}
          selected={selectedNodeId === node.id}
          onSelect={onSelectNode}
          scale={scale}
        />
      ))}
    </div>
  );
}
