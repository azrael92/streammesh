import React from "react";

export default function Loader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-10 h-10 inline-block">
        <div className="w-full h-full rounded-full border-[3px] border-t-transparent border-blue-500 animate-spin"></div>
      </div>
    </div>
  );
}