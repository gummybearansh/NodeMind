import React from 'react';
import { Handle, Position } from '@xyflow/react';

const CustomNode = ({ data }) => {
  return (
    <div className={`custom-node ${data.faded ? 'faded' : ''}`} data-owner={data.owner}>
      <Handle type="target" position={Position.Top} />
      
      {/* Agent Header Tag */}
      <div className="node-header">
        <div className="owner-bullet" />
        <span className="owner-title">{data.owner || "Unknown"}</span>
      </div>

      {/* Node Content */}
      <div className="node-body">
        <div className="node-label">{data.label}</div>
      </div>

      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};

export default CustomNode;
