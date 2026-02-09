export const getNodeHandles = (nodeType: string): { inputs: string[]; outputs: string[] } => {
  switch (nodeType) {
    case "imageInput":
      return { inputs: [], outputs: ["image"] };
    case "annotation":
      return { inputs: ["image"], outputs: ["image"] };
    case "prompt":
      return { inputs: [], outputs: ["text"] };
    case "imageGen":
      return { inputs: ["image", "text"], outputs: ["image"] };
    case "wanImageGen":
      return { inputs: ["image", "text"], outputs: ["image"] };
    case "soraVideoGen":
      return { inputs: ["image", "text"], outputs: [] };
    case "wanVideoGen":
      return { inputs: ["image", "text"], outputs: [] };
    default:
      return { inputs: [], outputs: [] };
  }
};

export const isValidConnection = (connection: { sourceHandle?: string | null; targetHandle?: string | null }) => {
  const { sourceHandle, targetHandle } = connection;
  if (sourceHandle === "image" && targetHandle !== "image") return false;
  if (sourceHandle === "text" && targetHandle !== "text") return false;
  return true;
};
