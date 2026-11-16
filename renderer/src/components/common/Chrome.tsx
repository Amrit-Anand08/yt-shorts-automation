import React from "react";
import { useCurrentFrame } from "remotion";
import { C } from "../../constants/tokens";

// Persistent header and footer (outside the scene sequences)
export const Chrome: React.FC<{
  topic: string;
  channelName: string;
  boundaries: number[];
}> = ({ topic, channelName, boundaries }) => {
  const frame = useCurrentFrame();

  const sceneCount = boundaries.length - 1;
  const total = Math.max(1, boundaries[boundaries.length - 1]);

  let activeIndex = 0;
  for (let i = 0; i < sceneCount; i += 1) {
    if (frame >= boundaries[i]) activeIndex = i;
  }

  const progress = Math.min(100, (frame / total) * 100);

  return (
    <>
      {/* HEADER */}
      <div
        style={{
          position: "absolute",
          top: 84,
          left: 64,
          right: 64,
          height: 84,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            padding: "12px 28px 12px 16px",
            borderRadius: 999,
            background: C.white,
            border: `4px solid ${C.ink}`,
            boxShadow: `5px 5px 0 ${C.ink}`,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 24 24">
            <path
              d="M12 2 L14.9 8.6 L22 9.3 L16.6 14 L18.2 21 L12 17.3 L5.8 21 L7.4 14 L2 9.3 L9.1 8.6 Z"
              fill={C.yellow}
              stroke={C.ink}
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: 30,
              fontWeight: 900,
              letterSpacing: 3,
              color: C.ink,
              textTransform: "uppercase",
            }}
          >
            {channelName}
          </span>
        </div>

        {sceneCount <= 12 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {Array.from({ length: sceneCount }).map((_, i) => (
              <div
                key={i}
                style={{
                  width: i === activeIndex ? 46 : 16,
                  height: 16,
                  borderRadius: 8,
                  background:
                    i === activeIndex
                      ? C.orange
                      : i < activeIndex
                        ? C.teal
                        : `${C.ink}30`,
                  border: `3px solid ${C.ink}`,
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* FOOTER */}
      <div
        style={{
          position: "absolute",
          left: 64,
          right: 64,
          bottom: 210,
        }}
      >
        <div
          style={{
            marginBottom: 14,
            fontSize: 28,
            fontWeight: 700,
            color: C.subtle,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {topic}
        </div>

        <div
          style={{
            height: 22,
            borderRadius: 14,
            background: C.white,
            border: `4px solid ${C.ink}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: C.teal,
            }}
          />
        </div>
      </div>
    </>
  );
};
