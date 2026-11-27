import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from '@xyflow/react';

/**
 * Custom React Flow edge that glows brightly with animated flow and live value badge
 * whenever WebSocket edge_pulse events report telemetry passing through the wire.
 */
export function GlowingEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected
}) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 12
  });

  const isGlowing = Boolean(data?.glowing);
  const strokeColor = isGlowing ? '#22d3ee' : selected ? '#60a5fa' : '#33486e';

  return (
    <>
      {isGlowing && (
        <path
          d={edgePath}
          fill="none"
          stroke="rgba(34, 211, 238, 0.35)"
          strokeWidth={10}
          style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        className={isGlowing ? 'nf-wire-active' : undefined}
        style={{
          stroke: strokeColor,
          strokeWidth: isGlowing ? 3 : 2,
          transition: 'stroke 0.25s ease, stroke-width 0.25s ease'
        }}
      />

      {isGlowing && data?.lastValue !== undefined && (
        <EdgeLabelRenderer>
          <div
            className="mono nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              background: 'rgba(8, 47, 73, 0.92)',
              color: '#67e8f9',
              border: '1px solid rgba(34, 211, 238, 0.65)',
              boxShadow: '0 0 12px rgba(34, 211, 238, 0.45)',
              borderRadius: 999,
              fontSize: 10,
              fontWeight: 700,
              padding: '2px 7px',
              pointerEvents: 'none'
            }}
          >
            {data.lastValue}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = {
  glowing: GlowingEdge
};
