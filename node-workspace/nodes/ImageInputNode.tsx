import React, { useRef } from "react";
import { BaseNode } from "./BaseNode";
import { ImageInputNodeData } from "../types";

type Props = {
  id: string;
  data: ImageInputNodeData;
};

export const ImageInputNode: React.FC<Props> = ({ data }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result as string;
      data.image = result;
      data.filename = file.name;
      const img = new Image();
      img.onload = () => {
        data.dimensions = { width: img.width, height: img.height };
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <BaseNode title="Image Input" outputs={["image"]}>
      <div className="space-y-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-xs"
        >
          Upload Image
        </button>
        {data.image && (
          <img src={data.image} alt="preview" className="w-full h-24 object-cover rounded border border-gray-200 dark:border-gray-700" />
        )}
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </BaseNode>
  );
};
