import React from "react";

type TitleProps = {
  text: string;
};

export default function Title({ text }: TitleProps) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold">{text || "..."}</h1>
    </div>
  );
}
